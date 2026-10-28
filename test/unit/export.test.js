import assert from 'node:assert/strict';
import { test } from 'node:test';

import { BackupError, makeBackup, mergeBackup, readBackup } from '../../src/core/backup.js';
import { addNote, newCourse, recordWatch } from '../../src/core/course.js';
import { courseMarkdown } from '../../src/core/markdown.js';

const words = {
  chapters: 'Chapters',
  notes: 'Notes',
  part: (number) => `Part ${number}`,
  done: (done, total) => `${done} of ${total} chapters done`,
};

function sampleCourse(updatedAt = 10) {
  let course = newCourse(
    { id: 'abcdefghijk', title: 'Docker', channel: 'Teacher', duration: 300, description: '0:00 A\n1:00 B\n2:00 C' },
    1,
  );
  course = recordWatch(course, 0, 60, 2);
  course = addNote(course, 75, 'volumes\noutlive containers', 3);
  return { ...course, updatedAt };
}

test('markdown lists chapters as a checklist and notes as links into the video', () => {
  assert.equal(
    courseMarkdown(sampleCourse(), words),
    [
      '# Docker',
      '',
      'Teacher · 1 of 3 chapters done',
      '',
      '## Chapters',
      '',
      '- [x] [0:00](https://www.youtube.com/watch?v=abcdefghijk&t=0s) A',
      '- [ ] [1:00](https://www.youtube.com/watch?v=abcdefghijk&t=60s) B',
      '- [ ] [2:00](https://www.youtube.com/watch?v=abcdefghijk&t=120s) C',
      '',
      '## Notes',
      '',
      '- [1:15](https://www.youtube.com/watch?v=abcdefghijk&t=75s) volumes',
      '  outlive containers',
      '',
    ].join('\n'),
  );
});

test('a backup reads back to the same courses and study time', () => {
  const course = sampleCourse();
  const text = JSON.stringify(makeBackup([course], { '2026-10-28': 90 }, 5));
  assert.deepEqual(readBackup(text), { courses: [course], stats: { '2026-10-28': 90 } });
});

test('a backup with unknown fields keeps only the known ones', () => {
  const backup = makeBackup([{ ...sampleCourse(), injected: '<img onerror>' }], {}, 5);
  assert.equal('injected' in readBackup(JSON.stringify(backup)).courses[0], false);
});

test('anything that is not a sound backup is refused', () => {
  const good = makeBackup([sampleCourse()], {}, 5);
  const broken = [
    'not json',
    JSON.stringify({ format: 'other', version: 1, courses: [] }),
    JSON.stringify({ ...good, courses: [{ ...sampleCourse(), id: '../../etc' }] }),
    JSON.stringify({ ...good, courses: [{ ...sampleCourse(), duration: -1 }] }),
    JSON.stringify({ ...good, courses: [{ ...sampleCourse(), chapters: [] }] }),
    JSON.stringify({ ...good, courses: [{ ...sampleCourse(), notes: [{ id: 'n', time: 1, text: 5, createdAt: 1 }] }] }),
    JSON.stringify({ ...good, stats: { yesterday: 5 } }),
  ];
  for (const text of broken) assert.throws(() => readBackup(text), BackupError, text.slice(0, 60));
});

test('importing keeps whichever copy of a course is newer and the larger time per day', () => {
  const saved = { courses: [sampleCourse(20)], stats: { '2026-10-27': 100, '2026-10-28': 50 } };
  const older = { courses: [sampleCourse(10)], stats: { '2026-10-28': 80, '2026-10-26': 5 } };
  assert.deepEqual(mergeBackup(saved, older), {
    courses: [],
    stats: { '2026-10-26': 5, '2026-10-27': 100, '2026-10-28': 80 },
  });
  assert.equal(mergeBackup(saved, { courses: [sampleCourse(30)], stats: {} }).courses.length, 1);
});
