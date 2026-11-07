import test from "node:test";
import assert from "node:assert/strict";
import {
 COCKPIT_SWITCHES,EXTERIOR_HATCH_SWITCH,
 xrRayPointDistance,xrCockpitControlHit,exteriorHatchWorldPoint
} from "../planet-explorer/ship-control-hit.mjs";

const identity=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
const ray=(x,y,z)=>[1,0,0,0,0,1,0,0,0,0,1,0,x,y,z,1];

test("all three cockpit switches are in reach of the pilot, not 10m aft",()=>{
 assert.deepEqual(COCKPIT_SWITCHES.map(c=>c.id),["scan","weapon","fire"]);
 for(const switchCap of COCKPIT_SWITCHES)
  assert.ok(switchCap.position[2]<-10.8&&switchCap.position[2]>-11.6);
});
test("Quest right controller can target the physical weapon switch",()=>{
 assert.equal(xrCockpitControlHit(ray(0,1.47,-9.8),identity)?.id,"weapon");
});
test("Quest can pick distinct scan and fire caps",()=>{
 assert.equal(xrCockpitControlHit(ray(-.75,1.47,-9.8),identity)?.id,"scan");
 assert.equal(xrCockpitControlHit(ray(.75,1.47,-9.8),identity)?.id,"fire");
});
test("XR ray picking uses the same stage transform as rendered geometry",()=>{
 const shifted=[...identity];shifted[12]=4;shifted[14]=2;
 assert.equal(xrCockpitControlHit(ray(4,1.47,-7.8),shifted)?.id,"weapon");
});
test("out-of-range and backward Quest rays cannot activate switches",()=>{
 assert.equal(xrCockpitControlHit(ray(0,1.47,1),identity),null);
 assert.equal(xrCockpitControlHit(ray(3,1.47,-9.8),identity),null);
});
test("invalid tracking matrices are ignored rather than firing",()=>{
 assert.equal(xrCockpitControlHit([],identity),null);
 assert.equal(xrRayPointDistance(ray(0,1.47,-9.8),null,[0,0,0]),null);
});
test("ground airlock control rotates with the landed ship",()=>{
 assert.deepEqual(exteriorHatchWorldPoint(10,20,0,2,0,0),
  [10+EXTERIOR_HATCH_SWITCH[0],2+EXTERIOR_HATCH_SWITCH[1],20+EXTERIOR_HATCH_SWITCH[2]]);
 const rotated=exteriorHatchWorldPoint(10,20,Math.PI/2,2,0,0);
 assert.ok(Math.abs(rotated[0]-(10+EXTERIOR_HATCH_SWITCH[2]))<1e-9);
 assert.ok(Math.abs(rotated[2]-(20-EXTERIOR_HATCH_SWITCH[0]))<1e-9);
});
test("Quest controller ray can hit exterior hatch plate when player is alongside the ramp",()=>{
 const target=exteriorHatchWorldPoint(0,0,0,0,0,0);
 assert.ok(xrRayPointDistance(ray(target[0],target[1],target[2]+1),identity,target));
 assert.equal(xrRayPointDistance(ray(target[0]+1,target[1],target[2]+1),identity,target),null);
});
