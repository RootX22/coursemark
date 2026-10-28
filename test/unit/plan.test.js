import assert from 'node:assert/strict';
import { test } from 'node:test';

import { FREE_ACTIVE_COURSES, canStartCourse, hasPro, needsRecheck } from '../../src/core/plan.js';
import { addStudyTime, lastSevenDays, streak } from '../../src/core/stats.js';

const DAY = 24 * 60 * 60 * 1000;

test('free users follow three courses at a time, finished ones do not count', () => {
  const active = { completedAt: null };
  const finished = { completedAt: 5 };
  assert.equal(FREE_ACTIVE_COURSES, 3);
  assert.equal(canStartCourse([active, active, finished], false), true);
  assert.equal(canStartCourse([active, active, active], false), false);
  assert.equal(canStartCourse([active, active, active], true), true);
});

test('Pro lasts thirty days without a successful check and asks for one weekly', () => {
  const license = { status: 'active', checkedAt: 0 };
  assert.equal(hasPro(license, 29 * DAY), true);
  assert.equal(hasPro(license, 30 * DAY), false);
  assert.equal(hasPro({ status: 'invalid', checkedAt: 0 }, 1), false);
  assert.equal(hasPro(undefined, 1), false);
  assert.equal(needsRecheck(license, 6 * DAY), false);
  assert.equal(needsRecheck(license, 7 * DAY), true);
});

test('study time adds up per day', () => {
  const stats = addStudyTime(addStudyTime({}, '2026-10-28', 30), '2026-10-28', 45);
  assert.deepEqual(stats, { '2026-10-28': 75 });
});

test('a streak counts days of at least a minute and survives a today not yet studied', () => {
  const stats = { '2026-10-25': 600, '2026-10-26': 600, '2026-10-27': 600, '2026-10-24': 30 };
  assert.equal(streak(stats, new Date(2026, 9, 27, 12)), 3);
  assert.equal(streak(stats, new Date(2026, 9, 28, 9)), 3);
  assert.equal(streak(stats, new Date(2026, 9, 29, 9)), 0);
  assert.equal(streak({ ...stats, '2026-10-28': 61 }, new Date(2026, 9, 28, 20)), 4);
});

test('the week total covers today and the six days before it', () => {
  const stats = { '2026-10-22': 100, '2026-10-21': 1000, '2026-10-28': 5 };
  assert.equal(lastSevenDays(stats, new Date(2026, 9, 28)), 105);
});
