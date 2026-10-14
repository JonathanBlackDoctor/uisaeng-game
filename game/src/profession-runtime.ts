import type { EventChoice, GameEvent, GameState } from './contracts';
import { applySpecialty, choosePractice, type Practice } from './career';
import { elapsedMonths, lifeAge, nextRandom } from './random-life';
import { agingStageEnds, retirementDetail } from './aging';
import { abilityScore, practiceAbilities, specialtyAbilityBonus } from './abilities';
import { NURSING_CERTIFICATES, PROFESSION_INSTITUTIONS, PROFESSION_RULES, PROFESSION_SPECIALTIES, isAddedProfession, professionDefinition, professionOf, validProfession } from './professions';
import { requiredStory, finishStories } from './life-stories';
import { clinicLevel, clinicOpen } from './clinic';
import { opportunityRank } from './opportunities';
import { connectedProfessionStory, professionStories, professionStoryOutcome, professionStorySchedule, storyAvailable } from './profession-experience';

export interface ProfessionalLife {
  experienceVersion?: 1;
  version: 1; practiceMonths: Record<string, number>; licensed: boolean; licenseMonth: number | null; examDue: number;
  route: 'pending' | 'general' | 'specialist' | 'nurse' | 'research';
  qualified: boolean; qualifiedMonth: number | null; trainingEnd: number;
  certificate: string | null; certificateStart: number | null; certificateEarned: boolean;
  academic: number; shift: 'day' | 'rotating'; lastStory: number;
  decisions: Record<string, { choice: string; month: number; followed: boolean; result: string }>;
}
export const initialProfessionalLife = (): ProfessionalLife => ({ version:1,experienceVersion:1,practiceMonths:{},licensed:false,licenseMonth:null,examDue:0,route:'pending',qualified:false,qualifiedMonth:null,trainingEnd:0,certificate:null,certificateStart:null,certificateEarned:false,academic:0,shift:'day',lastStory:0,decisions:{} });
const choice = (id:string,label:string,description='',effects:EventChoice['effects']={}):EventChoice => ({id,label,description,effects});
const recorded = (s:GameState,k:string) => !!s.professional?.decisions[k];
const fields = (s:GameState) => PROFESSION_SPECIALTIES.filter(p=>p.profession===professionOf(s));
export const trainingDuration = (s:GameState) => s.progress?.selectedSpecialty === 'dentistry:integrated' ? 36 : professionDefinition(s).trainingMonths;
export function eligibleNursingCertificates(s:GameState): string[] {
  const routes: Record<string,string[]> = { 보건:['public-health'], 마취:['anesthesia'], 가정:['home'], 정신:['mental'], 감염관리:['infection'], 산업:['industrial'], 응급:['emergency'], 노인:['geriatric'], 중환자:['icu'], 호스피스:['hospice'], 종양:['oncology'], 임상:['ward','outpatient'], 아동:['pediatric'] };
  return NURSING_CERTIFICATES.filter(c => routes[c].reduce((n,id)=>n+(s.professional?.practiceMonths['nursing:'+id]??0),0)>=36);
}
const title = (s:GameState) => fields(s).find(p=>p.id===s.career?.specialty)?.name ?? professionDefinition(s).job;
const note = (s:GameState,id:string,label:string,detail:string) => {
  const base=`profession:${id}`;
  const key=s.journal.some(e=>e.id===base)?`${base}:${s.revision}:${s.journal.length}`:base;
  s.journal.push({id:key,stage:(['university','training','career','retirement'] as const)[s.stageIndex],title:label,detail:`${lifeAge(s)} · ${detail}`,effects:{}});
};
export function professionStageEnds(s:GameState): number[] {
  const p=s.professional!, study=professionDefinition(s).studyMonths;
  const graduation=p.licenseMonth ?? Math.max(study,p.examDue);
  return agingStageEnds(s, [graduation,Math.max(graduation+1,p.trainingEnd||graduation+professionDefinition(s).trainingMonths),564,684]);
}
export function requiredProfession(s:GameState):string|null {
  const p=s.professional!,m=elapsedMonths(s),d=professionDefinition(s),c=s.career!;
  if(s.stageIndex===0) {
    if(m>=1&&!recorded(s,'club')) return 'profession:club';
    if(m>=d.studyMonths&&!p.licensed&&m>=p.examDue) return 'profession:license';
    if(p.licensed&&p.route==='pending') return 'profession:route';
    if(p.licensed&&['specialist','nurse'].includes(p.route)&&!s.progress!.selectedSpecialty) return 'profession:field';
    if(p.licensed&&['specialist','nurse'].includes(p.route)&&c.application==='none') return 'profession:institution';
    if(c.application==='rejected') return 'profession:result';
    if(p.licensed&&p.route!=='pending'&&(c.application==='accepted'||c.application==='untrained'||c.practice==='research')) {
      s.campus!.automaticFunding=false;s.stageIndex=1;
      note(s,'graduation','졸업과 면허 취득',`${d.school} 과정을 마치고 ${d.job} 면허를 취득했습니다.`);
      return requiredProfession(s);
    }
  }
  if(s.stageIndex===1&&m>=p.trainingEnd) {
    if(p.route==='specialist'&&!p.qualified) return 'profession:qualification';
    s.stageIndex=2;
    note(s,'career','다음 경력',p.route==='nurse'?'초기 적응 기간을 마치고 업무와 학습 방향을 정합니다.':'교육과 초기 경험을 바탕으로 일할 방식을 정합니다.');
    return requiredProfession(s);
  }
  if(s.stageIndex===2) {
    if(s.progress!.resolved.includes('profession-transfer-pending')) return 'profession:transfer';
    if(!recorded(s,'work')) return 'profession:work';
    if(c.practice==='clinic'&&!s.economy!.ledger.some(t=>t.kind==='open-clinic')) return 'clinic-funding';
    if(professionOf(s)==='nursing'&&c.practice==='employed'&&!recorded(s,'shift')) return 'profession:shift';
    if(professionOf(s)==='nursing'&&eligibleNursingCertificates(s).length>0&&!recorded(s,'certificate')) return 'profession:certificate';
    if(p.certificate&&!p.certificateEarned&&m>=(p.certificateStart!+24)&&!recorded(s,'certificate-review')) return 'profession:certificate-review';
    if(m>=p.trainingEnd+60&&!recorded(s,'transition')) return 'profession:transition';
    if(c.practice==='research'&&p.academic<3&&m>=p.trainingEnd+24+p.academic*48&&!recorded(s,`academic-${p.academic}`)) return `profession:academic-${p.academic}`;
    if(m>=professionStageEnds(s)[2]) {
      if(clinicOpen(s)&&clinicLevel(s)>0) return 'clinic:retire';
      s.stageIndex=3;note(s,'retirement','은퇴 이후',`${d.job}로 맡았던 일을 돌아봅니다. ${retirementDetail(s)}`);
    }
  }
  if(s.stageIndex===3&&m>=professionStageEnds(s)[3]) {s.status='completed';s.life!.paused=true;finishStories(s);if(p.experienceVersion===1){const memories=Object.entries(p.decisions).filter(([k])=>k.startsWith('story:')).slice(-3).map(([k,r])=>`${professionStories(s).find(e=>`story:${e.id}`===k)?.title}: ${r.result}`);note(s,'recap','일하며 남긴 기록',memories.join(' '));}note(s,'finish','생애 기록',`${d.job}로 시작한 일과 생활의 기록을 남겼습니다.`);return null;}
  if(m>=90&&s.family!.status!=='married'&&s.progress!.marriage!=='settled'&&(s.progress!.marriage==='pending'||m>=(s.progress!.marriageRetryMonth??0))) return 'marriage-required';
  const shared=requiredStory(s);if(shared)return shared;
  const phase=(['university','training','career','retirement'] as const)[s.stageIndex];
  const schedule=professionStorySchedule(s,phase);
  const spacing=p.experienceVersion===1?schedule.spacing:phase==='university'?6:phase==='training'?6:24;
  if(p.experienceVersion===1){
    const done=professionStories(s).filter(e=>e.phase===phase&&(!e.specialty||e.specialty===c.specialty)&&(phase==='university'||storyAvailable(s,e))&&recorded(s,`story:${e.id}`)).length;
    if(done>=schedule.limit||phase==='training'&&m<(s.progress!.trainingStartMonth??p.licenseMonth??m)+3||phase==='retirement'&&m<professionStageEnds(s)[2]+24)return null;
  }
  if(m>=p.lastStory+spacing) {
    const pool=professionStories(s).filter(e=>e.profession===professionOf(s)&&e.phase===phase&&(!e.specialty||e.specialty===c.specialty)&&storyAvailable(s,e)&&!recorded(s,`story:${e.id}`));
    const order=(id:string)=>id.endsWith(':learn')||id.endsWith(':start')?0:id.endsWith(':work')||id.endsWith(':protocol')?1:id.endsWith(':improve')||id.endsWith(':review')?2:phase==='training'?Number(id.split(':life:')[1])+3:phase==='retirement'?Number(id.split(':retirement:')[1])+3:3;
    pool.sort((a,b)=>Number(!!b.specialty)-Number(!!a.specialty)||(p.experienceVersion===1?order(a.id)-order(b.id):0)||opportunityRank(s.life!.initialSeed,a.id)-opportunityRank(s.life!.initialSeed,b.id));
    if(pool[0]) return `profession:story:${pool[0].id}`;
  }
  return null;
}
export function professionEvent(s:GameState,key:string):Pick<GameEvent,'title'|'body'|'choices'>|null {
  if(!isAddedProfession(s)||!s.professional)return null;
  const p=s.professional,d=professionDefinition(s),nurse=professionOf(s)==='nursing',k=key.replace(/^profession:/,'');
  if(k==='club')return {title:'함께할 활동',body:'수업 밖에서 만날 사람들과 활동을 정합니다.',choices:[choice('study','스터디에 참여하기','함께 과제를 검토합니다.',{knowledge:2,relationships:1}),choice('community','지역 봉사에 참여하기','지도 아래 지역 활동을 돕습니다.',{relationships:3}),choice('rest','개인 시간 확보하기','수업과 휴식에 집중합니다.',{health:2})]};
  if(k==='license')return {title:`${d.job} 국가시험`,body:'졸업에 필요한 실습을 마쳤습니다. 시험을 치르거나 준비 기간을 더 가집니다.',choices:[choice('exam','시험 치르기','학습과 판단 역량을 바탕으로 게임 내 결과를 확인합니다.'),choice('prepare','석 달 더 준비하기','졸업 이후 일정이 늦어집니다.',{knowledge:6,health:-1})]};
  if(k==='route')return {title:'면허 취득 이후',body:nurse?'첫 근무 분야와 교육 환경을 정합니다.':'수련 지원과 일반진료·연구 중 앞으로의 경로를 정합니다.',choices:nurse?[choice('nurse','간호 실무로 시작하기'),choice('research','간호연구로 시작하기')]:[choice('specialist','전문의 수련에 지원하기'),choice('general','일반진료로 시작하기'),choice('research','연구 경로로 시작하기')]};
  if(k==='field'||k==='transfer')return {title:nurse?'일할 분야 선택':'수련할 전문과목 선택',body:nurse?'부서·직무와 자격은 별개입니다. 새 분야에서는 다시 적응하고 교육을 받습니다.':'배우고 싶은 분야를 정합니다. 준비와 역량은 지원 결과에 반영됩니다.',choices:fields(s).map(f=>choice(f.id,f.name,f.exploration))};
  if(k==='institution')return {title:nurse?'첫 취업 지원':'수련기관 지원',body:'기관 이름과 선발 결과는 가상 설정입니다. 교육 환경과 생활 여건을 고려합니다.',choices:PROFESSION_INSTITUTIONS.map(i=>choice(i.id,i.name,i.description))};
  if(k==='result')return {title:'지원 결과',body:'이번 지원에서는 선발되지 않았습니다. 준비한 분야를 다시 검토하거나 다른 경로를 선택합니다.',choices:[choice('retry','다시 준비해 지원하기','교육 경험을 보완합니다.',{knowledge:4}),choice('research','연구 경로로 전환하기'),...(!nurse?[choice('general','일반진료로 시작하기')]:[])]};
  if(k==='qualification')return {title:'전문의 자격 평가',body:`${title(s)} 수련 기록과 실무 역량을 평가합니다. 부족하면 교육을 더 이어갑니다.`,choices:[choice('exam','평가 받기'),choice('prepare','석 달 더 보완하기','다음 경력 시작이 늦어집니다.',{knowledge:4})]};
  if(k==='work')return {title:'일할 방식',body:`${d.job}로서 업무와 생활의 균형을 정합니다.`,choices:[...(!nurse||s.career!.application==='accepted'?[choice(s.career!.application==='accepted'?'employed':'untrained',nurse?'현장에서 일하기':'봉직으로 일하기',`기본 월 수입 ${d.salary.toLocaleString('ko-KR')}원`)]:[]),...(!nurse?[choice('clinic',professionOf(s)==='dentistry'?'치과 개원 준비':'한의원 개원 준비','초기 자금과 운영 책임을 맡습니다.')]:[]),choice('research','연구와 교육에 집중하기')]};
  if(k==='shift')return {title:'근무 형태',body:'근무 형태에 따라 수입과 회복 시간이 달라집니다. 부서 이동 때 다시 정할 수 있습니다.',choices:[choice('day','주간 근무 중심','기본 수입과 규칙적인 일정을 유지합니다.'),choice('rotating','교대근무','매달 게임 수당 40만원, 석 달마다 건강 -2.',{health:-1})]};
  if(k==='certificate')return {title:'전문간호사 교육',body:'실무 경력을 쌓았습니다. 분야별 인정기관 경력을 확인하고 2년 이상 교육과 시험을 거치는 경로입니다. 게임에서는 관련 경력을 단순화합니다.',choices:[...NURSING_CERTIFICATES.filter(c=>eligibleNursingCertificates(s).includes(c)||p.certificate===c).map(c=>choice(c,c,`게임 내 24개월 학습과 평가 · 매달 교육비 12만원`)),choice('skip','현재 실무에 집중하기')]};
  if(k==='certificate-review')return {title:'전문간호사 자격 평가',body:`${p.certificate} 분야의 교육 기록과 역량을 검토합니다.`,choices:[choice('exam','자격 평가 받기'),choice('skip','자격 취득은 보류하기')]};
  if(k==='transition')return {title:'경력의 다음 방향',body:nurse?'부서 이동이나 연구·교육으로 경력을 이어갈 수 있습니다.':'지금의 일과 연구·교육 중 이어갈 방향을 정합니다.',choices:[choice('stay','현재 일을 이어가기'),...(nurse?[choice('transfer','다른 부서·직무로 이동하기')]:[]),...(!clinicOpen(s)?[choice('research','연구와 교육으로 전환하기')]:[])]};
  if(k.startsWith('academic-'))return {title:'교육·연구 경력 심사',body:'논문과 교육 경험을 정리해 다음 역할에 지원합니다.',choices:[choice('apply','연구·교육 기록으로 지원하기','역량이 부족하면 현재 역할을 유지합니다.'),choice('stay','현재 역할에 집중하기')]};
  if(k.startsWith('story:')) {
    const e=professionStories(s).find(e=>`story:${e.id}`===k&&e.profession===professionOf(s));if(!e)return null;
    if(p.experienceVersion===1)return connectedProfessionStory(s,e);
    return {title:e.title,body:e.body,choices:[choice('review',e.actions[0],'기록과 판단을 깊게 살피며 시간을 더 씁니다.',{knowledge:2,health:-1}),choice('team',e.actions[1],'동료와 확인하고 역할을 나눕니다.',{relationships:2,knowledge:1}),choice('defer','지원받아 범위 조정하기','담당자에게 인계하고 회복 시간을 확보합니다.',{health:2,happiness:1})]};
  }
  return null;
}
export function settleProfession(s:GameState,key:string,id:string):boolean {
  const p=s.professional!,m=elapsedMonths(s),k=key.replace(/^profession:/,''),d=professionDefinition(s),c=s.career!;
  const event=professionEvent(s,key),picked=event?.choices.find(c=>c.id===id);if(!picked)return false;
  let result=picked.description||picked.label;
  if(k==='license') {
    if(id==='exam'&&s.stats.knowledge+abilityScore(s,['judgment'])/5>=PROFESSION_RULES.licenseKnowledge){p.licensed=true;p.licenseMonth=m;result=`${d.job} 면허를 취득했습니다.`;}
    else {p.examDue=m+3;s.stats.knowledge=Math.min(100,s.stats.knowledge+(id==='exam'?4:0));result='석 달 뒤 다시 준비 상태를 확인합니다.';}
  } else if(k==='route'||k==='result'&&id!=='retry') {
    p.route=id as ProfessionalLife['route'];p.trainingEnd=m+(id==='specialist'?d.trainingMonths:12);
    if(id==='general'||id==='research')s.career=choosePractice(c,id==='general'?'untrained':'research');
  } else if(k==='field'||k==='transfer') {
    s.progress!.selectedSpecialty=id;
    if(k==='transfer'){c.specialty=id;c.interest=id;c.application='accepted';c.attempts=Math.max(1,c.attempts);c.practice='employed';c.institution??='profession-community';p.route='nurse';s.progress!.trainingStartMonth=m;p.trainingEnd=m+12;s.stageIndex=1;if(!c.explored.includes(id))c.explored.push(id);delete c.lastApplication;delete p.decisions.shift;p.shift='day';result='부서를 옮겨 동료와 교육·인계 일정을 정했습니다.';}
  } else if(k==='institution') {
    const draw=nextRandom(s.seed);s.seed=draw.seed;
    const application=applySpecialty(c,s.progress!.selectedSpecialty!,id,s.stats.knowledge,draw.value,specialtyAbilityBonus(s,s.progress!.selectedSpecialty!));s.career=application.state;
    result=application.accepted?'지원한 기관에 선발됐습니다. 교육과 첫 일정을 준비합니다.':'이번에는 선발되지 않았습니다. 준비와 경로를 다시 정합니다.';
    if(application.accepted){s.progress!.trainingStartMonth=m;p.trainingEnd=m+(p.route==='specialist'?trainingDuration(s):12);if(p.route==='nurse')s.career.practice='employed';}
  } else if(k==='result'&&id==='retry') {c.application='none';c.specialty=null;c.institution=null;delete c.lastApplication;delete s.progress!.selectedSpecialty;}
  else if(k==='qualification') {
    if(id==='exam'&&s.stats.knowledge+(s.depth?.skill??0)>=45){p.qualified=true;p.qualifiedMonth=m;result=`${title(s)} 전문의 자격을 취득했습니다.`;}
    else {p.trainingEnd=m+3;s.depth!.skill=Math.min(100,s.depth!.skill+5);result='교육을 석 달 더 이어갑니다.';}
  } else if(k==='work'){s.career=choosePractice(c,id as Practice);}
  else if(k==='shift'){p.shift=id as ProfessionalLife['shift'];}
  else if(k==='certificate'&&id!=='skip'){if(!eligibleNursingCertificates(s).includes(id))return false;p.certificate=id;p.certificateStart=m;}
  else if(k==='certificate-review'){p.certificateEarned=id==='exam'&&s.stats.knowledge+abilityScore(s,['judgment','communication'])>=80;result=p.certificateEarned?`${p.certificate} 전문간호사 자격을 취득했습니다.`:'이번 자격 취득을 보류하고 실무를 이어갑니다.';}
  else if(k==='transition'){
    if(id==='transfer'){delete p.decisions.transfer; s.progress!.resolved.push('profession-transfer-pending');}
    if(id==='research'){c.practice='research';if(s.clinic?.level){return false;}result='연구와 교육을 중심으로 일합니다.';}
  } else if(k.startsWith('academic-')&&id==='apply') {if(s.stats.knowledge+abilityScore(s,['research'])>=80){p.academic=Math.min(3,p.academic+1);result=['','교육·연구 담당','선임 연구·교육 담당','연구·교육 책임자'][p.academic]+' 역할을 맡았습니다.';}else result='이번에는 현재 역할을 유지하며 연구 경험을 더 쌓습니다.';}
  if(k==='transfer')s.progress!.resolved=s.progress!.resolved.filter(x=>x!=='profession-transfer-pending');
  if(k.startsWith('story:')) {
    p.lastStory=m;const score=abilityScore(s,id==='review'?['judgment','technique']:['communication','management'])-(s.dynamics?.fatigue??0);
    const gain=id==='defer'?(p.experienceVersion===1?0:1):score>=40?4:2;s.depth!.skill=Math.min(100,s.depth!.skill+gain);s.depth!.safety=Math.min(100,s.depth!.safety+(id==='team'?3:id==='defer'&&p.experienceVersion===1?0:1));
    practiceAbilities(s,id==='review'?['judgment','technique']:id==='team'?['communication','management']:['selfManagement'],1,event!.title);
    result=p.experienceVersion===1?professionStoryOutcome(s,professionStories(s).find(e=>`story:${e.id}`===k)!,id):id==='defer'?'담당자와 범위를 조정하고 휴식 시간을 확보했습니다.':`${score>=40?'익숙한 역량을 활용해 확인 과정을 마쳤습니다.':'낯선 부분을 동료와 다시 확인했습니다.'} 숙련 경험 +${gain}.`;
  }
  p.decisions[k]={choice:id,month:m,followed:false,result};note(s,`${k}:${m}`,event!.title,result);return true;
}
export function advanceProfession(s:GameState) {
  const p=s.professional!,m=elapsedMonths(s);
  if(professionOf(s)==='nursing'&&s.career?.specialty&&s.career.practice==='employed'&&s.stageIndex>0&&s.stageIndex<3) p.practiceMonths[s.career.specialty]=(p.practiceMonths[s.career.specialty]??0)+1;
  for(const [k,r] of Object.entries(p.decisions))if(!r.followed&&m>=r.month+3){r.followed=true;if(k.startsWith('story:')){const scene=professionStories(s).find(e=>`story:${e.id}`===k)!;note(s,`follow:${k}`,'그 뒤의 기록',`${scene.title}: ${p.experienceVersion===1?r.result+' '+(r.choice==='defer'?'인계받은 담당자와 남은 내용을 확인했습니다.':'다음에 참고할 기록으로 남겼습니다.'):r.choice==='defer'?'인계한 내용을 확인하고 조정한 일정을 이어갔습니다.':r.choice==='team'?'함께 정한 확인 방법을 다음 업무에도 적용했습니다.':'검토한 내용을 기록으로 남겨 다음에 참고했습니다.'}`);}}
  if(professionOf(s)==='nursing'&&s.stageIndex>0&&s.stageIndex<3) {
    const e=s.economy!;
    if(p.shift==='rotating'&&s.career?.practice==='employed'){e.cash+=400_000;e.assets+=400_000;e.income+=400_000;e.ledger.push({id:`profession:shift:${m}`,month:m,label:'교대근무 수당',cashDelta:400_000,debtDelta:0,kind:'monthly'});if(m%3===0)s.stats.health=Math.max(0,s.stats.health-2);}
    if(p.certificateStart!==null&&!p.certificateEarned&&!recorded(s,'certificate-review')){
      if(e.cash>=120_000){e.cash-=120_000;e.assets-=120_000;e.expenses+=120_000;e.ledger.push({id:`profession:education:${m}`,month:m,label:'전문 교육비',cashDelta:-120_000,debtDelta:0,kind:'monthly'});s.stats.knowledge=Math.min(100,s.stats.knowledge+1);}
      else {p.certificateStart++;}
    }
  }
}
export function validProfessionalLife(s:GameState):boolean {
  if(s.profession!==undefined&&!validProfession(s.profession))return false;
  if(!isAddedProfession(s))return s.professional===undefined&&(s.career?.profession===undefined||s.career.profession==='medicine');
  const p=s.professional,m=elapsedMonths(s),c=s.career;
  if(!p||p.version!==1||!c||c.profession!==s.profession||!['pending','general','specialist','nurse','research'].includes(p.route))return false;
  if(p.experienceVersion!==undefined&&p.experienceVersion!==1)return false;
  if([p.licensed,p.qualified,p.certificateEarned].some(v=>typeof v!=='boolean')||!['day','rotating'].includes(p.shift))return false;
  if(![p.examDue,p.trainingEnd,p.lastStory,p.academic].every(v=>Number.isSafeInteger(v)&&v>=0)||p.academic>3||p.lastStory>m)return false;
  if(p.licensed!==(p.licenseMonth!==null)||p.qualified!==(p.qualifiedMonth!==null))return false;
  if([p.licenseMonth,p.qualifiedMonth,p.certificateStart].some(v=>v!==null&&(!Number.isSafeInteger(v)||v<0||v>m)))return false;
  if(p.licenseMonth!==null&&p.licenseMonth<professionDefinition(s).studyMonths||s.stageIndex>0&&!p.licensed)return false;
  if(p.qualified&&(p.route!=='specialist'||p.qualifiedMonth!<(s.progress?.trainingStartMonth??p.licenseMonth!)+trainingDuration(s)))return false;
  if(professionOf(s)==='nursing'&&(c.practice==='clinic'||p.route==='specialist'||p.qualified))return false;
  if(professionOf(s)!=='nursing'&&(p.route==='nurse'||p.certificate!==null||p.shift!=='day'))return false;
  if(!p.practiceMonths||Array.isArray(p.practiceMonths)||Object.entries(p.practiceMonths).some(([id,n])=>!fields(s).some(f=>f.id===id)||!Number.isSafeInteger(n)||n<0||n>m))return false;
  if(p.certificate!==null&&!(NURSING_CERTIFICATES as readonly string[]).includes(p.certificate))return false;
  if(p.certificateEarned&&(!p.certificate||!eligibleNursingCertificates(s).includes(p.certificate)||p.certificateStart===null||m<p.certificateStart+24))return false;
  if(!p.decisions||Array.isArray(p.decisions)||Object.keys(p.decisions).length>150)return false;
  if(s.progress?.selectedSpecialty!==undefined&&!fields(s).some(f=>f.id===s.progress!.selectedSpecialty))return false;
  if(!p.licensed&&p.route!=='pending')return false;
  if(p.licensed&&(p.decisions.license?.choice!=='exam'||p.decisions.license.month!==p.licenseMonth))return false;
  if(p.qualified&&(!c.specialty||c.application!=='accepted'||s.progress?.trainingStartMonth===undefined||p.decisions.qualification?.choice!=='exam'||p.decisions.qualification.month!==p.qualifiedMonth))return false;
  if(s.stageIndex>=2&&p.route==='specialist'&&!p.qualified)return false;
  if(p.certificate===null&&p.certificateStart!==null)return false;
  if(p.certificate!==null&&(p.certificateStart===null||p.decisions.certificate?.choice!==p.certificate||p.certificateStart<p.decisions.certificate.month))return false;
  if(p.certificateEarned&&(p.decisions['certificate-review']?.choice!=='exam'||p.decisions['certificate-review'].month<p.certificateStart!+24))return false;
  if(Object.values(p.practiceMonths).reduce((sum,n)=>sum+n,0)>Math.max(0,m-(p.licenseMonth??m)))return false;
  if(professionOf(s)==='nursing'&&c.practice==='untrained')return false;
  if(Array.from({length:p.academic},(_,i)=>p.decisions[`academic-${i}`]?.choice).some(c=>c!=='apply'))return false;
  return Object.entries(p.decisions).every(([k,r])=>!!r&&Number.isSafeInteger(r.month)&&r.month>=0&&r.month<=m&&typeof r.followed==='boolean'&&(!r.followed||m>=r.month+3)&&typeof r.result==='string'&&!!professionEvent(s,`profession:${k}`)?.choices.some(c=>c.id===r.choice));
}
export function professionalSummary(s:GameState):string|null {
  if(!s.professional)return null;
  const p=s.professional;
  return [p.licensed?`${professionDefinition(s).job} 면허`:'면허 취득 준비',p.qualified?`${title(s)} 전문의`:null,p.certificateEarned?`${p.certificate} 전문간호사`:null,p.academic?['','교육·연구 담당','선임 연구·교육 담당','연구·교육 책임자'][p.academic]:null].filter(Boolean).join(' · ');
}
