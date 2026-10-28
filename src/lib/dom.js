/** h('button', { class: 'x', onclick }, 'text', child): every string becomes a text node, never HTML. */
export function h(tag, attributes = {}, ...children) {
  const element = document.createElement(tag);
  for (const [name, value] of Object.entries(attributes)) {
    if (value === false || value === null || value === undefined) continue;
    if (name.startsWith('on')) element.addEventListener(name.slice(2), value);
    else element.setAttribute(name, value === true ? '' : value);
  }
  element.append(...children.flat().filter((child) => child !== null && child !== false));
  return element;
}

export function downloadFile(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = h('a', { href: url, download: name });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** A file name from a video title, safe on every system. */
export function fileName(title, extension) {
  const base = title
    .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
  return `${base || 'course'}.${extension}`;
}

export function courseUrl(course) {
  return `https://www.youtube.com/watch?v=${course.id}&t=${Math.floor(course.position)}s`;
}

export function percent(fraction) {
  return `${Math.round(fraction * 100)}%`;
}
