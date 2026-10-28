import { chapterCount } from '../core/chapters.js';
import {
  addNote,
  chapterAt,
  isChapterDone,
  newCourse,
  progress,
  recordWatch,
  removeNote,
  toggleChapter,
} from '../core/course.js';
import { courseMarkdown } from '../core/markdown.js';
import { canStartCourse, hasPro } from '../core/plan.js';
import { localDay } from '../core/time.js';
import { downloadFile, fileName } from '../lib/dom.js';
import { exportWords, t } from '../lib/i18n.js';
import * as store from '../lib/store.js';
import { createPanel } from './panel.js';

const SAVE_DELAY_MS = 3000;
const MAX_STEP = 3; // seconds of video between two timeupdates at 1x; more than that was a jump
const RESUME_GAP = 30;
const PLACE_CHECK_MS = 1000;
const VIDEO_ID = /^[\w-]{11}$/;

let video = null; // what the page bridge reported for this watch page
let course = null; // the saved course for it, once the learner studies it
let canStart = true;
let ui = { collapsed: false };
let player = null; // the <video> element being followed
let stretchStart = null; // where the current run of uninterrupted playback began
let unsavedStudy = 0; // seconds studied since the last save
let saveTimer = null;
let placeTimer = null;

const panel = createPanel({
  start,
  toggle: (chapter) => change(toggleChapter(course, chapter, Date.now())),
  seek,
  addNote: (time, text) => change(addNote(course, time, text, Date.now())),
  removeNote: (id) => change(removeNote(course, id, Date.now())),
  exportNotes,
  resume: () => seek(course.position),
  collapse,
  currentTime: () => player?.currentTime ?? 0,
});

window.addEventListener('message', (event) => {
  if (event.source === window && event.data?.coursemark === 'video' && isVideo(event.data.video)) {
    show(event.data.video);
  }
});
document.addEventListener('yt-navigate-finish', () => {
  if (!watchId()) leave();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) flush();
});
window.addEventListener('pagehide', flush);
new MutationObserver(render).observe(document.documentElement, { attributeFilter: ['dark'] });
store.onChange({ course: courseChanged, license: refreshPlan });
store.loadUi().then((saved) => {
  ui = saved;
  window.postMessage({ coursemark: 'ask' }, location.origin);
});

function watchId() {
  return new URLSearchParams(location.search).get('v');
}

/** The bridge runs in the page's world, so its message is checked like any input from a page. */
function isVideo(candidate) {
  return (
    VIDEO_ID.test(candidate?.id) &&
    candidate.id === watchId() &&
    typeof candidate.title === 'string' &&
    typeof candidate.channel === 'string' &&
    typeof candidate.description === 'string' &&
    Number.isFinite(candidate.duration)
  );
}

async function show(next) {
  if (video?.id === next.id) return;
  await flush();
  if (next.live || next.duration <= 0) {
    leave();
    return;
  }
  video = next;
  const saved = await store.loadCourse(next.id);
  if (video?.id !== next.id) return; // the learner moved on while storage answered
  course = saved;
  clearInterval(placeTimer);
  placeTimer = setInterval(keepInPlace, PLACE_CHECK_MS);
  await refreshPlan();
}

function leave() {
  flush();
  clearInterval(placeTimer);
  video = null;
  course = null;
  panel.remove();
}

async function refreshPlan() {
  const [license, courses] = await Promise.all([store.loadLicense(), store.loadCourses()]);
  canStart = canStartCourse(courses, hasPro(license, Date.now()));
  render();
}

function courseChanged(id, saved) {
  if (id === video?.id) {
    // Our own saves come back here too; only a newer copy (another tab, an import) or a deletion counts.
    if (saved && course && saved.updatedAt <= course.updatedAt) return;
    course = saved ?? null;
  }
  refreshPlan();
}

function render() {
  if (!video) return;
  keepInPlace();
  panel.render(view());
}

/**
 * YouTube can report the video before it has built the columns or the player around it, and it
 * rebuilds the columns when the window is resized, so this runs again every second.
 */
function keepInPlace() {
  follow(document.querySelector('#movie_player video'));
  panel.mount(mountPoint());
}

function view() {
  const time = player?.currentTime ?? 0;
  const common = { collapsed: ui.collapsed, dark: document.documentElement.hasAttribute('dark') };
  if (!course) {
    const { chapters, parts } = chapterCount(video.description, video.duration);
    return { ...common, state: canStart ? 'idle' : 'limit', chapters, parts };
  }
  return {
    ...common,
    state: 'studying',
    progress: progress(course),
    chapters: course.chapters.map((chapter, index) => ({
      ...chapter,
      label: chapter.title ?? t('partNumber', index + 1),
      done: isChapterDone(course, chapter),
    })),
    current: chapterAt(course, time).start,
    time,
    notes: course.notes,
    resumeAt: course.position - time > RESUME_GAP ? course.position : null,
  };
}

/** Beside the video when YouTube shows two columns, under it when the window is narrow. */
function mountPoint() {
  const page = document.querySelector('ytd-watch-flexy');
  const side = page?.hasAttribute('is-two-columns_') && page.querySelector('#secondary-inner');
  return side || page?.querySelector('#below') || null;
}

function follow(element) {
  if (!element || element === player) return;
  player = element;
  element.addEventListener('timeupdate', onTime);
  element.addEventListener('playing', () => (stretchStart = counting() ? element.currentTime : null));
  element.addEventListener('seeking', () => (stretchStart = null));
  element.addEventListener('pause', () => {
    stretchStart = null;
    flush();
  });
}

/** Watching counts only while the course's own video plays: not an ad, not a seek, not paused. */
function counting() {
  const ad = document.getElementById('movie_player')?.classList.contains('ad-showing');
  return Boolean(course) && !player.paused && !player.seeking && !ad && Math.abs(player.duration - course.duration) < 3;
}

function onTime(event) {
  if (event.target !== player || !video) return;
  const now = player.currentTime;
  if (stretchStart !== null && counting()) {
    const step = now - stretchStart;
    const rate = player.playbackRate || 1;
    if (step > 0 && step <= MAX_STEP * rate) record(stretchStart, now, step / rate);
  }
  stretchStart = counting() ? now : null;
  panel.tick(course ? chapterAt(course, now).start : null, now);
}

function record(from, to, studied) {
  const doneBefore = progress(course).done;
  course = recordWatch(course, from, to, Date.now());
  unsavedStudy += studied;
  if (!saveTimer) saveTimer = setTimeout(flush, SAVE_DELAY_MS);
  if (progress(course).done !== doneBefore) render();
}

async function flush() {
  clearTimeout(saveTimer);
  saveTimer = null;
  if (!course) return;
  const studied = unsavedStudy;
  unsavedStudy = 0;
  await store.saveCourse(course);
  if (studied > 0) await store.addStudy(localDay(new Date()), studied);
}

async function start() {
  await refreshPlan();
  if (!canStart || !video) return;
  course = newCourse(video, Date.now());
  stretchStart = null;
  await store.saveCourse(course);
  render();
}

function change(updated) {
  course = updated;
  flush();
  render();
}

function seek(time) {
  if (player) player.currentTime = time;
}

function exportNotes() {
  downloadFile(fileName(course.title, 'md'), courseMarkdown(course, exportWords()), 'text/markdown');
}

async function collapse() {
  ui = { ...ui, collapsed: !ui.collapsed };
  await store.saveUi(ui);
  render();
}
