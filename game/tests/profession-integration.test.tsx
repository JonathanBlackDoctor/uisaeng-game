import { expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { applySpecialty } from '../src/career';
import { careerEvent, createCareerGame } from '../src/career-runtime';
import LifeScene from '../src/LifeScene';
import { sceneAppearance } from '../src/scene-state';
import { resultShareData } from '../src/result-share';

it.each(['dentistry', 'korean-medicine'] as const)('%s general practice has its own equipment without an invented specialist award', profession => {
  const s = createCareerGame('general-art', 3, profession);
  s.stageIndex = 2;
  s.career!.application = 'untrained';
  s.career!.practice = 'untrained';
  const appearance = sceneAppearance(s);
  expect(appearance.specialty).toBeUndefined();
  const html = renderToStaticMarkup(<LifeScene {...appearance} stage="career" age={35} month={2} running={false} focus="study" seed={3} relationship="single"/>);
  expect(html).toContain(`data-profession-art="${profession}"`);
  expect(html).not.toContain('data-specialty-art');
});

it.each(['dentistry', 'korean-medicine', 'nursing'] as const)('%s license evidence identifies the verified source', profession => {
  const event = careerEvent(createCareerGame('source', 3, profession), 'profession:license')!;
  expect(event.sourceNote?.url).toMatch(/^https:\/\/www\.law\.go\.kr\//);
  expect(event.sourceNote?.sha256).toMatch(/^[a-f0-9]{64}$/);
});

it('prevents cross-profession institution applications at the shared API boundary', () => {
  const dental = createCareerGame('dental', 3, 'dentistry');
  expect(() => applySpecialty(dental.career!, 'dentistry:integrated', 'snuh', 80, 0.5)).toThrow();
  const medical = createCareerGame('medical', 3);
  expect(() => applySpecialty(medical.career!, 'internal', 'profession-community', 80, 0.5)).toThrow();
});

it('uses nursing work labels in the share result', () => {
  const text = resultShareData(createCareerGame('nurse-result', 3, 'nursing')).text;
  expect(text).toContain('누적 돌봄');
  expect(text).not.toContain('누적 진료');
});
