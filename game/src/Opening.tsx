import { useEffect, useRef } from 'react';
import { STAT_LABELS, type GameState } from './contracts';
import { lifeStartAge, RANDOM_RULES } from './random-life';
import { FAMILY_STYLES } from './background';
import { compactWon } from './finance-view';
import LifeScene from './LifeScene';
import './opening.css';

interface Props {
  draft: GameState | null;
  busy: boolean;
  disabled: boolean;
  onPrepare: () => void;
  onEnter: () => void;
  onBack: () => void;
}

export default function Opening({ draft, busy, disabled, onPrepare, onEnter, onBack }: Props) {
  const heading = useRef<HTMLHeadingElement>(null);
  const background = draft?.life?.background;
  const age = draft ? lifeStartAge(draft) : RANDOM_RULES.startAge;
  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, [draft?.runId]);

  return <section className={`opening ${draft ? 'opening-admission' : 'opening-title'}`} aria-labelledby="opening-heading">
    <div className="opening-copy" key={draft?.runId ?? 'title'}>
      <p className="opening-kicker">{draft ? `${age}세 · 의대 입학` : '의대 입학부터 은퇴까지'}</p>
      <h1 id="opening-heading" ref={heading} tabIndex={-1}>{draft ? <>첫 학기를<br/>앞두고 있습니다.</> : <>{age}세,<br/>의대에 입학했다.</>}</h1>
      {background && draft ? <>
        <p className="opening-story">{background.region} · {background.environment}<br/>{background.experience}</p>
        <dl className="opening-facts">
          {background.profile && <div><dt>가족의 지원</dt><dd>{FAMILY_STYLES[background.profile.familyStyle]}</dd></div>}
          {draft.economy && <div><dt>지금 가진 돈</dt><dd>{compactWon(draft.economy.cash)}</dd></div>}
        </dl>
        <dl className="opening-stats" aria-label="시작 능력치">
          {Object.entries(STAT_LABELS).map(([key, label]) => <div key={key}><dt>{label}</dt><dd>{draft.stats[key as keyof typeof STAT_LABELS]}</dd></div>)}
        </dl>
        <div className="opening-actions"><button className="primary" disabled={disabled} onClick={onEnter}>{busy ? '저장 중…' : '첫 학기 시작'} <span aria-hidden="true">→</span></button><button className="text-button" disabled={busy} onClick={onBack}>돌아가기</button></div>
        <p className="opening-hint">시작하면 시간이 흐르고, 중요한 선택 앞에서 멈춥니다.</p>
      </> : <>
        <p className="opening-story">수업을 듣고, 친구를 만나고, 진로를 정합니다.<br/>의사가 된 뒤의 생활도 이어집니다.</p>
        <div className="opening-actions"><button className="primary" disabled={disabled} onClick={onPrepare}>입학하기 <span aria-hidden="true">→</span></button></div>
        <p className="opening-hint">시작 배경과 능력은 매번 달라집니다.</p>
      </>}
    </div>
    <div className="opening-scene" aria-hidden="true">
      <LifeScene stage="university" age={age} month={0} running={false} focus="study" seed={draft?.life?.initialSeed ?? 2026} relationship="single"/>
    </div>
  </section>;
}
