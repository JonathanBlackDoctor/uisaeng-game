import { useEffect, useRef } from 'react';

/** Quiet, locally synthesized paper / campus sounds. Starts only on a gesture. */
export function useOpeningAudio(enabled: boolean) {
  const audio = useRef<{ context: AudioContext; master: GainNode; sources: AudioScheduledSourceNode[] } | null>(null);
  function stop() {
    for (const source of audio.current?.sources ?? []) {
      try { source.stop(); } catch { /* Already ended. */ }
    }
    if (audio.current) audio.current.sources = [];
  }
  useEffect(() => {
    const value = audio.current;
    if (value) value.master.gain.setTargetAtTime(enabled ? .28 : 0, value.context.currentTime, .025);
  }, [enabled]);
  useEffect(() => () => { stop(); void audio.current?.context.close().catch(() => {}); audio.current = null; }, []);

  function play(kind: 'paper' | 'campus') {
    if (!enabled) return;
    try {
      if (!audio.current) {
        const context = new AudioContext();
        const master = context.createGain();
        master.gain.value = .28;
        master.connect(context.destination);
        audio.current = { context, master, sources: [] };
      }
      stop();
      const { context, master, sources } = audio.current;
      void context.resume().catch(() => {});
      const now = context.currentTime;
      const noise = (delay: number, duration: number, level: number, frequency: number) => {
        const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * duration), context.sampleRate);
        const samples = buffer.getChannelData(0);
        for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
        const source = context.createBufferSource(); source.buffer = buffer;
        const filter = context.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = frequency;
        const gain = context.createGain();
        gain.gain.setValueAtTime(0, now + delay);
        gain.gain.linearRampToValueAtTime(level, now + delay + Math.min(.06, duration / 3));
        gain.gain.exponentialRampToValueAtTime(.0001, now + delay + duration);
        source.connect(filter).connect(gain).connect(master);
        source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect(); };
        sources.push(source); source.start(now + delay); source.stop(now + delay + duration);
      };
      const note = (frequency: number, delay: number, duration: number, level: number) => {
        const source = context.createOscillator(); source.type = 'sine'; source.frequency.value = frequency;
        const gain = context.createGain(); gain.gain.setValueAtTime(0, now + delay);
        gain.gain.linearRampToValueAtTime(level, now + delay + .035);
        gain.gain.exponentialRampToValueAtTime(.0001, now + delay + duration);
        source.connect(gain).connect(master);
        source.onended = () => { source.disconnect(); gain.disconnect(); };
        sources.push(source); source.start(now + delay); source.stop(now + delay + duration);
      };
      if (kind === 'paper') {
        noise(0, .35, .2, 1800); noise(.4, .45, .16, 2800); noise(.95, .4, .12, 2200);
        [261.63, 329.63, 392].forEach((frequency, i) => note(frequency, 1.2 + i * .06, .8, .1));
      } else {
        noise(0, 2.1, .1, 750);
        [.95, 1.25, 1.55].forEach(delay => noise(delay, .12, .18, 420));
        note(783.99, .3, .15, .035); note(1046.5, .48, .18, .025);
      }
    } catch { /* Audio is optional; unsupported or blocked audio never blocks play. */ }
  }
  return { play, stop };
}
