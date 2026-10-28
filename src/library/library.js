import { BackupError, makeBackup, mergeBackup, readBackup } from '../core/backup.js';
import { isActive, progress } from '../core/course.js';
import { LicenseError, isConfigured, lemonSqueezy } from '../core/license.js';
import { courseMarkdown } from '../core/markdown.js';
import { FREE_ACTIVE_COURSES, hasPro } from '../core/plan.js';
import { localDay } from '../core/time.js';
import { sale } from '../lib/config.js';
import { askToSendLicense, maySendLicense } from '../lib/consent.js';
import { courseUrl, downloadFile, fileName, h } from '../lib/dom.js';
import { exportWords, t } from '../lib/i18n.js';
import { currentLicense, localize, progressBar, statsTiles } from '../lib/page.js';
import * as store from '../lib/store.js';

let filter = 'active';
let state = { courses: [], stats: {}, license: null, pro: false };
let shownLicense = '';

localize(document);
for (const button of document.querySelectorAll('[data-filter]')) {
  button.addEventListener('click', () => {
    filter = button.dataset.filter;
    renderCourses();
  });
}
document.getElementById('export').addEventListener('click', exportBackup);
document.getElementById('import').addEventListener('change', importBackup);
store.onChange({ course: load, license: load, stats: load });
await load();

async function load() {
  const now = Date.now();
  const [license, courses, stats] = await Promise.all([currentLicense(now), store.loadCourses(), store.loadStats()]);
  state = { courses, stats, license, pro: hasPro(license, now) };
  render();
}

function render() {
  const plan = document.getElementById('plan');
  plan.textContent = state.pro ? 'Pro' : t('free');
  plan.classList.toggle('pro', state.pro);
  // Courses are saved every few seconds while a video plays; keep a half-typed key where it is.
  const license = JSON.stringify([state.pro, state.license]);
  if (license !== shownLicense) {
    shownLicense = license;
    document.getElementById('pro').replaceChildren(...proSection());
  }
  document
    .getElementById('stats')
    .replaceChildren(
      state.pro
        ? h('div', { class: 'tiles' }, statsTiles(state.stats, new Date()))
        : h('p', { class: 'muted' }, t('statsTeaser')),
    );
  document.getElementById('export').disabled = !state.pro;
  document.getElementById('import').disabled = !state.pro;
  document.getElementById('import-label').setAttribute('aria-disabled', String(!state.pro));
  renderCourses();
}

function proSection() {
  const heading = h('h2', {}, 'Coursemark Pro');
  if (state.pro) {
    return [
      heading,
      h('p', {}, t('proActive')),
      state.license.email ? h('p', { class: 'muted' }, state.license.email) : null,
      removeProButton(),
    ];
  }
  if (!isConfigured(sale)) return [heading, h('p', { class: 'muted' }, t('salesNotConfigured'))];
  return [
    heading,
    state.license?.status === 'invalid' ? h('p', { class: 'error' }, t('licenseInvalid')) : null,
    h(
      'ul',
      { class: 'benefits' },
      h('li', {}, t('benefitCourses', FREE_ACTIVE_COURSES)),
      h('li', {}, t('benefitStats')),
      h('li', {}, t('benefitBackup')),
    ),
    h('a', { class: 'button primary', href: sale.checkoutUrl, target: '_blank', rel: 'noopener' }, t('getPro')),
    keyForm(),
  ];
}

function keyForm() {
  const input = h('input', {
    type: 'text',
    placeholder: t('licenseKey'),
    'aria-label': t('licenseKey'),
    autocomplete: 'off',
    spellcheck: 'false',
  });
  const submit = h('button', { type: 'submit' }, t('activate'));
  const error = h('p', { class: 'error', role: 'alert', hidden: true });
  const form = h('form', { class: 'key-form' }, input, submit);
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const key = input.value.trim();
    if (!key) return;
    const consent = askToSendLicense();
    submit.disabled = true;
    error.hidden = true;
    try {
      if (!(await consent)) {
        error.textContent = t('licenseNeedsConsent');
        error.hidden = false;
        return;
      }
      await store.saveLicense(await lemonSqueezy(sale).activate(key, instanceName(), Date.now()));
    } catch (failure) {
      if (!(failure instanceof LicenseError)) throw failure;
      error.textContent = licenseMessage(failure);
      error.hidden = false;
    } finally {
      submit.disabled = false;
    }
  });
  return h('div', {}, form, error);
}

