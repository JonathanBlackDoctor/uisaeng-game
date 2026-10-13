import { SPECIALTY_PATHS } from './specialty-paths';

// Only reviewed mappings grant a credential. Absence means unverified, not nonexistent.
export interface Credential {
  id: string; name: string; kind: '분과전문의' | '세부전문의';
  routes: { specialty: string; field: string }[];
  source: string;
}
const internalSource = 'https://kaim.or.kr/specialist/popup/popup_rule2020.html';
const pediatricSource = 'https://www.kihasa.re.kr/api/kihasa/file/download?seq=26212';
export const CREDENTIALS: Credential[] = [
  ...['소화기', '순환기', '호흡기', '내분비대사', '신장', '혈액종양', '감염', '알레르기', '류마티스'].map((name, i) => ({
    id: `internal-${i}`, name: `${name}내과`, kind: '분과전문의' as const,
    routes: [{ specialty: 'internal', field: `field-${i}` }], source: internalSource,
  })),
  ...['신생아', '소아심장', '소아신경', '소아혈액종양', '소아소화기영양', '소아내분비', '소아신장', '소아감염', '소아알레르기호흡기'].map((name, i) => ({
    id: `pediatrics-${i}`, name, kind: '분과전문의' as const,
    routes: [{ specialty: 'pediatrics', field: `field-${i}` }],
    source: i === 2 ? 'https://www.cns.or.kr/specialist/rule' : pediatricSource,
  })),
  { id: 'hand-surgery', name: '수부외과', kind: '세부전문의', routes: [{ specialty: 'orthopedics', field: 'field-3' }, { specialty: 'plastic', field: 'field-0' }], source: 'https://handsurgery.or.kr/specialist/rule_2.php' },
  { id: 'pediatric-emergency', name: '소아응급의학', kind: '세부전문의', routes: [{ specialty: 'pediatrics', field: 'field-9' }, { specialty: 'emergency', field: 'field-0' }], source: 'https://www.kspem.org/down/소아응급의학세부전문의%20규정집.pdf' },
  { id: 'digestive-endoscopy', name: '소화기내시경', kind: '세부전문의', routes: ['internal', 'surgery', 'pediatrics'].map(specialty => ({ specialty, field: 'credential-endoscopy' })), source: 'https://www.gie.or.kr/branch/rule/' },
];
export const credentialFor = (specialty: string, field: string) => CREDENTIALS.find(c => c.routes.some(r => r.specialty === specialty && r.field === field));
export function specialtyFields(specialty: string, modern = true) {
  const fields = SPECIALTY_PATHS[specialty]?.fields ?? [];
  return modern && ['internal', 'surgery', 'pediatrics'].includes(specialty)
    ? [...fields, { id: 'credential-endoscopy', name: '소화기내시경', problem: '검사 설명과 시술 뒤 관찰을 여러 팀이 일관되게 이어가야 한다' }]
    : fields;
}
// Game pacing, not a reproduction of current society-specific training requirements.
export const CREDENTIAL_GAME_RULES = { version: 'credential-provisional-1', provisional: true, preparationMonths: 6, trainingMonths: 24 };
