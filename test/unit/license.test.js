import assert from 'node:assert/strict';
import { test } from 'node:test';

import { LicenseError, isConfigured, lemonSqueezy } from '../../src/core/license.js';

const sale = { storeId: 11, productId: 22, checkoutUrl: 'https://example.lemonsqueezy.com/buy/x' };
const ours = { store_id: 11, product_id: 22, customer_email: 'learner@example.com' };

/** A stand-in for Lemon Squeezy that answers each action from a table and records the calls. */
function fakeApi(answers) {
  const calls = [];
  const fetchFn = async (url, init) => {
    const action = url.split('/').pop();
    calls.push({ action, fields: Object.fromEntries(init.body) });
    const answer = answers[action];
    if (answer instanceof Error) throw answer;
    return {
      status: answer.status ?? 200,
      json: async () => (typeof answer.body === 'string' ? JSON.parse(answer.body) : answer.body),
    };
  };
  return { calls, client: lemonSqueezy(sale, fetchFn) };
}

test('activating our key records the instance and when it was checked', async () => {
  const { calls, client } = fakeApi({
    activate: { body: { activated: true, instance: { id: 'inst-1' }, meta: ours } },
  });
  const license = await client.activate('KEY-1', 'Coursemark on Chrome', 1000);
  assert.deepEqual(license, {
    key: 'KEY-1',
    instanceId: 'inst-1',
    email: 'learner@example.com',
    status: 'active',
    checkedAt: 1000,
  });
  assert.deepEqual(calls, [
    { action: 'activate', fields: { license_key: 'KEY-1', instance_name: 'Coursemark on Chrome' } },
  ]);
});

test('a key Lemon Squeezy rejects reports its reason', async () => {
  const { client } = fakeApi({
    activate: { status: 404, body: { activated: false, error: 'license_key not found.' } },
  });
  await assert.rejects(client.activate('NOPE', 'x', 1), { code: 'rejected', message: 'license_key not found.' });
});

test('a key from another store is refused and its seat given back', async () => {
  const { calls, client } = fakeApi({
    activate: { body: { activated: true, instance: { id: 'inst-9' }, meta: { store_id: 99, product_id: 22 } } },
    deactivate: { body: { deactivated: true } },
  });
  await assert.rejects(client.activate('OTHER', 'x', 1), { code: 'wrong-product' });
  assert.deepEqual(calls.at(-1), { action: 'deactivate', fields: { license_key: 'OTHER', instance_id: 'inst-9' } });
});

test('validation keeps Pro for a valid key and drops it for a refunded or disabled one', async () => {
  const license = { key: 'K', instanceId: 'i', email: '', status: 'active', checkedAt: 1 };
  const valid = fakeApi({ validate: { body: { valid: true, meta: ours } } });
  assert.deepEqual(await valid.client.validate(license, 50), { ...license, checkedAt: 50 });
  const refunded = fakeApi({ validate: { body: { valid: false, error: 'disabled', meta: ours } } });
  assert.deepEqual(await refunded.client.validate(license, 50), { ...license, status: 'invalid' });
});

test('outages and rate limits are unreachable, never a verdict on the key', async () => {
  const license = { key: 'K', instanceId: 'i', status: 'active', checkedAt: 1 };
  for (const answer of [new TypeError('Failed to fetch'), { status: 503, body: '<html>' }, { status: 429, body: {} }]) {
    const { client } = fakeApi({ validate: answer });
    await assert.rejects(
      client.validate(license, 2),
      (error) => error instanceof LicenseError && error.code === 'unreachable',
    );
  }
});

test('sales are configured only with a store, a product and a checkout link', () => {
  assert.equal(isConfigured(sale), true);
  assert.equal(isConfigured({ ...sale, storeId: null }), false);
});
