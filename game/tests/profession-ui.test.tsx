import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import CareerCollection from '../src/CareerCollection';
import ClinicRoom, { clinicRoom } from '../src/ClinicRoom';
import ClinicRoomDetail from '../src/ClinicRoomDetail';
import { ALL_SPECIALTIES } from '../src/career';
import { credentialKey, specialtyKey, type CareerRecord } from '../src/career-records';
import { RoomFurniture, SPECIALTY_VISUALS } from '../src/SceneScenery';

const record = (milestones: Record<string, number>): CareerRecord => ({ version: 1, runId: 'profession-ui', firstSeenAt: '2026-10-14T00:00:00Z', completed: false, milestones });

describe('profession collection and scene UI', () => {
  it('renders every specialty while preserving locked, experienced and qualified room states', () => {
    for (const { id } of ALL_SPECIALTIES) {
      expect(SPECIALTY_VISUALS[id], id).toBeDefined();
      for (const state of ['locked', 'training', 'qualified'] as const) {
        const records = state === 'locked' ? [] : [record({ [specialtyKey(id)]: 72, ...(state === 'qualified' ? { [specialtyKey(id, true)]: 144 } : {}) })];
        const html = renderToStaticMarkup(<ClinicRoom specialty={id} records={records}/>);
        expect(html, id).toContain(`data-room-state="${state}"`);
        expect(html, id).not.toMatch(/NaN|undefined|\[object Object\]/);
        if (id.includes(':') && state !== 'locked') expect(html).toContain(`data-profession-art="${id.split(':')[0]}"`);
      }
      expect(renderToStaticMarkup(<ClinicRoomDetail specialty={id} records={[]} onClose={() => {}}/>)).toContain('닫기');
    }
  });

  it('keeps nursing practice distinct from specialist physician qualifications', () => {
    const records = [record({ [specialtyKey('nursing:icu')]: 48, [credentialKey('nursing:중환자')]: 108 })];
    const html = renderToStaticMarkup(<CareerCollection records={records} initialProfession="nursing"/>);
    expect(html).toContain('1 / 19');
    expect(html).toContain('실무 경험');
    expect(html).toContain('전문간호사 자격 1 / 13');
    expect(html).not.toContain('전문의');
    expect(html).not.toContain('분과·세부');
    expect(html).not.toContain('내과 분과');
    const detail = renderToStaticMarkup(<ClinicRoomDetail specialty="nursing:icu" records={records} onClose={() => {}}/>);
    expect(detail).toContain('중환자 전문간호사');
    expect(detail).not.toContain('전문의');
    expect(detail).not.toContain('room-fields');
    expect(clinicRoom(records, 'nursing:ward').credentials).toEqual([]);
  });

  it('never awards a nurse certificate from experience alone or from another play', () => {
    const records = [record({ [specialtyKey('nursing:icu')]: 48 }), { ...record({ [credentialKey('nursing:중환자')]: 108 }), runId: 'other' }];
    expect(clinicRoom(records, 'nursing:icu').credentials).toEqual([]);
  });

  it('limits dental and Korean medicine collection tabs to available records', () => {
    for (const [profession, total] of [['dentistry', 11], ['korean-medicine', 8]] as const) {
      const html = renderToStaticMarkup(<CareerCollection records={[]} initialProfession={profession}/>);
      expect(html).toContain(`0 / ${total}`);
      expect(html).toContain('전문의 자격 모으기');
      expect(html).not.toContain('분과·세부');
      expect(html).not.toContain('전문 분야');
      expect(html).not.toContain('내과 분과');
    }
  });

  it('renders a single profession equipment group without the overlapping medical equipment', () => {
    for (const specialty of ['dentistry:orthodontics', 'korean-medicine:acupuncture', 'nursing:icu']) {
      for (const variant of [0, 1, 2] as const) {
        const html = renderToStaticMarkup(<svg><RoomFurniture room="clinic" specialty={specialty} children="none" retired={false} variant={variant}/></svg>);
        expect(html.match(/data-profession-art=/g)).toHaveLength(1);
        expect(html).not.toContain('data-equipment=');
      }
    }
    const medical = renderToStaticMarkup(<svg><RoomFurniture room="clinic" specialty="surgery" children="none" retired={false}/></svg>);
    expect(medical).toContain('data-equipment="surgical"');
    expect(medical).not.toContain('data-profession-art=');
  });
});
