/** 0 -> "0:00", 754 -> "12:34", 3723 -> "1:02:03", the way YouTube writes times. */
export function formatTime(seconds) {
  const whole = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor((whole % 3600) / 60);
  const secs = String(whole % 60).padStart(2, '0');
  return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${secs}` : `${minutes}:${secs}`;
}

/** "12:34" -> 754, "1:02:03" -> 3723; anything else -> null. */
export function parseTime(text) {
  const match = /^(?:(\d{1,3}):)?(\d{1,3}):(\d{2})$/.exec(text);
  if (!match) return null;
  const [, hours, minutes, secs] = match;
  if (Number(secs) > 59 || (hours !== undefined && Number(minutes) > 59)) return null;
  return Number(hours ?? 0) * 3600 + Number(minutes) * 60 + Number(secs);
}

/** The local calendar day, "2026-10-28", used to key study time. */
export function localDay(date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export function previousDay(date) {
  const earlier = new Date(date);
  earlier.setDate(earlier.getDate() - 1);
  return earlier;
}
