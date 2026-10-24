import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {SocietySystem,SOCIETY_OCCUPATIONS} from "../planet-explorer/society-system.mjs";
import {settlementLayout} from "../planet-explorer/settlements.mjs";
import {installSocietyUI} from "../planet-explorer/society-ui.mjs";

test("stable town rosters correspond to existing visible resident IDs",()=>{
 const society=new SocietySystem(null,.25);
 for(const townId of ["capital","port","forest","tower"]){
  const t=society.town(townId);
  const ids=new Set(t.people.map(p=>p.id));
  for(const rendered of settlementLayout(townId).residents)
   assert.ok(ids.has(rendered.id),townId+":"+rendered.id);
  assert.ok(society.stats(townId).population>0);
  assert.ok(society.stats(townId).teachers>=1);
  assert.ok(society.stats(townId).medics>=1);
 }
 assert.equal(society.town("wilderness"),null);
});
test("postings validate occupations, wages, sizes and hire only eligible workers",()=>{
 const society=new SocietySystem(),t=society.town("capital");
 assert.equal(society.postJob("capital","invalid",1,100).ok,false);
 assert.equal(society.postJob("capital","craft",0,100).ok,false);
 assert.equal(society.postJob("capital","craft",3,-2).ok,false);
 const posted=society.postJob("capital","farmer",2,70);
 assert.equal(posted.ok,true);
 assert.equal(posted.job.ownerId,"player");
 const first=society.hireNext("capital",posted.job.id);
 assert.ok(first.ok);
 assert.ok(t.people.find(p=>p.id===first.residentId).age>=18);
 assert.equal(t.people.find(p=>p.id===first.residentId).employerId,posted.job.id);
 assert.equal(society.vacancies(t,posted.job),1);
 const second=society.hireNext("capital",posted.job.id);
 assert.ok(second.ok);
 assert.equal(society.hireNext("capital",posted.job.id).ok,false);
});
test("school enrollment needs teachers and actual progress takes time",()=>{
 const society=new SocietySystem(),t=society.town("port");
 const student=t.people.find(p=>p.education<5&&!p.studying);
 assert.ok(society.enroll("port",student.id).ok);
 assert.equal(society.enroll("port",student.id).ok,false);
 const before=student.education;
 society.advanceUntil(25);
 assert.ok(student.education>before);
 assert.ok(student.skill>=1);
 assert.equal(society.advanceUntil(25),0);
 const t2=society.town("mountain");
 for(const teacher of society.staff(t2,"teacher"))teacher.employerId=null;
 assert.equal(society.enroll("mountain",t2.people[2].id).ok,false);
});
test("clinic care depends on staff and doesn't exceed maximum health",()=>{
 const society=new SocietySystem(),t=society.town("forest"),p=t.people[3];
 p.health=60;
 assert.ok(society.treat("forest",p.id).ok);
 assert.ok(p.health>60&&p.health<=100);
 for(const medic of society.staff(t,"medic"))medic.employerId=null;
 assert.equal(society.treat("forest",p.id).ok,false);
});
test("player can accept basic work, earn once per day and retain unpaid wages across saves",()=>{
 const society=new SocietySystem(null,1),t=society.town("pioneer");
 const job=society.postJob("pioneer","farmer",1,60).job;
 assert.equal(society.applyPlayer("pioneer",job.id).ok,true);
 assert.equal(society.applyPlayer("pioneer",job.id).ok,false);
 assert.equal(society.advanceUntil(8,{activeTownId:"port"}),7);
 assert.equal(society.playerWagesOwed,0);
 society.advanceUntil(11,{activeTownId:"pioneer"});
 assert.equal(society.playerWagesOwed,180);
 assert.equal(society.advanceUntil(11,{activeTownId:"pioneer"}),0);
 const restored=new SocietySystem(society.snapshot(),11);
 assert.equal(restored.playerWagesOwed,180);
 assert.deepEqual(restored.playerJob,{townId:"pioneer",jobId:job.id});
 const wallet={coins:999950};
 assert.equal(restored.collectWages(wallet).paid,49);
 assert.equal(wallet.coins,999999);
 assert.equal(restored.playerWagesOwed,131);
 wallet.coins=0;
 assert.equal(restored.collectWages(wallet).paid,131);
 assert.equal(restored.playerWagesOwed,0);
 assert.equal(restored.resignPlayer().ok,true);
 assert.equal(restored.playerJob,null);
 assert.ok(t);
});
test("restoring old saves and malformed society fields is bounded and backwards compatible",()=>{
 const fresh=new SocietySystem(null,9);
 assert.equal(fresh.snapshot().schemaVersion,1);
 const invalid={schemaVersion:1,lastDay:-1,playerWagesOwed:1e99,
  towns:{capital:{people:[{id:"resident-0",age:-20}],jobs:[{id:"oops"}],housingCapacity:-20}}};
 const restored=new SocietySystem(invalid,9);
 assert.ok(restored.town("capital").people.length>10);
 assert.ok(restored.town("capital").jobs.length>0);
 assert.ok(restored.town("capital").housingCapacity>0);
 assert.equal(restored.playerWagesOwed,0);
 const target=1000000;
 assert.ok(restored.advanceUntil(target)<=180);
 assert.equal(restored.lastDay,target);
});
test("society panel has wired save-slot snapshot, daily advances and accessible controls",()=>{
 assert.equal(typeof installSocietyUI,"function");
 assert.ok(SOCIETY_OCCUPATIONS.medic&&SOCIETY_OCCUPATIONS.teacher);
 const root=new URL("../planet-explorer/",import.meta.url);
 const app=readFileSync(new URL("app.mjs",root),"utf8");
 const html=readFileSync(new URL("index.html",root),"utf8");
 for(const id of ["viewport-society","society-panel","society-town","society-jobs","society-post",
  "society-student","society-patient","society-status","society-pay","society-resign"]){
  // Student and patient selectors are created dynamically in society-ui.mjs.
  if(["society-student","society-patient"].includes(id)){
   assert.ok(readFileSync(new URL("society-ui.mjs",root),"utf8").includes(id),id);continue;
  }
  assert.ok(html.includes('id="'+id+'"'),id);
 }
 assert.match(app,/society=new SocietySystem/);
 assert.match(app,/v0_9l:\{schemaVersion:1,society:society\.snapshot\(\)\}/);
 assert.match(app,/society\?\.advanceUntil/);
 assert.match(app,/saveSocietyJournal/);
});
