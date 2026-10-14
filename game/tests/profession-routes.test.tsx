import { afterEach, describe, expect, it } from 'vitest';
import { PROFESSION_SPECIALTIES } from '../src/professions';
import { trainingDuration, eligibleNursingCertificates } from '../src/profession-runtime';
import { PROFESSION_STORIES } from '../src/profession-stories';
import { elapsedMonths } from '../src/random-life';
import { serviceDuration, serviceMonths } from '../src/identity';
import { clinicOpen, canExpandClinic } from '../src/clinic';
import { reduceGame } from '../src/engine';
import { continueProfession, chooseProfessionEvent, professionJourney } from './helpers/profession-play';

const clinical = ['dentistry', 'korean-medicine'] as const;
describe('approved profession routes', () => {
  // Yield between synchronous lifetime simulations so Vitest can acknowledge worker messages.
  afterEach(() => new Promise<void>(resolve => setTimeout(resolve, 0)));
  it.each(PROFESSION_SPECIALTIES)('$id reaches the selected field through training and finishes', field => {
    const { s, events } = professionJourney(field.profession, { field: field.id });
    expect(s.career!.specialty).toBe(field.id);
    expect(s.career!.application).toBe('accepted');
    expect(s.career!.practice).toBe('employed');
    expect(s.professional!.licensed).toBe(true);
    expect(s.status).toBe('completed');
    expect(s.progress!.trainingStartMonth).toBeGreaterThanOrEqual(s.professional!.licenseMonth!);
    if (field.profession === 'nursing') {
      expect(s.professional!.qualified).toBe(false);
      expect(s.professional!.practiceMonths[field.id]).toBeGreaterThan(36);
    } else {
      expect(s.professional!.qualified).toBe(true);
      expect(s.professional!.qualifiedMonth! - s.progress!.trainingStartMonth!).toBeGreaterThanOrEqual(trainingDuration(s));
      expect(events).toContain('profession:qualification');
    }
    const authored = PROFESSION_STORIES.filter(e => e.profession === field.profession && e.specialty === field.id);
    expect(authored.length).toBeGreaterThan(0);
    expect(authored.some(e => events.includes(`profession:story:${e.id}`))).toBe(true);
  }, 120000);

  it.each(clinical)('%s general practice preserves its license without inventing a specialist title', profession => {
    const { s, events } = professionJourney(profession, { route: 'general', work: 'untrained' });
    expect(s.professional!.licensed).toBe(true);
    expect(s.professional!.qualified).toBe(false);
    expect(s.career!.specialty).toBeNull();
    expect(s.career!.practice).toBe('untrained');
    expect(events).not.toContain('profession:qualification');
  }, 120000);

  it.each(clinical)('%s clinic funds a real practice and resolves its closure before retirement', profession => {
    const established = professionJourney(profession, { work: 'clinic', stop: state => clinicOpen(state) && canExpandClinic(state) && !state.pendingEvent }).s;
    const offer = reduceGame(established, { type: 'clinic', kind: 'expand', id: `qa:expand:${established.revision}` });
    expect(offer.pendingEvent?.randomKey).toBe('clinic:expand');
    const expanded = chooseProfessionEvent(offer, { picks: { 'clinic:expand': 'borrow' } });
    expect(expanded.clinic!.level).toBe(1);
    const { s, events } = continueProfession(expanded, { work: 'clinic', picks: { 'clinic:crisis': 'close' } });
    expect(s.economy!.ledger.some(t => t.kind === 'open-clinic')).toBe(true);
    expect(events.some(key => key === 'clinic:retire' || key === 'clinic:crisis')).toBe(true);
    expect(s.clinic!.level).toBe(0);
  }, 120000);

  it.each(['dentistry', 'korean-medicine', 'nursing'] as const)('%s can follow the research route without specialist credentials', profession => {
    const { s, events } = professionJourney(profession, { route: 'research', work: 'research' });
    expect(s.professional!.route).toBe('research');
    expect(s.career!.practice).toBe('research');
    expect(s.professional!.qualified).toBe(false);
    expect(s.professional!.academic).toBeGreaterThan(0);
    expect(events).toContain('profession:academic-0');
    expect(events).not.toContain('profession:field');
    expect(events).not.toContain('profession:qualification');
  }, 120000);

  it.each(['dentistry', 'korean-medicine', 'nursing'] as const)('%s male enlistment pauses the academic clock and completes before licensing', profession => {
    let serviceStartedAt: number | undefined;
    const { s, events } = professionJourney(profession, { gender: 'male', visit: state => {
      if (state.identity!.service.status === 'serving') {
        serviceStartedAt ??= elapsedMonths(state);
        expect(elapsedMonths(state)).toBe(serviceStartedAt);
        expect(state.professional!.licensed).toBe(false);
      }
    } });
    expect(events).toContain('service:plan');
    expect(events).toContain('service:daily');
    expect(events).toContain('service:contact');
    expect(s.identity!.service.status).toBe('completed');
    expect(s.identity!.service.route).toBe('army');
    expect(serviceMonths(s)).toBe(18);
    expect(s.economy!.ledger.filter(t => t.id.startsWith('service:'))).toHaveLength(36);
  }, 120000);

  it.each(clinical)('%s male medical service preserves and resumes the specialist route', profession => {
    const { s, events } = professionJourney(profession, { gender: 'male', picks: { 'service:plan': 'medical', 'service:timing': 'after-training' } });
    expect(events).toContain('service:placement');
    expect(s.identity!.service.status).toBe('completed');
    expect(['doctor', 'public-health']).toContain(s.identity!.service.route);
    expect(serviceMonths(s)).toBe(serviceDuration(s.identity!.service.route!));
    expect(s.professional!.qualified).toBe(true);
  }, 120000);

  it.each(clinical)('%s female voluntary military service completes through the offered choice', profession => {
    const { s, events } = professionJourney(profession, { gender: 'female', picks: { 'service:volunteer': 'volunteer' } });
    expect(events).toContain('service:volunteer');
    expect(s.identity!.service.status).toBe('completed');
    expect(s.identity!.service.route).toBe('doctor');
    expect(serviceMonths(s)).toBe(38);
    expect(s.professional!.qualified).toBe(true);
  }, 120000);

  it('female nursing stays on its own career path with no doctor military choice or clinic option', () => {
    const { s, events } = professionJourney('nursing', { gender: 'female', visit: state => {
      if (state.pendingEvent?.randomKey === 'profession:work') expect(state.pendingEvent.choices.map(c => c.id)).not.toContain('clinic');
    } });
    expect(s.identity!.service.status).toBe('not-required');
    expect(events.some(key => key.startsWith('service:'))).toBe(false);
  }, 120000);

  it('nursing field transfer carries actual experience forward and asks for a new shift', () => {
    const { s, events } = professionJourney('nursing', { field: 'nursing:ward', picks: {
      'profession:shift': 'rotating', 'profession:transition': 'transfer', 'profession:transfer': 'nursing:icu',
    } });
    expect(events.filter(key => key === 'profession:shift')).toHaveLength(2);
    expect(s.career!.specialty).toBe('nursing:icu');
    expect(s.professional!.practiceMonths['nursing:ward']).toBeGreaterThan(36);
    expect(s.professional!.practiceMonths['nursing:icu']).toBeGreaterThan(36);
    expect(s.professional!.qualified).toBe(false);
    expect(s.progress!.resolved).not.toContain('profession-transfer-pending');
  }, 120000);

  it('nursing research starts without pretending to have clinical experience and can later train in a field', () => {
    const researching = professionJourney('nursing', { route: 'research', work: 'research', stop: s => s.pendingEvent?.randomKey === 'profession:transition', visit: state => {
      if (state.pendingEvent?.randomKey === 'profession:work') expect(state.pendingEvent.choices.map(c => c.id)).toEqual(['research']);
    } }).s;
    expect(researching.professional!.practiceMonths).toEqual({});
    expect(researching.career!.specialty).toBeNull();
    const transferring = chooseProfessionEvent(researching, { picks: { 'profession:transition': 'transfer' } });
    const { s, events } = continueProfession(transferring, { picks: { 'profession:transfer': 'nursing:ward' } });
    expect(events).toContain('profession:transfer');
    expect(events).toContain('profession:shift');
    expect(s.career!.specialty).toBe('nursing:ward');
    expect(s.career!.practice).toBe('employed');
    expect(s.career!.application).toBe('accepted');
    expect(s.career!.institution).toBeTruthy();
    expect(s.professional!.practiceMonths['nursing:ward']).toBeGreaterThan(36);
  }, 120000);

  it('nursing qualification requires accumulated eligible experience and two years of funded study', () => {
    const before = professionJourney('nursing', { field: 'nursing:ward', stop: s => s.pendingEvent?.randomKey === 'profession:certificate' }).s;
    expect(before.professional!.practiceMonths['nursing:ward']).toBeGreaterThanOrEqual(36);
    expect(eligibleNursingCertificates(before)).toContain('임상');
    expect(before.pendingEvent!.choices.map(c => c.id)).toContain('임상');
    expect(before.professional!.certificateEarned).toBe(false);
    const enrolled = chooseProfessionEvent(before, { picks: { 'profession:certificate': '임상' } });
    const { s, events } = continueProfession(enrolled, { field: 'nursing:ward' });
    expect(events).toContain('profession:certificate-review');
    expect(s.professional!.certificateEarned).toBe(true);
    expect(s.professional!.certificate).toBe('임상');
    expect(s.professional!.decisions['certificate-review'].month - s.professional!.decisions.certificate.month).toBeGreaterThanOrEqual(24);
    expect(s.economy!.ledger.filter(t => t.id.startsWith('profession:education:')).length).toBeGreaterThanOrEqual(24);
    expect(s.professional!.qualified).toBe(false);
  }, 120000);

  it.each([
    ['보건', 'nursing:public-health'], ['마취', 'nursing:anesthesia'], ['가정', 'nursing:home'],
    ['정신', 'nursing:mental'], ['감염관리', 'nursing:infection'], ['산업', 'nursing:industrial'],
    ['응급', 'nursing:emergency'], ['노인', 'nursing:geriatric'], ['중환자', 'nursing:icu'],
    ['호스피스', 'nursing:hospice'], ['종양', 'nursing:oncology'], ['아동', 'nursing:pediatric'],
  ])('%s nursing certificate is earned through its matching practice and education', (certificate, field) => {
    const { s, events } = professionJourney('nursing', { field, picks: { 'profession:certificate': certificate } });
    expect(s.professional!.practiceMonths[field]).toBeGreaterThanOrEqual(36);
    expect(events).toContain('profession:certificate-review');
    expect(s.professional!.certificate).toBe(certificate);
    expect(s.professional!.certificateEarned).toBe(true);
    expect(s.professional!.decisions.certificate.choice).toBe(certificate);
    expect(s.professional!.decisions['certificate-review'].choice).toBe('exam');
    expect(s.professional!.decisions['certificate-review'].month - s.professional!.certificateStart!).toBeGreaterThanOrEqual(24);
    expect(s.professional!.qualified).toBe(false);
  }, 120000);
});
