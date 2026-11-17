import test from "node:test";
import assert from "node:assert/strict";
import {ShipInterior} from "../planet-explorer/ship-interior.mjs";
import {crewRoutineEligible,crewRoutineSafety} from "../planet-explorer/ship-crew-autonomy.mjs";
const cruise={status:"cruise",autopilot:true};
const step=(s,c=cruise)=>s.greetings.advance(s,.08,()=>false,c);

test("routine flight phases protect takeoff and touchdown",()=>{
 assert.equal(crewRoutineSafety("cruise"),"active");
 assert.equal(crewRoutineSafety("atmosphere"),"active");
 assert.equal(crewRoutineSafety("touchdown"),"secure");
 const s=new ShipInterior();
 assert.equal(crewRoutineEligible(s.crew[0],cruise),true);
 assert.equal(crewRoutineEligible(s.crew[0],{status:"atmosphere"}),false);
});
test("NPCs walk through bulkhead doors and actually meet for conversation",()=>{
 const s=new ShipInterior(),prev=s.crew.map(c=>[c.x,c.z]);
 let moved=false,talked=false,completed=false;
 for(let i=0;i<2500;i++){
  step(s);
  s.crew.forEach((c,j)=>{
   const distance=Math.hypot(c.x-prev[j][0],c.z-prev[j][1]);
   assert.ok(distance<=.16,"teleport detected");
   moved||=distance>.0001;prev[j]=[c.x,c.z];
  });
  talked||=Boolean(s.routine.speech);
  completed||=(s.routine.bonds["engineer:companion"]||0)>0;
  if(completed&&s.routine.phase==="idle")break;
 }
 assert.equal(moved,true);
 assert.equal(talked,true);
 assert.equal(completed,true);
 assert.equal(s.crew[0].seated,true);
 assert.equal(s.social.status("engineer").points,0);
});
test("dialogue alternates speakers and uses readable Japanese text",()=>{
 const s=new ShipInterior();let one,two;
 for(let i=0;i<1800;i++){
  step(s);const line=s.routine.speech;
  if(line?.line===1)one=line;
  if(line?.line===2){two=line;break;}
 }
 assert.ok(one&&two);
 assert.equal(one.speakerId,two.listenerId);
 assert.equal(one.listenerId,two.speakerId);
 assert.ok(one.text.length>4);
});
test("touchdown cancels NPC chats and returns crew to seats",()=>{
 const s=new ShipInterior();
 for(let i=0;i<300;i++)step(s);
 assert.equal(s.routine.phase,"gather");
 step(s,{status:"touchdown",autopilot:true});
 assert.equal(s.routine.phase,"return");
 for(let i=0;i<1200;i++)step(s,{status:"touchdown",autopilot:true});
 assert.equal(s.routine.phase,"idle");
 assert.equal(s.crew.every(c=>c.seated),true);
});
test("player following command overrides crew routine",()=>{
 const s=new ShipInterior();for(let i=0;i<120;i++)step(s);
 const member=s.crew.find(c=>c.id==="engineer");
 s.x=member.x+.72;s.z=member.z;
 assert.equal(s.setFollowing("engineer").ok,true);
 assert.equal(member.following,true);
 assert.equal(member.routineTarget,null);
});
test("save/restore retains roaming targets and clock deterministically",()=>{
 const s=new ShipInterior();for(let i=0;i<120;i++)step(s);
 const restored=ShipInterior.fromSnapshot(s.snapshot());
 assert.deepEqual(restored.snapshot(),s.snapshot());
 step(s);step(restored);
 assert.deepEqual(restored.snapshot(),s.snapshot());
});
