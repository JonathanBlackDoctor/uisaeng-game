import 'fake-indexeddb/auto';
import { expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import LifeGoals from '../src/LifeGoals';
import { createCareerGame, careerEvent } from '../src/career-runtime';
import { EXPERIENCE_STORIES, professionStories, storyAvailable } from '../src/profession-experience';
import { reduceGame } from '../src/engine';
import { elapsedMonths } from '../src/random-life';
import { eventParagraphs } from '../src/event-copy';
import { PROFESSIONS, type AddedProfession } from '../src/professions';
import { openGameDatabase, loadGame, persistGame, validState } from '../src/storage';
import { chooseProfessionEvent, continueProfession, professionJourney } from './helpers/profession-play';

const professions: AddedProfession[] = ['dentistry', 'korean-medicine', 'nursing'];
it.each(professions)('%s preserves a consequential training choice through the next two field scenes and save restore', async profession => {
  const field = profession === 'dentistry' ? 'dentistry:integrated' : profession === 'nursing' ? 'nursing:ward' : 'korean-medicine:internal';
  const learn = `profession:story:${field}:learn`, work = `profession:story:${field}:work`, improve = `profession:story:${field}:improve`;
  const trained = professionJourney(profession, { field, picks: { [learn]: 'team' }, stop: s => s.pendingEvent?.randomKey === work }).s;
  expect(trained.pendingEvent!.body).toContain('지난');
  expect(eventParagraphs(trained.pendingEvent!.body).situation).not.toContain('지난 ‘');
  expect(eventParagraphs(trained.pendingEvent!.body).memory).toContain('지난 ‘');
  expect(trained.pendingEvent!.choices.some(c => c.id === 'reuse')).toBe(true);
  const db = await openGameDatabase(`experience-${crypto.randomUUID()}`);
  try {
    await persistGame(db, trained, null);
    const restored = (await loadGame(db))!.state;
    expect(restored.pendingEvent).toEqual(trained.pendingEvent);
    const reused = chooseProfessionEvent(restored, { picks: { [work]: 'reuse' } });
    expect(reused.professional!.decisions[`story:${field}:work`].result).toContain('이번 상황');
    const later = continueProfession(reused, { field, stop: s => s.pendingEvent?.randomKey === improve }).s;
    expect(later.pendingEvent!.body).toContain('이번 상황에 맞게');
    expect(later.pendingEvent!.choices.some(c => c.id === 'reuse')).toBe(true);
    expect(validState(later)).toBe(true);
    const rested = professionJourney(profession, { field, picks: { [learn]: 'defer' }, stop: s => s.pendingEvent?.randomKey === work }).s;
    expect(rested.pendingEvent!.choices.some(c => c.id === 'reuse')).toBe(false);
    expect(rested.pendingEvent!.body).toContain('맡을 범위를 줄였습니다');
  } finally { db.close(); }
}, 120000);

it.each(professions)('%s research receives research training and a connected retirement rather than unrelated clinical work', profession => {
  const { s, events } = professionJourney(profession, { route: 'research', work: 'research' });
  const research = events.filter(k => k.startsWith('profession:story:'));
  expect(research).toContain(`profession:story:${profession}:research:start`);
  expect(research.filter(k => k.includes(':research:')).length).toBe(4);
  expect(research.filter(k => k.includes(':retirement:')).length).toBe(2);
  expect(research.every(k => k.includes(':life:') || k.includes(':research:') || k.includes(':retirement:'))).toBe(true);
  expect(research.filter(k => k.includes(':life:')).every(k => Number(k.split(':life:')[1]) < 12)).toBe(true);
  expect(s.journal.some(e => e.id === 'profession:recap' && e.detail.includes('후배'))).toBe(true);
  expect(s.journal.filter(e=>e.id.startsWith('profession:')).every(e=>/^\d+세(?:\s*\d+개월)? · /.test(e.detail))).toBe(true);
  expect(s.journal.find(e=>e.id==='profession:retirement')!.detail).toContain(`${PROFESSIONS[profession].job}로 맡았던 일`);
  expect(s.professional!.qualified).toBe(false);
  expect(validState(s)).toBe(true);
}, 120000);

it.each(professions)('%s starts with foundation scenes and keeps graduation work for later study', profession => {
  const s = createCareerGame('chronology', 3, profession);
  s.life!.elapsedMs = 9_000;
  const available = professionStories(s).filter(e => e.profession === profession && e.phase === 'university' && storyAvailable(s,e));
  expect(available.length).toBeGreaterThan(0);
  expect(available.every(e => Number(e.id.split(':life:')[1]) < 4)).toBe(true);
  s.life!.elapsedMs = (PROFESSIONS[profession].studyMonths - 4) * 1000;
  expect(professionStories(s).filter(e => e.profession === profession && e.phase === 'university' && storyAvailable(s,e)).every(e => Number(e.id.split(':life:')[1]) >= 8)).toBe(true);
});

it.each(professions)('%s keeps old open story text and effects exactly restorable', async profession => {
  const legacy = createCareerGame('legacy-experience', 3, profession);
  delete legacy.professional!.experienceVersion;
  const pending = continueProfession(legacy, { stop: s => !!s.pendingEvent?.randomKey?.startsWith('profession:story:') }).s;
  expect(pending.pendingEvent!.choices.map(c => c.id)).toEqual(['review','team','defer']);
  const db = await openGameDatabase(`legacy-experience-${crypto.randomUUID()}`);
  try {
    await persistGame(db,pending,null);
    const restored = (await loadGame(db))!.state;
    expect(restored).toEqual(pending);
    expect({ ...careerEvent(restored, restored.pendingEvent!.randomKey!), id: restored.pendingEvent!.id }).toEqual(restored.pendingEvent);
    expect(validState(chooseProfessionEvent(restored))).toBe(true);
  } finally { db.close(); }
});

it('nursing department transfer teaches the new field and retains the original experience without awarding a certificate', () => {
  const { s, events } = professionJourney('nursing', { field: 'nursing:ward', picks: { 'profession:transition': 'transfer', 'profession:transfer': 'nursing:icu' } });
  const before = events.indexOf('profession:story:nursing:ward:learn'), after = events.indexOf('profession:story:nursing:icu:learn');
  expect(before).toBeGreaterThan(-1); expect(after).toBeGreaterThan(before);
  expect(events.indexOf('profession:story:nursing:icu:work')).toBeGreaterThan(after);
  expect(s.professional!.practiceMonths['nursing:ward']).toBeGreaterThan(36);
  expect(s.professional!.practiceMonths['nursing:icu']).toBeGreaterThan(36);
  expect(s.professional!.certificateEarned).toBe(false);
  const notes=s.journal.filter(e=>e.id.startsWith('profession:'));
  expect(new Set(notes.map(e=>e.id)).size).toBe(notes.length);
  expect(elapsedMonths(s)).toBe(684);
}, 120000);

it('rejects unknown experience versions and duplicate settlement', () => {
  const s = professionJourney('nursing', { stop: s => s.pendingEvent?.randomKey?.endsWith(':learn') === true }).s;
  const action = { type: 'choose' as const, id: 'experience-once', eventId: s.pendingEvent!.id, choiceId: 'team' };
  const next = reduceGame(s,action);
  expect(reduceGame(next,action)).toBe(next);
  const bad = structuredClone(s); bad.professional!.experienceVersion = 2 as never;
  expect(validState(bad)).toBe(false);
  expect(new Set(EXPERIENCE_STORIES.map(e=>e.id)).size).toBe(EXPERIENCE_STORIES.length);
});

it.each(['insurance','education','management','research'])('nursing %s receives work within the selected role', field => {
  const s = createCareerGame('nursing-role',3,'nursing');
  s.stageIndex=2; s.career!.specialty=`nursing:${field}`; s.career!.practice='employed';
  const available=professionStories(s).filter(e=>e.profession==='nursing'&&e.phase==='career'&&storyAvailable(s,e));
  expect(available.some(e=>e.id===`nursing:${field}:work`)).toBe(true);
  expect(available.some(e=>['nursing:life:15','nursing:life:16','nursing:life:17','nursing:life:22'].includes(e.id))).toBe(false);
  if(field==='research')expect(available.some(e=>e.id==='nursing:research:protocol')).toBe(true);
});

it.each(professions)('%s performance and retirement labels retain the profession', profession => {
  const s=createCareerGame('performance-copy',3,profession);
  const active=renderToStaticMarkup(<LifeGoals game={s}/>);
  expect(active).toContain(`${PROFESSIONS[profession].job}로 일하기 시작하면`);
  s.status='completed';
  const recap=renderToStaticMarkup(<LifeGoals game={s}/>);
  expect(recap).toContain(profession==='nursing'?'누적 돌봄':'누적 진료');
  if(profession==='nursing')expect(recap).not.toContain('누적 진료');
});

