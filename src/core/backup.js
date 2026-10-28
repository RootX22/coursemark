// A backup file comes from outside the extension, so every field is checked and copied by name.

const FORMAT = 'coursemark-backup';

export class BackupError extends Error {}

export function makeBackup(courses, stats, now) {
  return { format: FORMAT, version: 1, exportedAt: now, courses, stats };
}

/** The courses and study time in a backup file's text; throws BackupError if it is not one. */
export function readBackup(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new BackupError('not JSON');
  }
  if (parsed?.format !== FORMAT || parsed.version !== 1) throw new BackupError('not a Coursemark backup');
  if (!Array.isArray(parsed.courses)) throw new BackupError('no courses');
  return { courses: parsed.courses.map(readCourse), stats: readStats(parsed.stats ?? {}) };
}

/** What to write: imported courses newer than the saved ones, and the larger time for each day. */
export function mergeBackup(saved, imported) {
  const savedById = new Map(saved.courses.map((course) => [course.id, course]));
  const courses = imported.courses.filter((course) => {
    const current = savedById.get(course.id);
    return !current || current.updatedAt < course.updatedAt;
  });
  const stats = { ...saved.stats };
  for (const [day, seconds] of Object.entries(imported.stats)) {
    stats[day] = Math.max(stats[day] ?? 0, seconds);
  }
  return { courses, stats };
}

function readCourse(raw) {
  check(/^[\w-]{11}$/.test(raw?.id), 'course id');
  check(Array.isArray(raw.chapters) && raw.chapters.length > 0, 'chapters');
  return {
    id: raw.id,
    title: text(raw.title),
    channel: text(raw.channel),
    duration: seconds(raw.duration),
    chapters: raw.chapters.map((chapter) => ({
      start: seconds(chapter?.start),
      end: seconds(chapter.end),
      title: chapter.title === null ? null : text(chapter.title),
    })),
    watched: list(raw.watched).map((span) => [seconds(span?.[0]), seconds(span?.[1])]),
    marks: readMarks(raw.marks ?? {}),
    notes: list(raw.notes).map((note) => ({
      id: text(note?.id),
      time: seconds(note.time),
      text: text(note.text),
      createdAt: seconds(note.createdAt),
    })),
    position: seconds(raw.position),
    createdAt: seconds(raw.createdAt),
    updatedAt: seconds(raw.updatedAt),
    completedAt: raw.completedAt === null ? null : seconds(raw.completedAt),
  };
}

function readMarks(raw) {
  check(typeof raw === 'object' && !Array.isArray(raw), 'marks');
  return Object.fromEntries(
    Object.entries(raw).map(([start, done]) => {
      check(typeof done === 'boolean' && Number.isFinite(Number(start)), 'mark');
      return [start, done];
    }),
  );
}

function readStats(raw) {
  check(typeof raw === 'object' && !Array.isArray(raw), 'stats');
  return Object.fromEntries(
    Object.entries(raw).map(([day, value]) => {
      check(/^\d{4}-\d{2}-\d{2}$/.test(day), 'stats day');
      return [day, seconds(value)];
    }),
  );
}

function check(condition, field) {
  if (!condition) throw new BackupError(`bad ${field}`);
}

function text(value) {
  check(typeof value === 'string', 'text');
  return value;
}

function seconds(value) {
  check(Number.isFinite(value) && value >= 0, 'number');
  return value;
}

function list(value) {
  check(Array.isArray(value), 'list');
  return value;
}
