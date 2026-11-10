import test from "node:test";
import assert from "node:assert/strict";
import {advanceRouteMotion,routeIntercept,remainingRouteFraction} from "../planet-explorer/ship-route-motion.mjs";
import {ShipJourney} from "../planet-explorer/ship-journey.mjs";
const eq=(a,b,t=1e-9)=>assert.ok(Math.abs(a-b)<=t,`got ${a}, wanted ${b}`);
test("zero throttle in vacuum preserves velocity without drag",()=>{
 const start={position:{along:.3,cross:.02},velocity:{along:.022,cross:.01},
  throttle:0,autopilot:false,fuelAvailable:true};
 const next=advanceRouteMotion(start,1/60);
 eq(next.velocity.along,.022);eq(next.velocity.cross,.01);
 assert.ok(next.position.along>.3&&next.position.cross>.02);
});
test("turning the nose while coasting does not rotate velocity",()=>{
 const base={position:{along:.4,cross:0},velocity:{along:.034,cross:.009},
  throttle:0,autopilot:false,fuelAvailable:true};
 const north=advanceRouteMotion({...base,yawDeg:0},.1);
 const other=advanceRouteMotion({...base,yawDeg:142},.1);
 assert.deepEqual(other.velocity,north.velocity);
 assert.deepEqual(other.position,north.position);
});
test("positive thrust accelerates, reverse jets brake and can reverse route direction",()=>{
 let input={position:{along:.2,cross:0},velocity:{along:.025,cross:0},
  throttle:-1,yawDeg:0,autopilot:false,fuelAvailable:true};
 let speed=input.velocity.along;
 for(let i=0;i<40;i++){
  const r=advanceRouteMotion(input,.1);
  input={...input,position:r.position,velocity:r.velocity};
  assert.ok(r.velocity.along<=speed+1e-9);speed=r.velocity.along;
 }
 assert.ok(input.velocity.along<.025);
 for(let i=0;i<55;i++){
  const r=advanceRouteMotion(input,.1);
  input={...input,position:r.position,velocity:r.velocity};
 }
 assert.ok(input.velocity.along<0);
});
test("manual high-speed planet flyby requires deceleration, never forced orbit",()=>{
 const ship=new ShipJourney({originId:"terra",destinationId:"cinder",status:"approach",
  seated:true,autopilot:false,throttle:0,progress:.998,routeAlong:.998,
  routeVelocity:{along:.045,cross:0}});
 for(let i=0;i<12;i++)ship.tick(.1);
 assert.equal(ship.status,"flyby");
 assert.ok(ship.routeAlong>1.03);
 assert.notEqual(ship.status,"orbit");
 const saved=ShipJourney.fromSnapshot(ship.snapshot());
 eq(saved.routeAlong,ship.routeAlong);eq(saved.routeVelocity.along,ship.routeVelocity.along);
});
test("manual approach allows direct surface entry without forced orbit",()=>{
 const ship=new ShipJourney({originId:"terra",destinationId:"cinder",status:"approach",
  seated:true,autopilot:false,throttle:0,routeAlong:.995,routeVelocity:{along:.002,cross:0}});
 ship.tick(.08);
 assert.equal(ship.status,"approach");
 assert.equal(ship.canDirectEntry,true);
});
test("manual sideways acceleration creates real cross-track error",()=>{
 const r=advanceRouteMotion({position:{along:.5,cross:0},
  velocity:{along:0,cross:0},autopilot:false,yawDeg:90,throttle:1,
  fuelAvailable:true},.1);
 assert.ok(r.velocity.cross>0);
 assert.ok(r.velocity.along<1e-8);
});
test("old voyage saves migrate safely to route velocity",()=>{
 const v=new ShipJourney({originId:"terra",status:"cruise",progress:.35,
  seated:true,autopilot:false});
 const legacy=v.snapshot();delete legacy.routeAlong;delete legacy.crossTrack;
 delete legacy.routeVelocity;
 const old=ShipJourney.fromSnapshot(legacy);
 assert.ok(old);eq(old.routeAlong,.35);eq(old.crossTrack,0);
 assert.ok(old.routeVelocity.along>0);
});
test("autopilot uses finite thrust and closes the intercept over time",()=>{
 let state={position:{along:.6,cross:.04},velocity:{along:.022,cross:0},
  throttle:0,autopilot:true,fuelAvailable:true};
 const before=remainingRouteFraction(state.position);
 for(let i=0;i<500;i++){
  const r=advanceRouteMotion(state,.08);
  state={...state,position:r.position,velocity:r.velocity};
 }
 assert.ok(remainingRouteFraction(state.position)<before);
 assert.ok(Math.hypot(...Object.values(state.velocity))<.08);
 assert.equal(routeIntercept({along:1,cross:0},{along:.003,cross:0}),true);
 assert.equal(routeIntercept({along:1.1,cross:0},{along:.003,cross:0}),false);
});

test("manual translation moves on X and Y while the lever independently moves on Z",()=>{
 const ship=new ShipJourney({originId:"terra",destinationId:"cinder",status:"cruise",
  seated:true,autopilot:false,throttle:0,routeAlong:.2,routeVelocity:{along:0,cross:0}});
 ship.tick(.1,{strafe:1,lift:1});
 assert.ok(ship.crossTrack>0&&ship.routeVertical>0);
 eq(ship.routeAlong,.2);
 eq(ship.attitudeYawDeg,0);
 eq(ship.pitchDeg,0);
 const position=ship.planetOffset;
 const restored=ShipJourney.fromSnapshot(ship.snapshot());
 assert.deepEqual(restored.planetOffset,position);
 restored.tick(.1);
 assert.ok(restored.crossTrack>ship.crossTrack&&restored.routeVertical>ship.routeVertical);
 restored.setThrottle(-1);
 restored.tick(.1);
 assert.ok(restored.routeAlong<ship.routeAlong);
});

test("sideways thrust uses ship heading and the speed cap includes all axes",()=>{
 const ship=new ShipJourney({originId:"terra",destinationId:"cinder",status:"cruise",
  seated:true,autopilot:false,attitudeYawDeg:90,throttle:0,routeAlong:.2,
  routeVelocity:{along:0,cross:0}});
 ship.tick(.1,{strafe:1});
 eq(ship.crossTrack,0);
 assert.ok(ship.routeAlong<.2);
 ship.setThrottle(1);
 for(let i=0;i<200;i++)ship.tick(.1,{strafe:1,lift:1});
 assert.ok(Math.hypot(ship.routeVelocity.along,ship.routeVelocity.cross,ship.verticalVelocity)<=.080000001);
});
