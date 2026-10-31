import {test} from "node:test";
import assert from "node:assert/strict";
import {ShipJourney} from "../planet-explorer/ship-journey.mjs";
import {AU_M} from "../planet-explorer/solar-system.mjs";
import {bodyCenterM,surfaceShipFrame} from "../planet-explorer/unified-space-frame.mjs";
import {gravityMu,HELIOS_MU,parkingOrbitVelocity,bodyVelocityMps,
 gravitationalAcceleration,atmosphericAcceleration,nearestFlightBody,createFreeFlight,
 restoreFreeFlight,safeTimeWarp,stepFreeFlight,freeFlightFrame} from "../planet-explorer/ship-orbital-physics.mjs";

const day=.24,near=(a,b,t=1e-3)=>assert.ok(Math.abs(a-b)<=t,`${a} ~= ${b}`);
const sub=(a,b)=>a.map((n,i)=>n-b[i]),len=v=>Math.hypot(...v);
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const orbit=()=>surfaceShipFrame("terra",day,25,40,120000,0);
const journey=()=>new ShipJourney({originId:"terra",status:"origin-orbit",launchDay:day,
 launchSite:{bodyId:"terra",lat:25,lon:40,padElevationM:113,yaw:0},
 seated:true,hatchOpen:false,throttle:1,fuel:100});

test("orbital GM uses body gravity and star Kepler acceleration",()=>{
 const b=6371000;
 near(gravityMu("terra"),9.81*b*b,1e5);
 const at1au=gravitationalAcceleration([AU_M,0,0],0);
 near(HELIOS_MU/(AU_M*AU_M),.00593,.0001);
 assert.ok(at1au[0]<-.0059&&at1au[0]>-.0061);
});
test("physical orbital injection is prograde, tangent and has correct escape-scale speed",()=>{
 const frame=orbit(),vel=parkingOrbitVelocity(frame,day),center=bodyCenterM("terra",day);
 const local=sub(vel,bodyVelocityMps("terra",day));
 const radial=sub(frame.position,center),nose=frame.back.map(x=>-x);
 near(dot(local,radial)/len(radial),0,.001);
 near(len(local),Math.sqrt(gravityMu("terra")/len(radial)),.02);
 assert.ok(dot(local,nose)>0);
});
test("throttle changes world velocity and position, not merely maneuver HUD coordinates",()=>{
 const frame=orbit(),s=createFreeFlight(frame,day);
 const idle=stepFreeFlight(s,.08,day,{throttle:0,fuel:100});
 const firing=stepFreeFlight(s,.08,day,{direction:frame.back.map(x=>-x),throttle:1,fuel:100});
 assert.ok(len(sub(firing.state.velocity,idle.state.velocity))>.3);
 assert.ok(len(sub(firing.state.position,idle.state.position))>.01);
 assert.ok(firing.deltaV>.35);
 near(firing.days,.08/86400,1e-9);
});
test("atmospheric drag opposes atmosphere-relative motion, vanishes at orbital altitude",()=>{
 const frame=surfaceShipFrame("terra",day,0,0,200,0);
 const record=nearestFlightBody(frame.position,day);
 const v=bodyVelocityMps("terra",day);
 const moving=v.map((x,i)=>x+frame.right[i]*150);
 const drag=atmosphericAcceleration(frame.position,moving,day,record);
 assert.ok(len(drag)>0);
 const rotation=[2*Math.PI/(24*3600)*(frame.position[2]-record.center[2]),0,
  -2*Math.PI/(24*3600)*(frame.position[0]-record.center[0])];
 const relative=sub(moving,v.map((x,i)=>x+rotation[i]));
 assert.ok(dot(drag,relative)<0);
 const distant=surfaceShipFrame("terra",day,0,0,300000,0);
 near(len(atmosphericAcceleration(distant.position,moving,day,
  nearestFlightBody(distant.position,day))),0,1e-10);
});
test("time warp is limited around planets and physical clock advances exactly by simulated seconds",()=>{
 const v=journey();
 assert.ok(v.beginFreeFlight(day).ok);
 assert.equal(safeTimeWarp(1000,nearestFlightBody(v.freeFlight.position,day)),10);
 assert.ok(v.setFreeFlightWarp(1000).ok);
 const p0=[...v.freeFlight.position],a=v.tick(.05,day);
 assert.ok(a.physical);
 near(a.days, .5/86400,1e-8);
 assert.ok(len(sub(v.freeFlight.position,p0))>100);
 assert.ok(v.freeFlight.elapsedSimSeconds>.49);
});
test("free-flight orientation and physical location survive v2 save/reload",()=>{
 const v=journey();assert.ok(v.beginFreeFlight(day).ok);
 v.steer(110);v.pitch(20);v.roll(-15);
 for(let i=0;i<20;i++)v.tick(.03,day+i*.03/86400);
 const f=v.framePose(day+.6/86400),copy=ShipJourney.fromSnapshot(v.snapshot());
 assert.ok(copy?.freeFlight);
 assert.equal(copy.freeFlight.yawTargetDeg,110);
 const f2=copy.framePose(day+.6/86400);
 near(len(sub(f.position,f2.position)),0,1e-8);
 near(len(sub(f.right,f2.right)),0,1e-8);
 assert.ok(len(sub(f.position,orbit().position))>1);
});
test("return-to-route preserves flight state while matching real position and velocity",()=>{
 const v=journey();assert.ok(v.beginFreeFlight(day).ok);
 const before=[...v.freeFlight.position];
 const result=v.requestGuidedReturn(day);
 assert.ok(result.ok);assert.ok(v.freeFlight.returnToRoute);
 assert.equal(v.autopilot,true);
 assert.ok(len(sub(v.freeFlight.position,before))===0,"not an immediate teleport");
 const a=v.tick(.04,day);
 assert.ok(a.days>0);
 assert.ok(v.freeFlight?.returnToRoute,"orbit velocity differs, so correction must continue");
});
test("collision clamps to surface and stops ship, never passes through planet",()=>{
 const frame=surfaceShipFrame("terra",day,0,0,1,0);
 const free=createFreeFlight(orbit(),day);
 free.position=[...frame.position];
 free.velocity=bodyVelocityMps("terra",day).map((n,i)=>n-frame.up[i]*350);
 const stepped=stepFreeFlight(free,.08,day,{throttle:0,fuel:0});
 assert.equal(stepped.state.incident,"impact");
 assert.equal(len(stepped.state.velocity),0);
 const after=nearestFlightBody(stepped.state.position,day+stepped.days);
 assert.ok(after.altitudeM>=-.01);
 assert.ok(after.altitudeM<=.01);
});
test("invalid free state fails closed, and guided ascent cannot enter free physics",()=>{
 const v=new ShipJourney({originId:"terra",status:"ascent",seated:true,
  launchSite:{bodyId:"terra",lat:0,lon:0,yaw:0,padElevationM:0}});
 assert.equal(v.beginFreeFlight(day).ok,false);
 assert.equal(restoreFreeFlight({version:1,position:[NaN,0,0]}),null);
 assert.throws(()=>createFreeFlight(orbit(),day,{warp:2}),RangeError);
 assert.throws(()=>stepFreeFlight(null,.05,day),RangeError);
});
