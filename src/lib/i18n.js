import { ext } from './ext.js';

export function t(key, ...substitutions) {
  return ext.i18n.getMessage(key, substitutions.map(String)) || key;
}

export function textDirection() {
  return ext.i18n.getMessage('@@bidi_dir') || 'ltr';
}

/** The words a Markdown export is written in, in the learner's language. */
export function exportWords() {
  return {
    chapters: t('chapters'),
    notes: t('notes'),
    part: (number) => t('partNumber', number),
    done: (done, total) => t('chaptersDone', done, total),
  };
}
