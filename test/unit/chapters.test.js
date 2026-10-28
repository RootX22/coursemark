import assert from 'node:assert/strict';
import { test } from 'node:test';

import { chapterCount, chaptersFromDescription, courseChapters, evenParts } from '../../src/core/chapters.js';
import { formatTime, localDay, parseTime } from '../../src/core/time.js';

test('times are written and read the way YouTube writes them', () => {
  assert.equal(formatTime(0), '0:00');
  assert.equal(formatTime(754.9), '12:34');
  assert.equal(formatTime(3723), '1:02:03');
  assert.equal(parseTime('12:34'), 754);
  assert.equal(parseTime('1:02:03'), 3723);
  assert.equal(parseTime('00:00:00'), 0);
  for (const bad of ['12', '1:2', '1:60', '1:61:00', 'a:00', '']) assert.equal(parseTime(bad), null, bad);
});

test('local day keys use the calendar date where the learner is', () => {
  assert.equal(localDay(new Date(2026, 0, 5, 23, 59)), '2026-01-05');
});

test('a description list of timestamps becomes chapters ending where the next begins', () => {
  const description = [
    'Learn the whole stack.',
    '',
    'Timestamps:',
    '0:00 Intro',
    '(2:30) Setting up - ',
    'Docker basics - 10:05',
    '⌨️ (1:00:00) Deploying',
    '',
    'Follow me on social media.',
  ].join('\n');
  assert.deepEqual(chaptersFromDescription(description, 4000), [
    { start: 0, end: 150, title: 'Intro' },
    { start: 150, end: 605, title: 'Setting up' },
    { start: 605, end: 3600, title: 'Docker basics' },
    { start: 3600, end: 4000, title: '⌨️ Deploying' },
  ]);
});

test('a list must start at 0:00, keep increasing and have three entries', () => {
  assert.equal(chaptersFromDescription('1:00 a\n2:00 b\n3:00 c', 600), null);
  assert.equal(chaptersFromDescription('0:00 a\n2:00 b', 600), null);
  assert.equal(chaptersFromDescription('Live at 20:00 tonight', 600), null);
});

test('a broken list is skipped and a later valid one is used', () => {
  const description = '0:00 a\n5:00 b\n3:00 c\n\n0:00 Intro\n1:00 Middle\n2:00 End';
  assert.deepEqual(
    chaptersFromDescription(description, 300).map((chapter) => chapter.title),
    ['Intro', 'Middle', 'End'],
  );
});

test('timestamps past the end of the video are dropped', () => {
  const chapters = chaptersFromDescription('0:00 a\n1:00 b\n2:00 c\n9:00 d', 200);
  assert.deepEqual(chapters.at(-1), { start: 120, end: 200, title: 'c' });
});

test('a line with only a timestamp gives an untitled chapter', () => {
  assert.equal(chaptersFromDescription('0:00\n1:00 b\n2:00 c', 200)[0].title, null);
});

test('without chapters a video is split into roughly ten-minute parts', () => {
  assert.deepEqual(evenParts(300), [{ start: 0, end: 300, title: null }]);
  const parts = evenParts(3600);
  assert.equal(parts.length, 6);
  assert.deepEqual(parts[1], { start: 600, end: 1200, title: null });
  assert.equal(parts.at(-1).end, 3600);
  assert.equal(courseChapters('no timestamps here', 1300).length, 2);
});

test('the count says whether a video has its own chapters or will be split into parts', () => {
  assert.deepEqual(chapterCount('0:00 a\n1:00 b\n2:00 c', 300), { chapters: 3, parts: 0 });
  assert.deepEqual(chapterCount('', 1800), { chapters: 0, parts: 3 });
});
