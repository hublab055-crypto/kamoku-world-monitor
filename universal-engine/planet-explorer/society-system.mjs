/** Offline town society simulation, isolated from WebGL and multiplayer authority.
 * Employment, schools, clinics and households persist independently of renderer NPCs.
 * The same resident IDs as settlementLayout are used for visible townsfolk.
 */
import {DESTINATIONS,settlementLayout} from "./settlements.mjs?v=0.8y-harbor";

export const SOCIETY_OCCUPATIONS=Object.freeze({
 farmer:{name:"農業",skill:0,education:0,public:false},
 craft:{name:"職人・工員",skill:1,education:0,public:false},
 merchant:{name:"商業",skill:1,education:1,public:false},
 guard:{name:"衛兵",skill:1,education:0,public:true},
 clerk:{name:"行政職員",skill:2,education:2,public:true},
 teacher:{name:"教師",skill:2,education:2,public:true},
 medic:{name:"医療職員",skill:3,education:2,public:true}
});
const clamp=(x,min,max)=>Math.max(min,Math.min(max,x));
const nat=(x,fallback=0,max=1e7)=>Number.isSafeInteger(x)&&x>=0?Math.min(max,x):fallback;
const validTown=id=>DESTINATIONS.some(t=>t.id===id);
const result=(ok,message,extra={})=>({ok,message,...extra});
const freshResident=(townId,i)=>({
 id:"resident-"+i,householdId:"household-"+Math.floor(i/3),
 age:i%7===0?9+i%8:18+(i*11+townId.length*3)%43,
 education:i%7===0?0:(i*7+townId.length)%4,
 skill:i%7===0?0:(i*13+townId.length)%4,
 health:clamp(65+(i*17+townId.length*9)%36,0,100),
 employerId:null,experience:0,studying:false
});
function makeTown(place){
 const ids=place.id==="pioneer"?Array.from({length:18},(_,i)=>i):
  settlementLayout(place.id).residents.map(p=>Number(p.id.slice("resident-".length)));
 const count=ids.length;
 const people=ids.map(i=>freshResident(place.id,i));
 const city=place.kind==="city",town=place.kind==="town";
 const jobs=[
  {id:"job-1",occupation:"farmer",ownerId:"community",sector:"private",wage:45,capacity:city?5:3},
  {id:"job-2",occupation:"craft",ownerId:"guild",sector:"private",wage:72,capacity:city?7:3},
  {id:"job-3",occupation:"merchant",ownerId:"market",sector:"private",wage:64,capacity:city?5:2},
  {id:"job-4",occupation:"guard",ownerId:"council",sector:"public",wage:85,capacity:city?4:2},
  {id:"job-5",occupation:"teacher",ownerId:"council",sector:"public",wage:100,capacity:city?2:1},
  {id:"job-6",occupation:"medic",ownerId:"council",sector:"public",wage:125,capacity:city?2:1}
 ];
 // Qualified staff are generated explicitly; otherwise new towns could never
 // start basic education or health care until an external training system exists.
 for(const [i,jobId] of [[0,"job-5"],[1,"job-6"]]){
  const person=people[i];if(!person)continue;
  person.age=27+i*7;person.education=3;person.skill=3;person.employerId=jobId;
 }
 const schools=city?2:1,clinics=city?2:1;
 return {id:place.id,name:place.name,people,jobs,schools,clinics,
  housingCapacity:count+6,schoolSeats:schools*(city?16:10),
  clinicBeds:clinics*(city?8:4),nextResidentId:Math.max(...ids)+1,nextJobId:7,
  events:[]};
}
const validResident=p=>p&&typeof p.id==="string"&&/^resident-\d+$/.test(p.id)&&
 Number.isSafeInteger(p.age)&&p.age>=0&&p.age<=150&&
 Number.isSafeInteger(p.education)&&p.education>=0&&p.education<=5&&
 Number.isSafeInteger(p.skill)&&p.skill>=0&&p.skill<=5&&
 Number.isFinite(p.health)&&p.health>=0&&p.health<=100;
