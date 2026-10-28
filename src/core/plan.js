import { isActive } from './course.js';

export const FREE_ACTIVE_COURSES = 3;
const DAY = 24 * 60 * 60 * 1000;
const RECHECK_AFTER = 7 * DAY;
const OFFLINE_GRACE = 30 * DAY; // a laptop on a long flight keeps Pro

export function hasPro(license, now) {
  return license?.status === 'active' && now - license.checkedAt < OFFLINE_GRACE;
}

export function needsRecheck(license, now) {
  return license?.status === 'active' && now - license.checkedAt >= RECHECK_AFTER;
}

/** Free users follow a few courses at a time; finished courses do not count. */
export function canStartCourse(courses, pro) {
  return pro || courses.filter(isActive).length < FREE_ACTIVE_COURSES;
}
