import { parseTime } from './time.js';

const TIMESTAMP = /(?<![\d:])(\d{1,3}(?::\d{2}){1,2})(?![\d:])/;
const EDGE_PUNCTUATION = /^[\s\-–—:|•·.,)\]]+|[\s\-–—:|•·.,([]+$/g;
const MIN_CHAPTERS = 3; // YouTube's own rule for description chapters
const PART_LENGTH = 600;

/**
 * Chapters the way YouTube builds them from a description: a list of lines that each carry a
 * timestamp, starting at 0:00 and increasing, at least three long. Returns null when the
 * description has no such list.
 */
export function chaptersFromDescription(description, duration) {
  const runs = [];
  let run = null;
  for (const line of description.split('\n')) {
    const entry = parseLine(line);
    if (!entry) continue;
    if (entry.start === 0) {
      run = [entry];
      runs.push(run);
    } else if (run && entry.start > run.at(-1).start) {
      run.push(entry);
    } else {
      run = null;
    }
  }
  const found = runs
    .map((candidate) => candidate.filter((entry) => entry.start < duration))
    .find((candidate) => candidate.length >= MIN_CHAPTERS);
  return found ? withEnds(found, duration) : null;
}

/** Roughly ten-minute parts, so a video without chapters can still be tracked. */
export function evenParts(duration) {
  const count = Math.max(1, Math.round(duration / PART_LENGTH));
  const starts = Array.from({ length: count }, (_, index) => Math.round((index * duration) / count));
  return withEnds(
    starts.map((start) => ({ start, title: null })),
    duration,
  );
}

export function courseChapters(description, duration) {
  return chaptersFromDescription(description, duration) ?? evenParts(duration);
}

function parseLine(line) {
  const match = TIMESTAMP.exec(line);
  const start = match && parseTime(match[1]);
  if (start === null) return null;
  const rest = (line.slice(0, match.index) + ' ' + line.slice(match.index + match[1].length))
    .replace(/[([]\s*[)\]]/g, ' ')
    .replace(EDGE_PUNCTUATION, '')
    .replace(/\s{2,}/g, ' ');
  return { start, title: rest || null };
}

function withEnds(entries, duration) {
  return entries.map((entry, index) => ({
    start: entry.start,
    end: entries[index + 1]?.start ?? duration,
    title: entry.title,
  }));
}

/** How a video would be studied: by its own chapters, or by even parts when it has none. */
export function chapterCount(description, duration) {
  const chapters = chaptersFromDescription(description, duration);
  return chapters ? { chapters: chapters.length, parts: 0 } : { chapters: 0, parts: evenParts(duration).length };
}
