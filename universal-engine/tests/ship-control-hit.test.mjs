import test from "node:test";
import assert from "node:assert/strict";
import {
 COCKPIT_SWITCHES,EXTERIOR_HATCH_SWITCH,
 xrRayPointDistance,xrCockpitControlHit,exteriorHatchWorldPoint
} from "../planet-explorer/ship-control-hit.mjs";

const identity=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
const ray=(x,y,z)=>[1,0,0,0,0,1,0,0,0,0,1,0,x,y,z,1];

test("all four cockpit switches including hatch are in reach of the pilot",()=>{
 assert.deepEqual(COCKPIT_SWITCHES.map(c=>c.id),["scan","weapon","fire","hatch"]);
 for(const switchCap of COCKPIT_SWITCHES)
  assert.ok(Math.hypot(switchCap.position[0],switchCap.position[1]-1.25,switchCap.position[2]+12.1)<1);
});
const controlRay=(id,dx=0,dz=0)=>{
 const p=COCKPIT_SWITCHES.find(c=>c.id===id).position;
 return ray(p[0]+dx,p[1],p[2]+.15+dz);
};
test("Quest controller targets the armrest weapon switch",()=>{
 assert.equal(xrCockpitControlHit(controlRay("weapon"),identity)?.id,"weapon");
});
test("Quest can pick each of the four armrest caps distinctly",()=>{
 for(const id of ["scan","weapon","fire","hatch"])assert.equal(xrCockpitControlHit(controlRay(id),identity)?.id,id);
 assert.equal(xrCockpitControlHit(ray(.65,1.3,-11.5),identity)?.id,"throttle");
});
test("XR ray picking uses the same stage transform as rendered geometry",()=>{
 const shifted=[...identity];shifted[12]=4;shifted[14]=2;
 assert.equal(xrCockpitControlHit(controlRay("weapon",4,2),shifted)?.id,"weapon");
});
test("out-of-range and backward Quest rays cannot activate switches",()=>{
 assert.equal(xrCockpitControlHit(ray(0,1.47,1),identity),null);
 assert.equal(xrCockpitControlHit(ray(3,1.47,-12.1),identity),null);
});
test("invalid tracking matrices are ignored rather than firing",()=>{
 assert.equal(xrCockpitControlHit([],identity),null);
 assert.equal(xrRayPointDistance(ray(0,1.47,-12.1),null,[0,0,0]),null);
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
