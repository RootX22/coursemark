import { addStudyTime } from '../core/stats.js';
import { ext } from './ext.js';

// Everything lives in storage.local: "course:<video id>" per course, plus "stats", "license", "ui".
const COURSE = 'course:';
const local = ext.storage.local;

async function read(key, fallback) {
  return (await local.get(key))[key] ?? fallback;
}

export const loadCourse = (id) => read(COURSE + id, null);
export const saveCourse = (course) => local.set({ [COURSE + course.id]: course });
export const deleteCourse = (id) => local.remove(COURSE + id);

export async function loadCourses() {
  const everything = await local.get(null);
  return Object.entries(everything)
    .filter(([key]) => key.startsWith(COURSE))
    .map(([, course]) => course);
}

export const loadStats = () => read('stats', {});
export const saveStats = (stats) => local.set({ stats });

export async function addStudy(day, seconds) {
  await saveStats(addStudyTime(await loadStats(), day, seconds));
}

export const loadLicense = () => read('license', null);
export const saveLicense = (license) => local.set({ license });
export const clearLicense = () => local.remove('license');

export const loadUi = () => read('ui', { collapsed: false });
export const saveUi = (ui) => local.set({ ui });

/** handlers: { course(id, course or undefined), license(), stats() }, each one optional. */
export function onChange(handlers) {
  ext.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    for (const [key, change] of Object.entries(changes)) {
      if (key.startsWith(COURSE)) handlers.course?.(key.slice(COURSE.length), change.newValue);
      else handlers[key]?.();
    }
  });
}
