// Watched time is a sorted list of non-overlapping [start, end] spans, in seconds.

const JOIN_GAP = 1; // spans this close are one span; timeupdate events leave small holes

/**
 * The spans with [start, end] added. Cases: empty list, before every span, after every span,
 * inside one span, bridging several, touching within JOIN_GAP, and empty or reversed input.
 */
export function addSpan(spans, start, end) {
  if (!(end > start)) return spans;
  const merged = [];
  let next = [start, end];
  for (const span of spans) {
    if (span[1] + JOIN_GAP < next[0]) merged.push(span);
    else if (next[1] + JOIN_GAP < span[0]) {
      merged.push(next);
      next = span;
    } else next = [Math.min(span[0], next[0]), Math.max(span[1], next[1])];
  }
  merged.push(next);
  return merged;
}

/** Seconds of [from, to] covered by the spans. */
export function coveredSeconds(spans, from, to) {
  let total = 0;
  for (const [start, end] of spans) {
    total += Math.max(0, Math.min(end, to) - Math.max(start, from));
  }
  return total;
}
