import test from "node:test";
import assert from "node:assert/strict";
import {
 XR_HOLO_Z,XR_HOLO_SLIDERS,xrHologramControlHit,
 xrHologramPlaneHit,xrHologramReadouts
} from "./ship-hologram-vr.mjs";

function identityAt(x=0,y=0,z=0){
 return [1,0,0,0,0,1,0,0,0,0,1,0,x,y,z,1];
}
function pointTo(x,y,z=XR_HOLO_Z+.67,stage=identityAt()){
 return xrHologramControlHit(identityAt(x,y,z),stage);
}
test("Quest ray selects starship hologram buttons but not empty space",()=>{
 assert.equal(pointTo(-1.84,1.93)?.id,"gear");
 assert.equal(pointTo(-1.27,1.93)?.id,"hatch");
 assert.equal(pointTo(-1.84,.88)?.id,"primary");
 assert.equal(pointTo(-1.27,.88)?.id,"autopilot");
 assert.equal(pointTo(1.18,1.88)?.id,"weapon");
 assert.equal(pointTo(1.55,1.88)?.id,"lock");
 assert.equal(pointTo(1.91,1.88)?.id,"autoFire");
 assert.equal(pointTo(1.55,1.47)?.id,"refuel");
 assert.equal(pointTo(1.91,1.47)?.id,"repair-shield");
 assert.equal(pointTo(1.18,1.06)?.id,"repair-engine");
 assert.equal(pointTo(1.55,1.06)?.id,"repair-hull");
 assert.equal(pointTo(1.91,1.06)?.id,"repair-weapons");
 assert.equal(pointTo(0,1.4),null);
 assert.equal(pointTo(5,1.88),null);
});
test("Quest main and VOL levers use hit height, clamping and detents",()=>{
 const main=XR_HOLO_SLIDERS[0],vol=XR_HOLO_SLIDERS[1];
 assert.deepEqual({id:pointTo(main.x,main.minY)?.id,value:pointTo(main.x,main.minY)?.value},{id:"main",value:-100});
 assert.equal(pointTo(main.x,main.maxY)?.value,125);
 assert.equal(pointTo(main.x,main.minY+(main.maxY-main.minY)*100/225)?.value,0);
 assert.equal(pointTo(vol.x,vol.minY)?.value,-100);
 assert.equal(pointTo(vol.x,vol.maxY)?.value,100);
 assert.equal(pointTo(vol.x,(vol.minY+vol.maxY)/2)?.value,0);
});
test("Quest intersection respects tracking-space translation and ray direction",()=>{
 const stage=identityAt(3,0,5);
 const hit=pointTo(1.55+3,1.88,XR_HOLO_Z+5+.55,stage);
 assert.equal(hit?.id,"lock");
 assert.equal(xrHologramControlHit(identityAt(1.55,1.88,XR_HOLO_Z-.3),identityAt()),null);
 assert.equal(xrHologramPlaneHit(identityAt(1.55,1.88,XR_HOLO_Z+10),identityAt()),null);
 assert.equal(xrHologramPlaneHit([],identityAt()),null);
 assert.equal(xrHologramPlaneHit(identityAt(),[NaN,...identityAt().slice(1)]),null);
});
test("Quest gauges present local atmosphere and normalized orbital units distinctly",()=>{
 const t=xrHologramReadouts({status:"atmosphere",airSpeed:96.4,fuel:73.6},{height:1234,gravity:9.81});
 assert.deepEqual(t.map(x=>x.text),["96","1230","9.8","74"]);
 const orbit=xrHologramReadouts({status:"cruise",routeVelocity:{along:.042,cross:0},fuel:50});
 assert.deepEqual(orbit.map(x=>x.text),["4.2","----","----","50"]);
 assert.equal(orbit[0].label,"RT%");
 const grounded=xrHologramReadouts({status:"landed",airAltitude:400,fuel:100},{height:400,gravity:6.12});
 assert.equal(grounded[1].text,"0");
});
