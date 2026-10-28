import { isChapterDone, progress } from './course.js';
import { formatTime } from './time.js';

/**
 * A course's chapters and notes as Markdown, every time a link back into the video.
 * words: { chapters, notes, part(number), done(done, total) } in the reader's language.
 */
export function courseMarkdown(course, words) {
  const at = (time) => `[${formatTime(time)}](https://www.youtube.com/watch?v=${course.id}&t=${Math.floor(time)}s)`;
  const { done, total } = progress(course);
  const chapters = course.chapters.map((chapter, index) => {
    const box = isChapterDone(course, chapter) ? 'x' : ' ';
    return `- [${box}] ${at(chapter.start)} ${chapter.title ?? words.part(index + 1)}`;
  });
  const notes = course.notes.map((note) => `- ${at(note.time)} ${note.text.replace(/\n/g, '\n  ')}`);
  return [
    `# ${course.title}`,
    '',
    `${course.channel} · ${words.done(done, total)}`,
    '',
    `## ${words.chapters}`,
    '',
    ...chapters,
    ...(notes.length ? ['', `## ${words.notes}`, '', ...notes] : []),
    '',
  ].join('\n');
}
