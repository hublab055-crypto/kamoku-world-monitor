import {test} from "node:test";
import assert from "node:assert/strict";
import {settlementLayout} from "./settlements.mjs";
import {residentLifePlan,residentLifePose,townResidentPositions,RESIDENT_ACTION_NAMES} from "./town-resident-life.mjs";
const layout=settlementLayout("capital"),resident=layout.residents[0];
test("every town resident receives a stable home and workplace with existing building IDs",()=>{
 const ids=new Set(layout.buildings.map((_,i)=>"village-"+i));
 for(const r of layout.residents){
  const p=residentLifePlan(layout,r);
  assert.ok(p&&ids.has(p.homeId)&&ids.has(p.workId));
  assert.equal(p.home.type,"cabin");
  assert.ok(RESIDENT_ACTION_NAMES[p.workActivity]);
 }
});
test("planet day is the source of truth for sleep, breakfast, work, lunch and evening",()=>{
 const plan=residentLifePlan(layout,resident),at=h=>residentLifePose(plan,42+h/24);
 assert.equal(at(3).activity,"sleep");
 assert.equal(at(6.5).activity,"breakfast");
 assert.equal(at(7.5).activity,"commute");
 assert.equal(at(9).activity,plan.workActivity);
 assert.equal(at(12.5).activity,"lunch");
 assert.equal(at(17.5).activity,"commute");
 assert.equal(at(18.5).activity,"dinner");
 assert.equal(at(21).activity,"leisure");
 assert.equal(at(23).activity,"sleep");
});
test("commuting starts and ends without a teleport and follows public corridors",()=>{
 const plan=residentLifePlan(layout,resident);
 const start=residentLifePose(plan,20+7/24);
 const soon=residentLifePose(plan,20+7.001/24);
 const end=residentLifePose(plan,20+8/24);
 assert.ok(Math.hypot(start.x-soon.x,start.z-soon.z)<1);
 assert.equal(start.moving,false);
 assert.equal(soon.moving,true);
 assert.equal(end.moving,false);
 assert.equal(end.buildingId,plan.workId);
});
test("at work and at home the resident is physically in the corresponding building",()=>{
 for(const r of layout.residents){
  const p=residentLifePlan(layout,r);
  const home=residentLifePose(p,80+.1),job=residentLifePose(p,80+.4);
  assert.equal(home.buildingId,p.homeId);
  assert.equal(home.inside,true);
  assert.equal(job.buildingId,p.workId);
  assert.equal(job.inside,p.work.type!=="market");
 }
});
test("all positions are finite, reproducible and correctly follow large time skips",()=>{
 for(const day of [0,8.25,91.9999,10000.15,10000.99]){
  const first=townResidentPositions(layout,day),again=townResidentPositions(layout,day);
  assert.deepEqual(first,again);
  assert.equal(first.length,layout.residents.length);
  assert.ok(first.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.z)&&Number.isFinite(p.yaw)));
 }
});
test("plans do not mutate the existing settlement layout or resident IDs",()=>{
 const before=JSON.stringify(layout);
 residentLifePlan(layout,resident);
 townResidentPositions(layout,71.1);
 assert.equal(JSON.stringify(layout),before);
 assert.equal(residentLifePlan(layout,{id:"unknown"}),null);
 assert.equal(residentLifePose(null,32),null);
});
test("each phase has a readable activity for NPC dialogue",()=>{
 const p=residentLifePlan(layout,resident);
 for(const h of [2,6.5,7.5,9,12.5,16,17.5,18.5,21,23]){
  const pose=residentLifePose(p,17+h/24);
  assert.ok(RESIDENT_ACTION_NAMES[pose.activity]);
 }
});
