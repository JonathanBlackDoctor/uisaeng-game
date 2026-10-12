import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { EventEvidencePanel } from '../src/EventEvidence';
import { evidenceForEvent } from '../src/evidence';
import { familyEvent, initialFamily } from '../src/family';
import { FIXTURE_EVENTS } from '../src/fixtures/content';

describe('event evidence scope and minimal display', () => {
  const campus = familyEvent('campus', { ...initialFamily(), meeting: 'campus' }, 'university')!;

  it('shows only one evidence sentence linked to its source', () => {
    const html = renderToStaticMarkup(<EventEvidencePanel event={campus}/>);
    expect(html).toContain('취미 동아리 15개');
    expect(html).toContain('10.1371/journal.pone.0296682');
    expect(html.match(/<p\b/g)).toHaveLength(1);
    expect(html).not.toContain('이 사건의 근거');
    expect(html).not.toContain('게임용 조정값');
    expect(html).not.toContain('<details');
    expect(html).not.toContain('이 사건의 인물과 연애 전개는 창작');
  });

  it('does not present campus context as evidence for unrelated scenes or fixtures', () => {
    const meeting = familyEvent('meeting', initialFamily(), 'university')!;
    for (const event of [meeting, ...FIXTURE_EVENTS, { ...campus, stage: 'career' as const }]) {
      expect(evidenceForEvent(event)).toEqual([]);
      const html = renderToStaticMarkup(<EventEvidencePanel event={event}/>);
      expect(html).toBe('');
    }
  });
});
