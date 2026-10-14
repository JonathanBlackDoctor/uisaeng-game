// Reading time and disk I/O are deliberately outside the five-second sequence.
export const OPENING_MOTION = { arrival: 700, unfold: 2100, enter: 2200 } as const;

/** One finish path for normal playback, skip, and a live reduced-motion change. */
export function beginOpeningTransition(media: MediaQueryList) {
  let finish = () => {};
  const finished = new Promise<void>(resolve => {
    if (media.matches) { resolve(); return; }
    let done = false;
    const changed = () => { if (media.matches) finish(); };
    const timer = window.setTimeout(() => finish(), OPENING_MOTION.enter);
    finish = () => {
      if (done) return;
      done = true;
      window.clearTimeout(timer);
      media.removeEventListener('change', changed);
      resolve();
    };
    media.addEventListener('change', changed);
  });
  return { finished, skip: () => finish() };
}
