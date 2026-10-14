import { PROFESSIONS, professionOf } from './professions';
import { admissionRoute } from './admission';
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { STAT_LABELS, type GameState } from './contracts';
import { lifeStartAge, RANDOM_RULES } from './random-life';
import { FAMILY_STYLES } from './background';
import { compactWon } from './finance-view';
import AdmissionCampus from './AdmissionCampus';
import { GENDER_LABELS } from './identity';
import './opening.css';
import { roundedValue } from './display-values';
import { ABILITIES, abilityState } from './abilities';
import { startingAbilityReason, startingStatReason } from './ability-origin';
import { RUN_LENGTH_LABELS, RUN_LENGTH_OPTIONS } from './pacing';
import { OPENING_MOTION } from './opening-motion';
import { useOpeningAudio } from './opening-audio';

interface Props {
  draft: GameState | null;
  busy: boolean;
  disabled: boolean;
  entering: boolean;
  onPrepare: () => void;
  onEnter: () => void;
  onBack: () => void;
  onSkipEnter?: () => void;
  onLengthChange?: (length: 'standard' | 'short') => void;
}

export default function Opening({ draft, busy, disabled, entering, onPrepare, onEnter, onBack, onSkipEnter, onLengthChange }: Props) {
  const heading = useRef<HTMLHeadingElement>(null);
  const campus = useRef<HTMLDivElement>(null);
  const envelope = useRef<HTMLSpanElement>(null);
  const openButton = useRef<HTMLButtonElement>(null);
  const skipButton = useRef<HTMLButtonElement>(null);
  const [revealing, setRevealing] = useState(false);
  const [sound, setSound] = useState(true);
  const [reduced, setReduced] = useState(() => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [portal, setPortal] = useState<CSSProperties>({});
  const [envelopeBounds, setEnvelopeBounds] = useState<CSSProperties | null>(null);
  const audio = useOpeningAudio(sound);
  const background = draft?.life?.background;
  const profession = professionOf(draft ?? {}), school = PROFESSIONS[profession].school;
  const age = draft ? lifeStartAge(draft) : RANDOM_RULES.startAge;
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const change = () => setReduced(media.matches);
    media.addEventListener('change', change);
    return () => media.removeEventListener('change', change);
  }, []);
  useEffect(() => {
    if (!revealing) return;
    if (reduced) { setRevealing(false); return; }
    const timer = window.setTimeout(() => setRevealing(false), OPENING_MOTION.unfold);
    return () => window.clearTimeout(timer);
  }, [revealing, reduced]);
  useEffect(() => {
    if (revealing || entering) skipButton.current?.focus({ preventScroll: true });
    else if (!draft) openButton.current?.focus({ preventScroll: true });
    else heading.current?.focus({ preventScroll: true });
  }, [draft?.runId, revealing, entering]);
  useLayoutEffect(() => {
    if (!entering) return;
    const rect = campus.current?.getBoundingClientRect();
    if (rect) setPortal({
      '--portal-top': `${Math.max(0, Math.min(rect.top, innerHeight * .65))}px`,
      '--portal-right': `${Math.max(0, innerWidth - rect.right)}px`,
      '--portal-bottom': `${Math.max(0, innerHeight - rect.bottom)}px`,
      '--portal-left': `${Math.max(0, rect.left)}px`,
    } as CSSProperties);
    if (!reduced) audio.play('campus');
    // Only the committed transition starts this sound and captures the paper's bounds.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entering]);
  function prepare() {
    if (disabled || revealing) return;
    const el = envelope.current;
    if (el) {
      const rect = el.getBoundingClientRect();
      setEnvelopeBounds({ left: rect.left + (rect.width - el.offsetWidth) / 2, top: rect.top + (rect.height - el.offsetHeight) / 2, width: el.offsetWidth, height: el.offsetHeight });
    }
    setRevealing(!reduced);
    if (!reduced) audio.play('paper');
    onPrepare();
  }
  function skip() {
    audio.stop();
    if (entering) onSkipEnter?.();
    else setRevealing(false);
  }
  const motionStyle = {
    '--arrival-time': `${OPENING_MOTION.arrival}ms`,
    '--unfold-time': `${OPENING_MOTION.unfold}ms`,
    '--enter-time': `${OPENING_MOTION.enter}ms`,
  } as CSSProperties;

  return <section style={motionStyle} className={`opening ${draft ? 'opening-admission' : 'opening-title'}${revealing ? ' opening-revealing' : ''}${entering ? ' opening-entering' : ''}`} aria-labelledby={draft ? 'opening-heading' : undefined} aria-label={draft ? undefined : '도착한 편지 한 통'} aria-busy={busy || revealing} onKeyDown={event => { if (!draft && event.key === 'Escape') onBack(); }}>
    <div className="opening-tools">
      <button type="button" onClick={() => setSound(value => !value)} aria-pressed={sound} aria-label={sound ? '소리 끄기' : '소리 켜기'}>{draft ? sound ? '소리 켜짐' : '소리 꺼짐' : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z"/>{sound ? <path d="M16 8q4 4 0 8m3-11q7 7 0 14"/> : <path d="m17 9 5 6m0-6-5 6"/>}</svg>}</button>
      {(revealing || entering) && <button type="button" ref={skipButton} onClick={skip}>건너뛰기</button>}
    </div>
    {!draft ? <button type="button" className="opening-desk opening-surface" ref={openButton} disabled={disabled} onClick={prepare} aria-label="도착한 편지 열기">
      <span className="opening-window-light" aria-hidden="true"/>
      <span className="opening-envelope" ref={envelope} aria-hidden="true">
        <span className="envelope-flap"/>
        <span className="envelope-address"><span className="envelope-mark">✳</span></span>
      </span>
      <span className="opening-desk-caption">도착한 편지 한 통</span>
    </button> : <article className="opening-paper" inert={revealing || entering}>
      <div className="opening-letter-hero">
      <header className="opening-letterhead"><span>입학 통지서</span><span>{school}</span></header>
      <h1 id="opening-heading" ref={heading} tabIndex={-1}>{school} 입학을<br/>축하합니다.</h1>
      <div className="opening-recipient"><span>{draft.identity?.name ?? '입학생'} · {age}세</span><span className="opening-seal" aria-hidden="true">입학<br/>허가</span></div>
      <div className="opening-campus-print" ref={campus} aria-hidden="true"><AdmissionCampus seed={draft.life?.initialSeed ?? 2026}/></div>
      {revealing && <div className="opening-folds" aria-hidden="true"><div className="paper-fold paper-fold-top"/><div className="paper-fold paper-fold-bottom"/></div>}
      </div>
      {background && draft ? <div className="opening-details">
        <div className="opening-details-heading"><h2>입학을 앞둔 나</h2><span>{admissionRoute(age)}</span></div>
          <p className="opening-story">{background.region} · {background.environment}<br/>{background.experience}</p>
        <dl className="opening-facts">
          {draft.identity && <div><dt>성별</dt><dd>{GENDER_LABELS[draft.identity.gender]}</dd></div>}
          {background.profile && <div><dt>가족의 지원</dt><dd>{FAMILY_STYLES[background.profile.familyStyle]}</dd></div>}
          {draft.economy && <div><dt>지금 가진 돈</dt><dd>{compactWon(draft.economy.cash)}</dd></div>}
        </dl>
        <details className="opening-background"><summary>능력치와 배경 자세히 보기</summary>
        <dl className="opening-stats" aria-label="시작 능력치">
          {Object.entries(STAT_LABELS).map(([key, label]) => <div key={key}><dt>{label}</dt><dd>{roundedValue(draft.stats[key as keyof typeof STAT_LABELS])}</dd><dd className="starting-reason">{startingStatReason(background, key as keyof typeof STAT_LABELS)}</dd></div>)}
        </dl>
        <details className="starting-abilities"><summary>시작 실력과 배경</summary>
          <p>입학 전 경험과 개인차가 반영됐습니다. 실력은 앞으로의 활동으로 달라집니다.</p>
          <dl>{ABILITIES.map(a => <div key={a.id}><dt>{a.label} {roundedValue(abilityState(draft).values[a.id])}</dt><dd>{startingAbilityReason(background, a.id)}</dd></div>)}</dl>
        </details>
        </details>
        {onLengthChange && <fieldset className="opening-length" disabled={disabled || entering}>
          <legend>한 판 분량</legend>
          {RUN_LENGTH_OPTIONS.map(length => <label key={length}><input type="radio" name="run-length" value={length} checked={(draft.progress?.runLength ?? 'standard') === length} onChange={() => onLengthChange(length)}/>{RUN_LENGTH_LABELS[length]}</label>)}
          <p>{draft.progress?.runLength === 'short' ? '빠른 시간 진행 · 생활 이벤트 적게' : '천천히 진행 · 생활 이벤트 더 많이'}</p>
        </fieldset>}
        <div className="opening-actions"><button className="primary" disabled={disabled || revealing || entering} onClick={onEnter}>{entering ? '첫 학기로' : busy ? '저장 중…' : '첫 학기 시작'} <span aria-hidden="true">→</span></button><button className="text-button" disabled={busy || revealing || entering} onClick={() => { audio.stop(); onBack(); }}>돌아가기</button></div>
        <p className="opening-hint">시작하면 시간이 흐르고, 중요한 선택 앞에서 멈춥니다.</p>
      </div> : null}
    </article>}
    {revealing && envelopeBounds && <div className="opening-envelope opening-envelope-transition" style={envelopeBounds} aria-hidden="true"><div className="envelope-flap"/><div className="envelope-address"><span className="envelope-mark">✳</span></div></div>}
    {entering && <div className="opening-journey" style={portal} aria-hidden="true">
      <div className="opening-journey-scene"><AdmissionCampus seed={draft?.life?.initialSeed ?? 2026} walking/></div>
      <div className="opening-term"><span>{school}</span><strong>{age}세 · 첫 학기</strong></div>
    </div>}
  </section>;
}
