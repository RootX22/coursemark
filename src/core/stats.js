import { localDay, previousDay } from './time.js';

const STUDY_DAY_MINIMUM = 60; // seconds; opening a video for a moment is not a study day

/** Study time is kept per local day: { "2026-10-28": seconds }. */
export function addStudyTime(stats, day, seconds) {
  return { ...stats, [day]: (stats[day] ?? 0) + seconds };
}

/** Consecutive study days up to today; a streak is not broken until today is over. */
export function streak(stats, today) {
  let day = studied(stats, today) ? today : previousDay(today);
  let count = 0;
  while (studied(stats, day)) {
    count += 1;
    day = previousDay(day);
  }
  return count;
}

/** Seconds studied in the seven days ending today. */
export function lastSevenDays(stats, today) {
  let total = 0;
  let day = today;
  for (let index = 0; index < 7; index += 1) {
    total += stats[localDay(day)] ?? 0;
    day = previousDay(day);
  }
  return total;
}

function studied(stats, date) {
  return (stats[localDay(date)] ?? 0) >= STUDY_DAY_MINIMUM;
}
