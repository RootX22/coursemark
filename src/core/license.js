// Pro is sold through Lemon Squeezy, which emails the buyer a license key. Its license API is
// meant to be called from client apps and needs no secret: https://docs.lemonsqueezy.com/api/license-api

const API = 'https://api.lemonsqueezy.com/v1/licenses';

export class LicenseError extends Error {
  /** code: "rejected" (Lemon Squeezy said no), "wrong-product", or "unreachable". */
  constructor(code, detail) {
    super(detail || code);
    this.code = code;
  }
}

export function isConfigured(sale) {
  return Boolean(sale.storeId && sale.productId && sale.checkoutUrl);
}

/** sale: { storeId, productId, checkoutUrl } from config.js. */
export function lemonSqueezy(sale, fetchFn = globalThis.fetch.bind(globalThis)) {
  async function call(action, fields) {
    let response;
    try {
      response = await fetchFn(`${API}/${action}`, {
        method: 'POST',
        headers: { Accept: 'application/json' },
        body: new URLSearchParams(fields),
      });
    } catch (error) {
      throw new LicenseError('unreachable', error.message);
    }
    // Rate limits and outages say nothing about the key, so they must not cost anyone Pro.
    if (response.status === 429 || response.status >= 500) {
      throw new LicenseError('unreachable', `HTTP ${response.status}`);
    }
    try {
      return await response.json();
    } catch (error) {
      if (error instanceof SyntaxError) throw new LicenseError('unreachable', `HTTP ${response.status}`);
      throw error;
    }
  }

  // Any Lemon Squeezy store's key passes their API; only ours unlocks Pro.
  const isOurs = (meta) => meta?.store_id === sale.storeId && meta?.product_id === sale.productId;

  async function deactivate(license) {
    const body = await call('deactivate', { license_key: license.key, instance_id: license.instanceId });
    return body.deactivated === true;
  }

  async function activate(key, instanceName, now) {
    const body = await call('activate', { license_key: key, instance_name: instanceName });
    if (!body.activated) throw new LicenseError('rejected', body.error);
    const license = {
      key,
      instanceId: body.instance.id,
      email: body.meta?.customer_email ?? '',
      status: 'active',
      checkedAt: now,
    };
    if (!isOurs(body.meta)) {
      // Give the seat back to the other product's key; failing that must not hide the real problem.
      await deactivate(license).catch(() => {});
      throw new LicenseError('wrong-product');
    }
    return license;
  }

  /** The license as Lemon Squeezy sees it now: refunded, disabled or expired keys turn invalid. */
  async function validate(license, now) {
    const body = await call('validate', { license_key: license.key, instance_id: license.instanceId });
    return body.valid === true && isOurs(body.meta)
      ? { ...license, status: 'active', checkedAt: now }
      : { ...license, status: 'invalid' };
  }

  return { activate, validate, deactivate };
}