export class SocietySystem{
 constructor(saved=null,nowDay=0){
  this.towns=Object.fromEntries(DESTINATIONS.map(d=>[d.id,makeTown(d)]));
  this.lastDay=Math.floor(Math.max(0,Number(nowDay)||0));
  this.playerJob=null;
  this.playerWagesOwed=0;
  if(saved?.schemaVersion!==1)return;
  this.lastDay=nat(saved.lastDay,this.lastDay,100000000);
  this.playerWagesOwed=nat(saved.playerWagesOwed,0,999999);
  for(const [id,source] of Object.entries(saved.towns||{})){
   const t=this.towns[id];if(!t||!source)continue;
   if(Array.isArray(source.jobs)){
    const incoming=source.jobs.slice(0,100).filter(j=>j&&/^job-\d+$/.test(j.id)&&
     SOCIETY_OCCUPATIONS[j.occupation]&&
     ["public","private"].includes(j.sector)&&typeof j.ownerId==="string"&&
     j.ownerId.length<=40&&nat(j.wage)===j.wage&&j.wage>=1&&j.wage<=10000&&
     nat(j.capacity)===j.capacity&&j.capacity>=1&&j.capacity<=100);
    if(incoming.length&&new Set(incoming.map(j=>j.id)).size===incoming.length)
     t.jobs=incoming.map(j=>({id:j.id,occupation:j.occupation,ownerId:j.ownerId,
      sector:j.sector,wage:j.wage,capacity:j.capacity}));
   }
   if(Array.isArray(source.people)){
    const people=source.people.slice(0,500).filter(validResident);
    if(people.length&&new Set(people.map(p=>p.id)).size===people.length){
     t.people=people.map(p=>({
      id:p.id,householdId:typeof p.householdId==="string"?p.householdId.slice(0,40):"household-0",
      age:p.age,education:p.education,skill:p.skill,health:p.health,
      employerId:t.jobs.some(j=>j.id===p.employerId)?p.employerId:null,
      experience:nat(p.experience,0,99999),studying:!!p.studying
     }));
    }
   }
   t.schools=nat(source.schools,t.schools,30);
   t.clinics=nat(source.clinics,t.clinics,30);
   t.schoolSeats=nat(source.schoolSeats,t.schoolSeats,500);
   t.clinicBeds=nat(source.clinicBeds,t.clinicBeds,500);
   t.housingCapacity=nat(source.housingCapacity,t.housingCapacity,1000);
   t.nextResidentId=Math.max(nat(source.nextResidentId,t.people.length,100000),
    ...t.people.map(p=>Number(p.id.slice(9))+1));
   t.nextJobId=Math.max(nat(source.nextJobId,t.jobs.length+1,100000),
    ...t.jobs.map(j=>Number(j.id.slice(4))+1));
   t.events=Array.isArray(source.events)?source.events.filter(e=>typeof e==="string").slice(-12)
    .map(e=>e.slice(0,120)):[];
  }
  const pj=saved.playerJob;
  if(pj&&validTown(pj.townId)&&this.towns[pj.townId].jobs.some(j=>j.id===pj.jobId))
   this.playerJob={townId:pj.townId,jobId:pj.jobId};
 }
 town(id){return this.towns[id]||null;}
 job(t,jobId){return t?.jobs.find(j=>j.id===jobId)||null;}
 staff(t,occupation){return t.people.filter(p=>this.job(t,p.employerId)?.occupation===occupation);}
 vacancies(t,job){
  const occupied=t.people.filter(p=>p.employerId===job.id).length+
   (this.playerJob?.townId===t.id&&this.playerJob.jobId===job.id?1:0);
  return Math.max(0,job.capacity-occupied);
 }
 qualified(person,job){const r=SOCIETY_OCCUPATIONS[job.occupation];
  return !!r&&person.age>=18&&person.education>=r.education&&person.skill>=r.skill&&person.health>=40;}
 stats(id){
  const t=this.town(id);if(!t)return null;
  const employed=t.people.filter(p=>p.employerId).length,adults=t.people.filter(p=>p.age>=18).length;
  const teachers=this.staff(t,"teacher").length,medics=this.staff(t,"medic").length;
  const schoolCapacity=Math.min(t.schoolSeats,teachers*10);
  const clinicCapacity=Math.min(t.clinicBeds,medics*4);
  const students=t.people.filter(p=>p.studying).length;
  const patients=t.people.filter(p=>p.health<70).length;
  const vacancies=t.jobs.reduce((n,j)=>n+this.vacancies(t,j),0);
  return {population:t.people.length,households:new Set(t.people.map(p=>p.householdId)).size,
   adults,employed,unemployed:adults-employed,students,teachers,medics,
   schoolCapacity,clinicCapacity,patients,vacancies,
   averageHealth:Math.round(t.people.reduce((n,p)=>n+p.health,0)/Math.max(1,t.people.length)),
   housingCapacity:t.housingCapacity};
 }
 record(t,message){t.events.push(message);if(t.events.length>12)t.events.shift();}
 postJob(townId,occupation,capacity,wage){
  const t=this.town(townId),spec=SOCIETY_OCCUPATIONS[occupation];
  if(!t||!spec||!Number.isSafeInteger(capacity)||capacity<1||capacity>30||
   !Number.isSafeInteger(wage)||wage<1||wage>10000)
   return result(false,"求人条件を確認してください");
  if(t.jobs.length>=100)return result(false,"求人枠の上限です");
  const j={id:"job-"+t.nextJobId++,occupation,ownerId:"player",sector:"private",wage,capacity};
  t.jobs.push(j);this.record(t,"求人："+spec.name+" "+capacity+"人");
  return result(true,"📣 "+t.name+"で"+spec.name+"の求人を公開しました",{job:j});
 }
 hireNext(townId,jobId){
  const t=this.town(townId),j=this.job(t,jobId);
  if(!j)return result(false,"求人が見つかりません");
  if(!this.vacancies(t,j))return result(false,"募集定員に達しました");
  const candidate=t.people.filter(p=>!p.employerId&&this.qualified(p,j))
   .sort((a,b)=>(b.skill+b.education)-(a.skill+a.education)||a.id.localeCompare(b.id))[0];
  if(!candidate)return result(false,"応募条件に合う求職者がいません。教育・職業訓練が必要です");
  candidate.employerId=j.id;this.record(t,candidate.id+" が "+SOCIETY_OCCUPATIONS[j.occupation].name+" に採用");
  return result(true,"🤝 "+candidate.id+" を採用しました",{residentId:candidate.id});
 }
 applyPlayer(townId,jobId){
  const t=this.town(townId),j=this.job(t,jobId);
  if(!j||!this.vacancies(t,j))return result(false,"応募できる空き求人がありません");
  if(this.playerJob)return result(false,"すでに就職中です。退職後に応募してください");
  // Avatar skill/qualifications are not yet mapped; the initial gameplay only
  // supports unqualified entry-level jobs, never licensed teaching/medicine.
  if(SOCIETY_OCCUPATIONS[j.occupation].skill>0||
   SOCIETY_OCCUPATIONS[j.occupation].education>0)
   return result(false,"この職種への応募には資格・技能の連携が必要です");
  this.playerJob={townId,jobId};
  this.record(t,"プレイヤーが "+SOCIETY_OCCUPATIONS[j.occupation].name+" に就職");
  return result(true,"🧑‍💼 採用されました。滞在中の勤務日数に応じて給与が発生します");
 }
 resignPlayer(){
  if(!this.playerJob)return result(false,"就職していません");
  this.playerJob=null;return result(true,"退職しました。未受領の給与は残ります");
 }
 enroll(townId,residentId){
  const t=this.town(townId),p=t?.people.find(x=>x.id===residentId);
  if(!p)return result(false,"対象の住民がいません");
  const s=this.stats(townId);
  if(!s.schoolCapacity||s.students>=s.schoolCapacity)return result(false,"教師または教室の定員が不足しています");
  if(p.studying||p.education>=5)return result(false,"入学条件を確認してください");
  p.studying=true;this.record(t,residentId+" が入学");
  return result(true,"📚 "+residentId+" が学校に通い始めました");
 }
 treat(townId,residentId){
  const t=this.town(townId),p=t?.people.find(x=>x.id===residentId);
  if(!p)return result(false,"対象の住民がいません");
  const s=this.stats(townId);
  if(!s.clinicCapacity)return result(false,"医療職員または病床が不足しています");
  if(p.health>=100)return result(false,"治療の必要がありません");
  p.health=clamp(p.health+Math.min(25,s.clinicCapacity*3),0,100);
  this.record(t,residentId+" を診療");
  return result(true,"🏥 診療しました。健康状態 "+Math.round(p.health)+"/100");
 }
 advanceUntil(timeDays,{activeTownId=null,playerCanWork=true}={}){
  const target=Math.floor(Math.max(0,Number(timeDays)||0));
  if(target<=this.lastDay)return 0;
  const first=Math.max(this.lastDay+1,target-179); // bounded fast-forward
  for(let d=first;d<=target;d++){
   for(const t of Object.values(this.towns)){
    const s=this.stats(t.id);
    // One school day gives progress; formal levels advance after sustained study.
    if(s.schoolCapacity){
     for(const p of t.people.filter(p=>p.studying).slice(0,s.schoolCapacity)){
      p.experience=nat(p.experience+1,0,99999);
      if(p.experience%25===0){
       p.education=clamp(p.education+1,0,5);p.skill=clamp(p.skill+1,0,5);
       if(p.education===5)p.studying=false;
      }
     }
    }
    if(s.clinicCapacity){
     for(const p of t.people.filter(p=>p.health<70).slice(0,s.clinicCapacity))
      p.health=clamp(p.health+2,0,100);
    }
    // Deterministic occasional illness/injury; no random-frame side effects.
    if(d%37===0&&t.people.length){
     const p=t.people[(Math.floor(d/37)+t.id.length)%t.people.length];
     p.health=clamp(p.health-12,0,100);
    }
    // Qualified applicants take vacancies, including public roles.
    for(const j of t.jobs)if(this.vacancies(t,j))this.hireNext(t.id,j.id);
    if(d%360===0)for(const p of t.people)p.age=clamp(p.age+1,0,150);
    // A conservative aggregate resident-migration layer. Newly arrived people
    // do not become rendered 3-D actors until the renderer can expand its roster.
    if(d%30===0&&t.people.length<t.housingCapacity&&
      this.stats(t.id).vacancies>0&&this.stats(t.id).averageHealth>=65){
     t.people.push(freshResident(t.id,t.nextResidentId++));
     this.record(t,"新しい住民が転入");
    }
   }
   if(playerCanWork&&this.playerJob?.townId===activeTownId){
    const t=this.town(activeTownId),j=this.job(t,this.playerJob.jobId);
    if(j&&d%7!==0)this.playerWagesOwed=clamp(this.playerWagesOwed+j.wage,0,999999);
   }
  }
  this.lastDay=target;return target-first+1;
 }
 collectWages(wallet){
  if(!wallet||!Number.isSafeInteger(wallet.coins))return result(false,"所持金を確認できません");
  if(!this.playerWagesOwed)return result(false,"未受領の給与はありません");
  const paid=Math.min(this.playerWagesOwed,Math.max(0,999999-wallet.coins));
  if(!paid)return result(false,"所持コインの上限です");
  wallet.coins+=paid;this.playerWagesOwed-=paid;
  return result(true,"💰 給与 "+paid+" コインを受け取りました",{paid});
 }
 snapshot(){
  return {schemaVersion:1,lastDay:this.lastDay,playerJob:this.playerJob?{...this.playerJob}:null,
   playerWagesOwed:this.playerWagesOwed,
   towns:Object.fromEntries(Object.entries(this.towns).map(([id,t])=>[id,{
    ...t,people:t.people.map(p=>({...p})),jobs:t.jobs.map(j=>({...j})),events:[...t.events]
   }]))};
 }
}
