import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {gunzipSync} from "node:zlib";
import {ShipInterior,SHIP_CREW} from "../planet-explorer/ship-interior.mjs";
import {CREW_GESTURES} from "../planet-explorer/ship-crew-greetings.mjs";
import {AVATAR_V10_MODELS,normalizeAvatarRoster} from "../planet-explorer/avatar-v10.mjs";
import {deformAvatarV10Face} from "../planet-explorer/avatar-v10-face.mjs";
import {parseFrontierRig,poseFrontierRig} from "../planet-explorer/frontier-animated.mjs";

const deck=()=>new ShipInterior({x:-1.32,z:-9.85,yaw:-Math.PI/4});
const load=model=>parseFrontierRig(gunzipSync(readFileSync(new URL(
 "../original-assets/avatar-v10/"+model+".glb.gz",import.meta.url))));
function passTime(interior,seconds){
 for(let t=0;t<seconds;t+=.05)interior.greetings.advance(interior,.05);
}

test("automatic attention and salute rearm only after leaving the crew's vicinity",()=>{
 const interior=deck(),greetings=interior.greetings;
 greetings.advance(interior,.1,()=>false);
 assert.equal(greetings.formal,null);
 passTime(interior,.2);
 assert.equal(greetings.formal.member.id,"navigator");
 assert.equal(greetings.actors(interior)[1].motion,"salute");
 passTime(interior,8);
 assert.equal(greetings.formal,null);
 interior.x=0;interior.z=-6.5;
 passTime(interior,.25);
 interior.x=-1.32;interior.z=-9.85;
 passTime(interior,.15);
 assert.equal(greetings.formal.member.id,"navigator");
});

test("player and crew share a gesture clock, make contact and resume normal controls",()=>{
 for(const [id,move] of Object.entries(CREW_GESTURES)){
  const interior=deck();
  const greetings=interior.greetings;
  assert.equal(greetings.start(interior,"engineer",id).ok,false);
  assert.equal(greetings.start(interior,"navigator",id).ok,true);
  assert.equal(greetings.start(interior,"navigator",id).ok,false);
  assert.equal(interior.walk(1,0,.08),false);
  passTime(interior,1.0);
  const [player,mate]=greetings.actors(interior);
  assert.equal(player.motion,id);
  assert.equal(mate.motion,id);
  assert.equal(player.time,mate.time);
  if(move.gap)assert.ok(Math.abs(Math.hypot(player.x-mate.x,player.z-mate.z)-move.gap)<.001);
  if(id==="handshake")assert.equal(player.grip,mate.grip);
  passTime(interior,move.seconds);
  assert.equal(greetings.pair,null);
  assert.equal(interior.walk(-1,0,.08),true);
  assert.equal(ShipInterior.fromSnapshot(interior.snapshot()).greetings.pair,null);
 }
});

test("the bulkhead blocks greetings across the wall",()=>{
 const interior=new ShipInterior({x:-3,z:5});
 assert.equal(interior.nearCrew().length,0);
 assert.equal(interior.greetings.start(interior,"companion","thumbsUp").ok,false);
 assert.equal(interior.talk("companion").ok,false);
});
test("assets preserve the full roster, facial topology, authored outfits and idle/walk clips",()=>{
 const roster=normalizeAvatarRoster({player:{model:"ren",face:{eyeSize:145}},navigator:{model:"classic"}});
 assert.equal(roster.player.face.eyeSize,100);
 assert.equal(roster.navigator.model,"lyra");
 assert.ok(SHIP_CREW.every(crew=>Object.hasOwn(AVATAR_V10_MODELS,roster[crew.id].model)));
 for(const model of Object.keys(AVATAR_V10_MODELS)){
  const rig=load(model);
  assert.equal(rig.isV10,true);
  assert.ok(rig.clips.some(c=>c.name==="Walk")&&rig.clips.some(c=>c.name==="Idle"));
  assert.ok(rig.primitives.some(p=>p.wardrobe?.includes("space")));
  const face=rig.primitives.find(primitive=>primitive.name==="Eyes, brows and lips");
  assert.deepEqual(face.names,["Blink","Smile"]);
  const shapes=deformAvatarV10Face(face,roster.player.face,rig.faceLandmarks);
  assert.ok(shapes.positions.some((value,i)=>Math.abs(value-face.arrays.positions[i])>.001));
  assert.ok(shapes.normals.every(Number.isFinite));
  assert.equal(face.arrays.morph0.length,shapes.morph0.length);
 }
});

function gripPosition(actor,rig){
 const toLocal=poseFrontierRig(rig,"idle",actor.time,"faceIdle",actor.time,{gesture:actor});
 const grip=toLocal.world[rig.jointsByName.get("Review_grip_R")].slice(12,15).map((v,i)=>(v-rig.center[i])*rig.scale);
 const c=Math.cos(actor.yaw),s=Math.sin(actor.yaw);
 return [actor.x+c*grip[0]+s*grip[2],grip[1],actor.z-s*grip[0]+c*grip[2]];
}
test("the two authored rigs meet at the same handshake point in ship coordinates",()=>{
 const interior=deck(),greetings=interior.greetings;
 assert.equal(greetings.start(interior,"navigator","handshake").ok,true);
 passTime(interior,1.1);
 const [player,mate]=greetings.actors(interior);
 const hands=[gripPosition(player,load("ren")),gripPosition(mate,load("lyra"))];
 assert.ok(hands.every(hand=>Math.hypot(...hand.map((v,i)=>v-player.grip[i]))<.06),
  JSON.stringify({hands,expected:player.grip}));
});
