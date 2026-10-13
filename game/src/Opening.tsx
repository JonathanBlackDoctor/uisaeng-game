import { useEffect, useRef } from 'react';
import { STAT_LABELS, type GameState } from './contracts';
import { lifeStartAge, RANDOM_RULES } from './random-life';
import { FAMILY_STYLES } from './background';
import { compactWon } from './finance-view';
import AdmissionCampus from './AdmissionCampus';
import { GENDER_LABELS } from './identity';
import './opening.css';

interface Props {
  draft: GameState | null;
  busy: boolean;
  disabled: boolean;
  entering: boolean;
  onPrepare: () => void;
  onEnter: () => void;
  onBack: () => void;
}

export default function Opening({ draft, busy, disabled, entering, onPrepare, onEnter, onBack, onIdentity }: Props & { onIdentity?: (gender: 'male' | 'female', status?: 'pending' | 'exempt' | 'prior-service') => void }) {
  const heading = useRef<HTMLHeadingElement>(null);
  const background = draft?.life?.background;
  const age = draft ? lifeStartAge(draft) : RANDOM_RULES.startAge;
  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, [draft?.runId]);

  return <section className={`opening ${draft ? 'opening-admission' : 'opening-title'}${entering ? ' opening-entering' : ''}`} aria-labelledby="opening-heading" aria-busy={busy}>
    <div className="opening-campus" aria-hidden="true">
      <AdmissionCampus seed={draft?.life?.initialSeed ?? 2026}/>
    </div>
    <article className={`opening-paper${draft ? ' opening-paper-open' : ''}`}>
      <header className="opening-letterhead"><span>입학 통지서</span><span>의과대학</span></header>
      <h1 id="opening-heading" ref={heading} tabIndex={-1}>의과대학 입학을<br/>축하합니다.</h1>
      {background && draft ? <div className="opening-details">
        <div className="opening-details-heading"><h2>입학을 앞둔 나</h2><span>{age}세</span></div>
        <p className="opening-story">{background.region} · {background.environment}<br/>{background.experience}</p>
        <dl className="opening-facts">
          {draft.identity?.name && <div><dt>이름</dt><dd>{draft.identity.name}</dd></div>}
          {draft.identity && <div><dt>성별</dt><dd>{GENDER_LABELS[draft.identity.gender]}</dd></div>}
          {draft.identity?.gender === 'male' && <div><dt><label htmlFor="starting-service">입학 때 병역</label></dt><dd><select id="starting-service" value={draft.identity.service.status} disabled={disabled} onChange={e => onIdentity?.('male', e.target.value as 'pending' | 'exempt' | 'prior-service')}><option value="pending">미이행</option><option value="prior-service">복무 마침</option><option value="exempt">면제 판정 받음</option></select></dd></div>}
          {background.profile && <div><dt>가족의 지원</dt><dd>{FAMILY_STYLES[background.profile.familyStyle]}</dd></div>}
          {draft.economy && <div><dt>지금 가진 돈</dt><dd>{compactWon(draft.economy.cash)}</dd></div>}
        </dl>
        <dl className="opening-stats" aria-label="시작 능력치">
          {Object.entries(STAT_LABELS).map(([key, label]) => <div key={key}><dt>{label}</dt><dd>{draft.stats[key as keyof typeof STAT_LABELS]}</dd></div>)}
        </dl>
        <div className="opening-actions"><button className="primary" disabled={disabled} onClick={onEnter}>{entering ? '첫 학기로' : busy ? '저장 중…' : '첫 학기 시작'} <span aria-hidden="true">→</span></button><button className="text-button" disabled={busy} onClick={onBack}>돌아가기</button></div>
        <p className="opening-hint">시작하면 시간이 흐르고, 중요한 선택 앞에서 멈춥니다.</p>
      </div> : <>
        <p className="opening-invitation">첫 학기를 앞두고 있습니다.</p>
        <div className="opening-actions"><button className="primary" disabled={disabled} onClick={onPrepare}>통지서 열기 <span aria-hidden="true">→</span></button></div>
        <span className="opening-crease" aria-hidden="true"/>
      </>}
    </article>
  </section>;
}
