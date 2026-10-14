import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createCareerGame, validCareerGame } from '../src/career-runtime';
import { PROFESSION_IDS, PROFESSION_SPECIALTIES, type AddedProfession } from '../src/professions';
import { PROFESSION_STORIES } from '../src/profession-stories';
import { careerSpecialties, SPECIALTIES } from '../src/career';
import { professionJourney } from './helpers/profession-play';
import Opening from '../src/Opening';
import CareerPanel from '../src/CareerPanel';

export function playProfession(profession:AddedProfession,seed=3,route='specialist',target?:string) {
 return professionJourney(profession, { seed, field: target, route: profession==='nursing'?'nurse':route==='general'?'general':route==='research'?'research':'specialist', work: route==='clinic'?'clinic':route==='research'?'research':route==='general'?'untrained':'employed' });
}
describe('profession expansion',()=>{
 it('preserves the medical default and original catalog',()=>{expect(createCareerGame('legacy',3)).toEqual(createCareerGame('legacy',3,'medicine'));expect(SPECIALTIES).toHaveLength(26);});
 it.each(PROFESSION_IDS)('starts and renders %s',p=>{const s=createCareerGame('start',3,p);expect(validCareerGame(s)).toBe(true);expect(careerSpecialties(s).length).toBeGreaterThan(0);expect(renderToStaticMarkup(<Opening draft={s} busy={false} disabled={false} entering={false} onPrepare={()=>{}} onEnter={()=>{}} onBack={()=>{}}/>)).toContain('입학 통지서');expect(()=>renderToStaticMarkup(<CareerPanel game={s} busy={false} act={()=>{}}/>)).not.toThrow();});
 it.each(['dentistry','korean-medicine','nursing'] as const)('%s has authored scenes and completes with save validation',p=>{expect(PROFESSION_STORIES.filter(e=>e.profession===p).length).toBeGreaterThanOrEqual(52);playProfession(p);},120000);
 it('contains every approved field without duplicate identifiers',()=>{expect(PROFESSION_SPECIALTIES.filter(x=>x.profession==='dentistry')).toHaveLength(11);expect(PROFESSION_SPECIALTIES.filter(x=>x.profession==='korean-medicine')).toHaveLength(8);expect(PROFESSION_SPECIALTIES.filter(x=>x.profession==='nursing')).toHaveLength(19);expect(new Set(PROFESSION_SPECIALTIES.map(x=>x.id)).size).toBe(38);});
 it('rejects foreign careers and invented qualifications',()=>{const s=createCareerGame('bad',3,'nursing');s.career!.specialty='internal';expect(validCareerGame(s)).toBe(false);s.career!.specialty=null;s.professional!.qualified=true;expect(validCareerGame(s)).toBe(false);});
});
