import { courseChapters } from './chapters.js';
import { addSpan, coveredSeconds } from './watched.js';

const DONE_COVERAGE = 0.9;

/** A course is one long video with its chapters, what was watched of it, and notes. */
export function newCourse(video, now) {
  return {
    id: video.id,
    title: video.title,
    channel: video.channel,
    duration: video.duration,
    chapters: courseChapters(video.description, video.duration),
    watched: [],
    marks: {}, // chapter start -> done, set when the learner ticks a chapter by hand
    notes: [],
    position: 0,
    createdAt: now,
    updatedAt: now,
    completedAt: null,
  };
}

export function isChapterDone(course, chapter) {
  const mark = course.marks[chapter.start];
  if (mark !== undefined) return mark;
  const length = chapter.end - chapter.start;
  return coveredSeconds(course.watched, chapter.start, chapter.end) >= length * DONE_COVERAGE;
}

export function progress(course) {
  const done = course.chapters.filter((chapter) => isChapterDone(course, chapter));
  const doneSeconds = done.reduce((sum, chapter) => sum + chapter.end - chapter.start, 0);
  return {
    done: done.length,
    total: course.chapters.length,
    fraction: course.duration > 0 ? doneSeconds / course.duration : 0,
  };
}

export function chapterAt(course, time) {
  return course.chapters.findLast((chapter) => chapter.start <= time) ?? course.chapters[0];
}

export function isActive(course) {
  return course.completedAt === null;
}

export function recordWatch(course, start, end, now) {
  return settle({ ...course, watched: addSpan(course.watched, start, end), position: end }, now);
}

export function toggleChapter(course, chapter, now) {
  const marks = { ...course.marks, [chapter.start]: !isChapterDone(course, chapter) };
  return settle({ ...course, marks }, now);
}

export function addNote(course, time, text, now) {
  const note = { id: crypto.randomUUID(), time, text, createdAt: now };
  const notes = [...course.notes, note].sort((a, b) => a.time - b.time);
  return { ...course, notes, updatedAt: now };
}

export function removeNote(course, noteId, now) {
  return { ...course, notes: course.notes.filter((note) => note.id !== noteId), updatedAt: now };
}

function settle(course, now) {
  const finished = course.chapters.every((chapter) => isChapterDone(course, chapter));
  return { ...course, completedAt: finished ? (course.completedAt ?? now) : null, updatedAt: now };
}
