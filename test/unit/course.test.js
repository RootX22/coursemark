import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  addNote,
  chapterAt,
  isChapterDone,
  newCourse,
  progress,
  recordWatch,
  removeNote,
  toggleChapter,
} from '../../src/core/course.js';
import { addSpan, coveredSeconds } from '../../src/core/watched.js';

const video = {
  id: 'abcdefghijk',
  title: 'Full course',
  channel: 'Teacher',
  duration: 400,
  description: '0:00 One\n1:40 Two\n3:20 Three',
};

test('spans merge when they overlap or nearly touch and stay apart otherwise', () => {
  assert.deepEqual(addSpan([], 5, 10), [[5, 10]]);
  assert.deepEqual(addSpan([[20, 30]], 5, 10), [
    [5, 10],
    [20, 30],
  ]);
  assert.deepEqual(addSpan([[5, 10]], 20, 30), [
    [5, 10],
    [20, 30],
  ]);
  assert.deepEqual(addSpan([[5, 10]], 10.5, 12), [[5, 12]]);
  assert.deepEqual(
    addSpan(
      [
        [5, 10],
        [20, 30],
        [40, 50],
      ],
      8,
      45,
    ),
    [[5, 50]],
  );
  assert.deepEqual(addSpan([[5, 50]], 10, 20), [[5, 50]]);
  assert.deepEqual(addSpan([[5, 10]], 12, 12), [[5, 10]]);
  assert.deepEqual(addSpan([[5, 10]], 12, 11), [[5, 10]]);
});

test('covered seconds count only the part inside the range', () => {
  assert.equal(
    coveredSeconds(
      [
        [0, 10],
        [20, 30],
      ],
      5,
      25,
    ),
    10,
  );
  assert.equal(coveredSeconds([], 0, 100), 0);
});

test('a chapter is done once 90% of it was watched', () => {
  let course = newCourse(video, 1);
  course = recordWatch(course, 0, 89, 2);
  assert.equal(isChapterDone(course, course.chapters[0]), false);
  course = recordWatch(course, 89, 90, 3);
  assert.equal(isChapterDone(course, course.chapters[0]), true);
  assert.deepEqual(progress(course), { done: 1, total: 3, fraction: 0.25 });
  assert.equal(course.position, 90);
});

test('skipping through a chapter does not finish it', () => {
  let course = newCourse(video, 1);
  course = recordWatch(course, 100, 120, 2);
  course = recordWatch(course, 180, 199, 3);
  assert.equal(isChapterDone(course, course.chapters[1]), false);
});

test("a ticked or unticked chapter keeps the learner's choice over what was watched", () => {
  let course = newCourse(video, 1);
  course = toggleChapter(course, course.chapters[2], 2);
  assert.equal(isChapterDone(course, course.chapters[2]), true);
  course = recordWatch(course, 0, 100, 3);
  course = toggleChapter(course, course.chapters[0], 4);
  course = recordWatch(course, 0, 100, 5);
  assert.equal(isChapterDone(course, course.chapters[0]), false);
});

test('the course completes when every chapter is done and reopens when one is unticked', () => {
  let course = newCourse(video, 1);
  course = recordWatch(course, 0, 400, 7);
  assert.equal(course.completedAt, 7);
  course = recordWatch(course, 0, 10, 8);
  assert.equal(course.completedAt, 7, 'finishing again keeps the first date');
  course = toggleChapter(course, course.chapters[1], 9);
  assert.equal(course.completedAt, null);
});

test('notes stay in video order and can be removed', () => {
  let course = newCourse(video, 1);
  course = addNote(course, 300, 'later', 2);
  course = addNote(course, 20, 'earlier', 3);
  assert.deepEqual(
    course.notes.map((note) => note.text),
    ['earlier', 'later'],
  );
  course = removeNote(course, course.notes[0].id, 4);
  assert.deepEqual(
    course.notes.map((note) => note.text),
    ['later'],
  );
  assert.equal(course.updatedAt, 4);
});

test('the chapter at a time is the last one that started', () => {
  const course = newCourse(video, 1);
  assert.equal(chapterAt(course, 0).title, 'One');
  assert.equal(chapterAt(course, 100).title, 'Two');
  assert.equal(chapterAt(course, 399).title, 'Three');
});
