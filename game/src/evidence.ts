import type { GameEvent } from './contracts';

// Keep factual context separate from fictional outcomes and balancing.
export interface EventEvidence {
  id: string;
  kind: 'fact' | 'statistic';
  summary: string;
  relevance: string;
  period: string;
  population: string;
  limitation: string;
  source: { title: string; publisher: string; published: string; url: string; locator: string; rawPath: string; sha256: string };
  rulesVersion: 'event-evidence-v1';
}

const campusClubs: EventEvidence = {
  id: 'student-cohort-2022-club-context', kind: 'fact',
  summary: '한 의대의 학생생활 연구에는 취미 동아리 15개, 선후배 친목 동아리 10개, 봉사·종교 동아리 5개가 소개되어 있습니다.',
  relevance: '동아리에서 사람을 만나는 대학생활의 배경 자료입니다. 이 사건의 인물과 연애 전개는 창작입니다.',
  period: '2022년 졸업생의 재학 기록 · 발표 2024년',
  population: '전남대학교 의과대학 졸업생 중 연구 참여에 동의한 134명 · 동아리 수는 해당 학교의 설명',
  limitation: '한 학교의 사례입니다. 전국 의대의 동아리 수나 연애 가능성을 뜻하지 않으며, 선택에 따른 관계·행복 증가량을 검증한 연구가 아닙니다.',
  source: {
    title: 'Factors associated with academic performance among medical students at a medical school in South Korea: A retrospective cohort study',
    publisher: 'Chung 외 · PLOS ONE', published: '2024-02-09',
    url: 'https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0296682',
    locator: 'Methods → Data collection · Extracurricular activity data',
    rawPath: 'research/medical-career/raw/student_life/student_academic_cohort_plos_jats__dd1a6f3fbee2ea45.xml',
    sha256: 'dd1a6f3fbee2ea45131dd02f87a8433c519bb94d1a71a7bb40de9aa3af6c5abe',
  },
  rulesVersion: 'event-evidence-v1',
};

export function evidenceForEvent(event: GameEvent): readonly EventEvidence[] {
  // Scene IDs are stable across run IDs and saved games. Match only reviewed contexts.
  if (event.stage === 'university'
    && ((event.provenance === 'family-preview' && (event.familyScene === 'campus' || event.familyScene === 'cc-life'))
      || (event.provenance === 'random-preview' && (event.randomKey === 'offer-campus' || event.randomKey === 'cc-life')))) return [campusClubs];
  return [];
}
