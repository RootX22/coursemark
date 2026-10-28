import { isActive, progress } from '../core/course.js';
import { isConfigured } from '../core/license.js';
import { hasPro } from '../core/plan.js';
import { sale } from '../lib/config.js';
import { courseUrl, h, percent } from '../lib/dom.js';
import { ext } from '../lib/ext.js';
import { t } from '../lib/i18n.js';
import { currentLicense, localize, progressBar, statsTiles } from '../lib/page.js';
import * as store from '../lib/store.js';

const SHOWN = 5;

localize(document);
document.getElementById('library').addEventListener('click', () => {
  ext.runtime.openOptionsPage();
  window.close();
});

const now = new Date();
const [license, courses, stats] = await Promise.all([
  currentLicense(now.getTime()),
  store.loadCourses(),
  store.loadStats(),
]);
const pro = hasPro(license, now.getTime());

const plan = document.getElementById('plan');
plan.textContent = pro ? 'Pro' : t('free');
plan.classList.toggle('pro', pro);

if (pro) document.getElementById('stats').replaceChildren(h('div', { class: 'tiles' }, statsTiles(stats, now)));

const buy = document.getElementById('buy');
buy.hidden = pro || !isConfigured(sale);
if (!buy.hidden) buy.href = sale.checkoutUrl;

const active = courses
  .filter(isActive)
  .sort((a, b) => b.updatedAt - a.updatedAt)
  .slice(0, SHOWN);
document.getElementById('empty').hidden = active.length > 0;
document.getElementById('courses').replaceChildren(
  ...active.map((course) => {
    const { done, total, fraction } = progress(course);
    return h(
      'li',
      {},
      h(
        'a',
        { href: courseUrl(course), target: '_blank', rel: 'noopener' },
        h('span', { class: 'title' }, course.title),
        h('span', { class: 'meta' }, `${t('chaptersDone', done, total)} · ${percent(fraction)}`),
        progressBar(fraction),
      ),
    );
  }),
);
