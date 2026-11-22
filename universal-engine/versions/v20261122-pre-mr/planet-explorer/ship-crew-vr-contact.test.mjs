import test from "node:test";
import assert from "node:assert/strict";
import {ShipInterior,SHIP_CREW} from "./ship-interior.mjs";
import {detectShipCrewTouch} from "./ship-crew-vr-contact.mjs";

const identity=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
const mat=(x,y,z)=>[1,0,0,0,0,1,0,0,0,0,1,0,x,y,z,1];
const crew=SHIP_CREW[0];
const setup=()=>new ShipInterior({x:crew.x,z:crew.z+1.1});
const point=(x,z,y=1.16,forward=.32,side=0)=>mat(x+side,y,z+forward);
test("same-hand right grip meets navigator's right hand for handshake",()=>{
 const interior=setup(),actor=interior.greetings.actors(interior).find(a=>a.id==="navigator");
 const x=actor.x+Math.cos(actor.yaw)*(-.15)+Math.sin(actor.yaw)*.32;
 const z=actor.z-Math.sin(actor.yaw)*(-.15)+Math.cos(actor.yaw)*.32;
 const v=detectShipCrewTouch({interior,stage:identity,handPoses:{right:mat(x,1.16,z)},gripsHeld:new Set(["right"])});
 assert.equal(v?.action,"handshake");
 assert.equal(v?.id,"navigator");
});
test("both shoulder grips trigger hug, one grip does not",()=>{
 const interior=setup(),actor=interior.greetings.actors(interior).find(a=>a.id==="navigator");
 const location=sign=>{
  const x=sign*.255,z=.025;
  return mat(actor.x+Math.cos(actor.yaw)*x+Math.sin(actor.yaw)*z,1.44,
   actor.z-Math.sin(actor.yaw)*x+Math.cos(actor.yaw)*z);
 };
 const handPoses={left:location(1),right:location(-1)};
 assert.equal(detectShipCrewTouch({interior,stage:identity,handPoses,gripsHeld:new Set(["left"]) }),null);
 assert.equal(detectShipCrewTouch({interior,stage:identity,handPoses,gripsHeld:new Set(["left","right"])}).action,"hug");
});
test("distant, seated or missing XR tracking cannot trigger greetings",()=>{
 const interior=setup(),actor=interior.greetings.actors(interior).find(a=>a.id==="navigator");
 const x=actor.x+Math.cos(actor.yaw)*(-.15)+Math.sin(actor.yaw)*.32;
 const z=actor.z-Math.sin(actor.yaw)*(-.15)+Math.cos(actor.yaw)*.32;
 const input={interior,stage:identity,handPoses:{right:mat(x,1.16,z)},gripsHeld:new Set(["right"])};
 assert.equal(detectShipCrewTouch({...input,handPoses:{}}),null);
 interior.seated=true;
 assert.equal(detectShipCrewTouch(input),null);
 interior.seated=false;interior.x=0;interior.z=0;
 assert.equal(detectShipCrewTouch(input),null);
});
