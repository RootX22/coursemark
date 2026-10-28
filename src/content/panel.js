import { FREE_ACTIVE_COURSES } from '../core/plan.js';
import { formatTime } from '../core/time.js';
import { h, percent } from '../lib/dom.js';
import { ext } from '../lib/ext.js';
import { t, textDirection } from '../lib/i18n.js';

/**
 * The card beside the video. It lives in a shadow root so YouTube's styles and ours never mix.
 * actions: start, toggle(chapter), seek(time), addNote(time, text), removeNote(id), exportNotes,
 * resume, collapse, currentTime().
 */
export function createPanel(actions) {
  const host = h('div', { id: 'coursemark-panel' });
  const shadow = host.attachShadow({ mode: 'open' });
  // Keys typed into a note must not reach YouTube's shortcuts (k pauses, f goes full screen).
  for (const type of ['keydown', 'keypress', 'keyup']) {
    shadow.addEventListener(type, (event) => event.stopPropagation());
  }
  const style = h('style');
  fetch(ext.runtime.getURL('content/panel.css'))
    .then((response) => response.text())
    .then((css) => (style.textContent = css));

  const summary = h('span', { class: 'summary' });
  const collapseButton = h(
    'button',
    { class: 'icon', type: 'button', onclick: actions.collapse, title: t('collapse') },
    '▾',
  );
  const studying = studyingSection(actions);
  const sections = {
    idle: idleSection(actions),
    limit: { element: h('p', { class: 'limit' }, t('freeLimit', FREE_ACTIVE_COURSES)), update() {} },
    studying,
  };
  const body = h('div', { class: 'body' });
  const card = h(
    'section',
    { class: 'card', dir: textDirection() },
    h(
      'header',
      {},
      h('img', { src: ext.runtime.getURL('icons/32.png'), alt: '' }),
      h('strong', {}, 'Coursemark'),
      summary,
      collapseButton,
    ),
    body,
  );
  shadow.append(style, card);

  function mount(target) {
    if (target && host.parentElement !== target) target.prepend(host);
  }

  function render(view) {
    host.dataset.theme = view.dark ? 'dark' : 'light';
    card.classList.toggle('collapsed', view.collapsed);
    collapseButton.setAttribute('aria-expanded', String(!view.collapsed));
    summary.textContent =
      view.state === 'studying'
        ? `${view.progress.done}/${view.progress.total} · ${percent(view.progress.fraction)}`
        : '';
    const section = sections[view.state];
    section.update(view);
    if (body.firstChild !== section.element) body.replaceChildren(section.element);
  }

  return {
    mount,
    render,
    tick: (chapterStart, time) => studying.tick(chapterStart, time),
    remove: () => host.remove(),
  };
}

function idleSection(actions) {
  const text = h('p');
  const start = h('button', { class: 'primary', type: 'button', onclick: actions.start }, t('startCourse'));
  return {
    element: h('div', { class: 'idle' }, text, start),
    update: (view) => {
      text.textContent = view.chapters ? t('chapterSummary', view.chapters) : t('partSummary', view.parts);
    },
  };
}

function studyingSection(actions) {
  const fill = h('span');
  const bar = h('div', { class: 'bar', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100 }, fill);
  const resume = h('button', { class: 'link', type: 'button', onclick: actions.resume });
  const chapters = h('ol', { class: 'chapters' });
  const notes = notesBlock(actions);
  const exportButton = h('button', { type: 'button', onclick: actions.exportNotes }, t('exportNotes'));
  return {
    element: h('div', { class: 'studying' }, bar, resume, chapters, notes.element, h('footer', {}, exportButton)),
    update(view) {
      const value = Math.round(view.progress.fraction * 100);
      fill.style.width = `${value}%`;
      bar.setAttribute('aria-valuenow', value);
      resume.hidden = view.resumeAt === null;
      if (view.resumeAt !== null) resume.textContent = t('resumeAt', formatTime(view.resumeAt));
      chapters.replaceChildren(...view.chapters.map((chapter) => chapterItem(chapter, view.current, actions)));
      notes.update(view.notes);
      notes.tick(view.time);
    },
    tick(chapterStart, time) {
      for (const item of chapters.children) {
        item.classList.toggle('current', Number(item.dataset.start) === chapterStart);
      }
      notes.tick(time);
    },
  };
}

function chapterItem(chapter, current, actions) {
  return h(
    'li',
    { class: chapter.start === current ? 'current' : null, 'data-start': chapter.start },
    h('input', {
      type: 'checkbox',
      checked: chapter.done,
      'aria-label': t('markDone', chapter.label),
      onchange: () => actions.toggle(chapter),
    }),
    h(
      'button',
      { class: 'time', type: 'button', onclick: () => actions.seek(chapter.start) },
      formatTime(chapter.start),
    ),
    h('span', { class: 'title' }, chapter.label),
  );
}

/** The note box takes its time when the learner starts typing, not when they press Enter. */
function notesBlock(actions) {
  let noteTime = null;
  const input = h('input', { type: 'text', maxlength: 2000, 'aria-label': t('noteLabel') });
  const list = h('ul', { class: 'notes' });
  const form = h('form', { class: 'note-form' }, input, h('button', { type: 'submit' }, t('addNote')));

  const placeholder = (time) => {
    const text = t('noteAt', formatTime(noteTime ?? time));
    if (input.placeholder !== text) input.placeholder = text;
  };
  input.addEventListener('focus', () => {
    noteTime ??= actions.currentTime();
    placeholder(noteTime);
  });
  input.addEventListener('blur', () => {
    if (!input.value.trim()) noteTime = null;
  });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    actions.addNote(noteTime ?? actions.currentTime(), text);
    input.value = '';
    noteTime = input.matches(':focus') ? actions.currentTime() : null;
  });

  return {
    element: h('div', { class: 'notes-block' }, form, list),
    update: (notes) =>
      list.replaceChildren(
        ...notes.map((note) =>
          h(
            'li',
            {},
            h(
              'button',
              { class: 'time', type: 'button', onclick: () => actions.seek(note.time) },
              formatTime(note.time),
            ),
            h('p', {}, note.text),
            h(
              'button',
              {
                class: 'icon remove',
                type: 'button',
                title: t('deleteNote'),
                onclick: () => actions.removeNote(note.id),
              },
              '×',
            ),
          ),
        ),
      ),
    tick: placeholder,
  };
}
