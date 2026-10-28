import { LicenseError, isConfigured, lemonSqueezy } from '../core/license.js';
import { needsRecheck } from '../core/plan.js';
import { lastSevenDays, streak } from '../core/stats.js';
import { localDay } from '../core/time.js';
import { sale } from './config.js';
import { maySendLicense } from './consent.js';
import { h } from './dom.js';
import { t, textDirection } from './i18n.js';
import * as store from './store.js';

/** Fills every [data-i18n] element with its message and sets the page's language direction. */
export function localize(root) {
  document.documentElement.dir = textDirection();
  document.documentElement.lang = t('@@ui_locale').replace('_', '-');
  for (const element of root.querySelectorAll('[data-i18n]')) element.textContent = t(element.dataset.i18n);
}

/** The saved license, re-checked with Lemon Squeezy once a week; offline, the saved one stands. */
export async function currentLicense(now) {
  const license = await store.loadLicense();
  if (!needsRecheck(license, now) || !isConfigured(sale) || !(await maySendLicense())) return license;
  try {
    const checked = await lemonSqueezy(sale).validate(license, now);
    await store.saveLicense(checked);
    return checked;
  } catch (error) {
    if (error instanceof LicenseError && error.code === 'unreachable') return license;
    throw error;
  }
}

export function duration(seconds) {
  const minutes = Math.round(seconds / 60);
  return minutes >= 60 ? t('hoursMinutes', Math.floor(minutes / 60), minutes % 60) : t('minutesOnly', minutes);
}

export function statsTiles(stats, now) {
  const tile = (value, label) => h('div', { class: 'tile' }, h('strong', {}, value), h('span', {}, label));
  return [
    tile(duration(stats[localDay(now)] ?? 0), t('today')),
    tile(t('days', streak(stats, now)), t('streak')),
    tile(duration(lastSevenDays(stats, now)), t('lastSevenDays')),
  ];
}

export function progressBar(fraction) {
  const fill = h('span');
  fill.style.width = `${Math.round(fraction * 100)}%`;
  return h('div', { class: 'bar' }, fill);
}
