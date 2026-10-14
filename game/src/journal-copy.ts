import type { JournalEntry } from './contracts';
import { readableText } from './event-copy';

const clean = (text: string) => readableText(text.replace(/^\d+세(?:\s*\d+개월)?\s*·\s*/, '')).trim();

/** Use authored outcomes, never generate a success from the choice preview.
 * Extra context remains available; costs, time and adverse outcomes stay visible. */
export function journalCopy(entry: JournalEntry) {
  const detail = clean(entry.choice?.detail || entry.detail);
  const sentences = detail.split(/(?<=[.!?。])\s+/u);
  const summary = entry.id === 'background'
    ? detail.split(' · ').slice(0, 2).join(' · ')
    : sentences.filter((sentence, index) => index === 0
      || /\d|비용|미납|부채|불합격|실패|기각|배상|불확실|부족/.test(sentence)).join(' ');
  const action = entry.choice ? clean(entry.choice.label) : '';
  const title = clean(entry.title);
  const subject = action || (detail.includes(title) ? '' : title);
  const text = [subject, summary === subject ? '' : summary].filter(Boolean).join(' · ');
  const context = clean(entry.choice?.context ?? '');
  const more = [context && !text.includes(context) ? context : '', summary !== detail ? detail : ''].filter(Boolean).join(' ');
  return { subject, summary: summary === subject ? '' : summary, text, more };
}
