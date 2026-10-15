import { ARTICLE_BODY_LIMIT } from './writing-limits.js';

export const REVIEW_DECISIONS = ['Needs checking', 'Supported by this source', 'Needs revision', 'Remove or qualify'];
const keys = ['passage', 'source', 'evidence', 'decision'];
function field(value, max, label) {
  if (typeof value !== 'string' || value.length > max || value.includes('\u0000')) throw new Error(label + ' is invalid or too long.');
  return value;
}

/** A readable, canonical note within the existing v1 workspace contract. */
export function createSourceReviewNote(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== keys.length || !keys.every(key => Object.hasOwn(value, key))) throw new Error('Use a supported passage review.');
  const passage = field(value.passage, 240, 'The article passage');
  const source = field(value.source, 160, 'The source reference').trim();
  const evidence = field(value.evidence, 240, 'The evidence or explanation').trim();
  if (!passage.trim()) throw new Error('Select or enter a short, exact passage from the article.');
  if (!REVIEW_DECISIONS.includes(value.decision)) throw new Error('Choose a supported review decision.');
  if (value.decision === 'Supported by this source' && (!source || !evidence)) throw new Error('Record both a source reference and evidence before choosing Supported by this source.');
  if (value.decision !== 'Needs checking' && !evidence) throw new Error('Explain the decision in Evidence or explanation.');
  const note = ['Passage review', 'Passage: ' + JSON.stringify(passage), 'Source: ' + JSON.stringify(source), 'Evidence: ' + JSON.stringify(evidence), 'Decision: ' + value.decision].join('\n');
  if (note.length > 500) throw new Error('This review uses ' + note.length + ' / 500 note characters. Shorten a field; nothing has been cut off.');
  return note;
}

/** Plain and edited notes remain ordinary notes unless the whole record matches. */
export function parseSourceReviewNote(note) {
  if (typeof note !== 'string' || note.length > 500) return null;
  const lines = note.split('\n');
  if (lines.length !== 5 || lines[0] !== 'Passage review' || !lines[1].startsWith('Passage: ') || !lines[2].startsWith('Source: ') || !lines[3].startsWith('Evidence: ') || !lines[4].startsWith('Decision: ')) return null;
  try {
    const value = { passage: JSON.parse(lines[1].slice(9)), source: JSON.parse(lines[2].slice(8)), evidence: JSON.parse(lines[3].slice(10)), decision: lines[4].slice(10) };
    return createSourceReviewNote(value) === note ? value : null;
  } catch { return null; }
}

export function locateReviewedPassage(body, passage) {
  if (typeof body !== 'string' || body.length > ARTICLE_BODY_LIMIT || typeof passage !== 'string' || !passage.trim() || passage.length > 240) return { state: 'missing' };
  const start = body.indexOf(passage);
  if (start < 0) return { state: 'missing' };
  if (body.indexOf(passage, start + 1) >= 0) return { state: 'multiple' };
  return { state: 'unique', start, end: start + passage.length, line: body.slice(0, start).split('\n').length };
}

/** Validate the complete list before replacing or appending one private note. */
export function planSourceReviewNote(questions, note, editing = null) {
  if (!Array.isArray(questions) || questions.length > 12 || questions.some(value => typeof value !== 'string' || value.length > 500 || value.includes('\u0000'))) throw new Error('Fix the current review notes before saving a passage review.');
  if (!parseSourceReviewNote(note)) throw new Error('The passage review is invalid.');
  const result = [...questions];
  if (editing !== null) {
    if (!Number.isInteger(editing.index) || editing.index < 0 || editing.index >= questions.length || questions[editing.index] !== editing.original) throw new Error('The note being edited changed or was removed. Open its current record again.');
    result[editing.index] = note;
  } else {
    if (questions.length >= 12) throw new Error('All 12 private review notes are in use. Edit or remove a note first.');
    if (questions.includes(note)) throw new Error('This exact review is already saved. Edit its existing record instead.');
    result.push(note);
  }
  return result;
}
