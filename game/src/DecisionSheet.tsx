import { useId, useLayoutEffect, useRef, useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import './decision-sheet.css';

export interface DecisionSheetProps {
  event: {
    id: string;
    title: string;
    body: string;
    choices: { id: string; label: string; description: string }[];
  };
  busy: boolean;
  onChoose: (choiceId: string) => void;
  evidence?: ReactNode;
  onAbilities?: () => void;
}

// A new event gets a fresh sheet, including its focus and accidental-input guard.
export default function DecisionSheet(props: DecisionSheetProps) {
  return <EventDecisionSheet key={props.event.id} {...props} />;
}

function EventDecisionSheet({ event, busy, onChoose, evidence, onAbilities }: DecisionSheetProps) {
  const id = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const expandRef = useRef<HTMLButtonElement>(null);
  const readyAt = useRef(Infinity);
  const choiceLock = useRef(false);
  const wasBusy = useRef(busy);
  const shortcut = useRef('');
  const shortcutTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [minimized, setMinimized] = useState(false);
  const [armed, setArmed] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  function clearShortcut() {
    clearTimeout(shortcutTimer.current);
    shortcutTimer.current = undefined;
    shortcut.current = '';
  }

  useLayoutEffect(() => {
    const previousFocus = document.activeElement;
    return () => {
      clearShortcut();
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) {
        previousFocus.focus({ preventScroll: true });
      }
    };
  }, []);

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    clearShortcut();
    readyAt.current = Infinity;
    setArmed(false);
    if (minimized) {
      if (dialog.open) dialog.close();
      expandRef.current?.focus({ preventScroll: true });
      return;
    }
    if (!dialog.open) dialog.showModal();
    titleRef.current?.focus({ preventScroll: true });
    dialog.querySelector('.ds-content')?.scrollTo({ top: 0 });
    readyAt.current = performance.now() + 700;
    const timer = setTimeout(() => setArmed(true), 700);
    return () => {
      clearTimeout(timer);
      clearShortcut();
      readyAt.current = Infinity;
      if (dialog.open) dialog.close();
    };
  }, [minimized]);

  // Keep a synchronous lock until the parent's busy cycle finishes (or the event changes).
  useLayoutEffect(() => {
    clearShortcut();
    if (busy) choiceLock.current = true;
    else if (wasBusy.current) {
      choiceLock.current = false;
      setSubmitted(false);
    }
    wasBusy.current = busy;
  }, [busy]);

  function choose(choiceId: string) {
    if (minimized || busy || choiceLock.current || performance.now() < readyAt.current) return;
    clearShortcut();
    choiceLock.current = true;
    setSubmitted(true);
    try {
      onChoose(choiceId);
    } catch (error) {
      choiceLock.current = false;
      setSubmitted(false);
      throw error;
    }
  }

  function minimize() {
    clearShortcut();
    readyAt.current = Infinity;
    setMinimized(true);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLDialogElement>) {
    if (e.key === 'Tab') {
      clearShortcut();
      const focusable = Array.from(e.currentTarget.querySelectorAll<HTMLElement>(
        'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), '
        + 'textarea:not(:disabled), summary, [tabindex]:not([tabindex="-1"])',
      )).filter((element) => element.tabIndex >= 0 && element.getClientRects().length > 0
        && element.checkVisibility({ checkVisibilityCSS: true }) && !element.closest('[inert]'));
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (!first) {
        e.preventDefault();
        titleRef.current?.focus();
      } else if (e.shiftKey && (active === first || !focusable.includes(active as HTMLElement))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !focusable.includes(active as HTMLElement))) {
        e.preventDefault();
        first.focus();
      }
      return;
    }
    const target = e.target;
    if (e.defaultPrevented || e.repeat || e.altKey || e.ctrlKey || e.metaKey
      || (target instanceof HTMLElement && (target.isContentEditable
        || target.closest('input, textarea, select, [role="textbox"], [role="combobox"], [role="spinbutton"]')))) {
      clearShortcut();
      return;
    }
    if (!/^[0-9]$/.test(e.key) || busy || submitted || performance.now() < readyAt.current) {
      clearShortcut();
      return;
    }
    const digits = shortcut.current + e.key;
    const number = Number(digits);
    clearShortcut();
    if (number < 1 || number > event.choices.length) return;
    e.preventDefault();
    // For 10+ choices, wait briefly when a number can also begin a longer shortcut.
    if (number * 10 <= event.choices.length) {
      shortcut.current = digits;
      shortcutTimer.current = setTimeout(() => choose(event.choices[number - 1].id), 500);
    } else choose(event.choices[number - 1].id);
  }

  if (typeof document === 'undefined') return null;

  const unavailable = !armed || busy || submitted;
  return createPortal(
    <>
      <dialog
        ref={dialogRef}
        className="ds-sheet"
        lang="ko"
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-body`}
        aria-modal="true"
        onKeyDown={handleKeyDown}
        onCancel={(e) => { e.preventDefault(); minimize(); }}
      >
        <div className="ds-content">
          <header className="ds-header">
            <span className="ds-eyebrow">선택</span>
            <button type="button" className="ds-minimize" onClick={minimize} aria-label="선택 카드 접기">
              <span aria-hidden="true">−</span> 접기
            </button>
          </header>
          <h2 ref={titleRef} tabIndex={-1} className="ds-title" id={`${id}-title`}>{event.title}</h2>
          <p className="ds-body" id={`${id}-body`}>{event.body}</p>
          {onAbilities && <button type="button" className="subtle-button ability-open" onClick={onAbilities} disabled={busy}>능력 보기</button>}
          <ol className="ds-choices" aria-label="선택지">
            {event.choices.map((choice, index) => (
              <li className="ds-choice-item" key={choice.id}>
                <button
                  type="button"
                  className="ds-choice"
                  disabled={unavailable}
                  onClick={() => choose(choice.id)}
                  aria-labelledby={`${id}-choice-${index}`}
                  aria-describedby={choice.description ? `${id}-description-${index}` : undefined}
                >
                  <span className="ds-number" aria-hidden="true">{index + 1}</span>
                  <span className="ds-choice-copy">
                    <span className="ds-choice-label" id={`${id}-choice-${index}`}>
                      <span className="ds-sr-only">{index + 1}번. </span>{choice.label}
                    </span>
                    {choice.description && <span className="ds-choice-description" id={`${id}-description-${index}`}>{choice.description}</span>}
                  </span>
                </button>
              </li>
            ))}
          </ol>
          {event.choices.length === 0 && <p className="ds-hint">아직 선택지가 준비되지 않았습니다.</p>}
          <p className="ds-status" role="status" aria-live="polite" aria-atomic="true">
            {busy || submitted ? '선택을 반영하고 있습니다…'
              : !armed ? '선택을 준비하고 있습니다…'
                : event.choices.length > 0 ? `숫자 1–${event.choices.length}로 선택 · Esc로 접기` : 'Esc로 접기'}
          </p>
          {evidence != null && (
            <div className="ds-evidence">{evidence}</div>
          )}
        </div>
      </dialog>
      {minimized && (
        <aside className="ds-waiting" lang="ko" aria-label="중요 선택 대기">
          <div className="ds-waiting-copy">
            <p className="ds-waiting-status" role="status">선택 대기</p>
            <p className="ds-waiting-title">{event.title}</p>
          </div>
          <button ref={expandRef} type="button" className="ds-expand" onClick={() => setMinimized(false)}>
            선택 보기 <span aria-hidden="true">↗</span>
          </button>
        </aside>
      )}
    </>,
    document.body,
  );
}
