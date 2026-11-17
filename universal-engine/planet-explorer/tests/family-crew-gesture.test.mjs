import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {gunzipSync} from "node:zlib";
import {ShipCrewGreetings,CREW_GESTURES} from "../ship-crew-greetings.mjs";
import {parseFrontierRig,poseFrontierRig} from "../frontier-animated.mjs";

function interior(){
 const crew=[{id:"navigator",name:"副官",x:.65,z:0,yaw:0,moving:false,seated:false}];
 const greetings=new ShipCrewGreetings(crew);
 return {x:0,z:0,yaw:0,seated:false,mode:"interior",crew,greetings,
  canReachCrew:()=>true,canOccupy:()=>true,
  distance:member=>Math.hypot(member.x,member.z),
  routine:{pair:[],phase:"idle"}};
}
test("consented ship adult gestures share paired crew motion, without private animation",()=>{
 assert.equal(CREW_GESTURES.handhold.seconds>0,true);
 assert.equal(CREW_GESTURES.kiss.seconds>0,true);
 assert.equal(Object.hasOwn(CREW_GESTURES,"private"),false);
 for(const kind of ["handhold","hug","kiss"]){
  const ship=interior();
  const result=ship.greetings.start(ship,"navigator",kind);
  assert.equal(result.ok,true,kind);
  const avatars=ship.greetings.actors(ship);
  assert.equal(avatars[0].motion,kind);
  assert.equal(avatars[1].motion,kind);
  assert.equal(avatars[0].time,0);
  if(kind==="handhold"){
   assert(avatars[0].grip);
   assert.deepEqual(avatars[0].grip,avatars[1].grip);
  }
 }
});
test("actual V10 rig animates non-explicit handhold/kiss without changing GLB data",()=>{
 const raw=gunzipSync(readFileSync(new URL("../../original-assets/avatar-v10/lyra.glb.gz",import.meta.url)));
 const rig=parseFrontierRig(raw);
 for(const kind of ["handhold","kiss"]){
  const gesture={motion:kind,time:1.0,x:0,z:0,yaw:0,grip:[0,.91,.20]};
  const pose=poseFrontierRig(rig,"idle",1.0,"faceIdle",1.0,{gesture});
  assert.equal(pose.world.length,rig.nodes.length);
  for(const m of pose.world)assert([...m].every(Number.isFinite));
 }
});