function removeProButton() {
  const error = h('p', { class: 'error', role: 'alert', hidden: true });
  const button = h('button', { type: 'button' }, t('removePro'));
  button.addEventListener('click', async () => {
    button.disabled = true;
    try {
      // Without consent to contact the server the seat stays taken; the buyer can free it from their receipt.
      if (await maySendLicense()) await lemonSqueezy(sale).deactivate(state.license);
      await store.clearLicense();
    } catch (failure) {
      if (!(failure instanceof LicenseError)) throw failure;
      error.textContent = licenseMessage(failure);
      error.hidden = false;
      button.disabled = false;
    }
  });
  return h('div', {}, button, error);
}

function licenseMessage(failure) {
  if (failure.code === 'wrong-product') return t('licenseWrongProduct');
  if (failure.code === 'unreachable') return t('licenseUnreachable');
  return t('licenseRejected', failure.message);
}

/** How this browser shows up in the buyer's list of activations on Lemon Squeezy. */
function instanceName() {
  return `Coursemark on ${navigator.userAgent.includes('Firefox/') ? 'Firefox' : 'Chrome'}`;
}

function renderCourses() {
  for (const button of document.querySelectorAll('[data-filter]')) {
    button.setAttribute('aria-pressed', String(button.dataset.filter === filter));
  }
  const shown = state.courses
    .filter((course) => isActive(course) === (filter === 'active'))
    .sort((a, b) => b.updatedAt - a.updatedAt);
  const empty = document.getElementById('empty');
  empty.hidden = shown.length > 0;
  empty.textContent = t(filter === 'active' ? 'emptyActive' : 'emptyFinished');
  document.getElementById('courses').replaceChildren(...shown.map(courseCard));
}

function courseCard(course) {
  const { done, total, fraction } = progress(course);
  const exportNotes = () =>
    downloadFile(fileName(course.title, 'md'), courseMarkdown(course, exportWords()), 'text/markdown');
  const remove = () => {
    if (confirm(t('confirmDelete', course.title))) store.deleteCourse(course.id);
  };
  return h(
    'li',
    { class: 'course' },
    h('a', { class: 'title', href: courseUrl(course), target: '_blank', rel: 'noopener' }, course.title),
    h(
      'div',
      { class: 'meta' },
      [course.channel, t('chaptersDone', done, total), t('noteCount', course.notes.length)].join(' · '),
    ),
    progressBar(fraction),
    h(
      'div',
      { class: 'actions' },
      h('button', { type: 'button', onclick: exportNotes }, t('exportNotes')),
      h('button', { type: 'button', class: 'danger', onclick: remove }, t('deleteCourse')),
    ),
  );
}

function exportBackup() {
  const backup = makeBackup(state.courses, state.stats, Date.now());
  downloadFile(`coursemark-backup-${localDay(new Date())}.json`, JSON.stringify(backup, null, 2), 'application/json');
}

async function importBackup(event) {
  const [file] = event.target.files;
  event.target.value = '';
  if (!file) return;
  const status = document.getElementById('backup-status');
  try {
    const merged = mergeBackup(state, readBackup(await file.text()));
    await Promise.all(merged.courses.map(store.saveCourse));
    await store.saveStats(merged.stats);
    status.textContent = t('importDone', merged.courses.length);
  } catch (failure) {
    if (!(failure instanceof BackupError)) throw failure;
    status.textContent = t('importFailed', failure.message);
  }
}
