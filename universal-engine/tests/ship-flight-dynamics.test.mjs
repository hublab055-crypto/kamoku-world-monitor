import {test} from "node:test";
import assert from "node:assert/strict";
import {ShipJourney} from "../planet-explorer/ship-journey.mjs";
import {emptyShipDynamics,restoreShipDynamics,advanceShipDynamics,applyShipDynamics,
 shipDynamicsWeight} from "../planet-explorer/ship-flight-dynamics.mjs";
import {inertialToShipLocal} from "../planet-explorer/unified-space-frame.mjs";
import {planetRenderPose} from "../planet-explorer/ship-planet-view.mjs";
const near=(x,y,epsilon=1e-3)=>assert.ok(Math.abs(x-y)<epsilon,`${x} ~= ${y}`);
const start=()=>new ShipJourney({
 originId:"terra",status:"origin-orbit",launchDay:.24,
 launchSite:{bodyId:"terra",lat:25,lon:132,yaw:.2,padElevationM:123},
 hatchOpen:false,seated:true,throttle:1,fuel:100
});
test("manual yaw changes the planet direction in cockpit coordinates",()=>{
 const v=start(),days=.24,baseline=planetRenderPose(v.framePose(days),"terra",days);
 v.setAutopilot(false);v.steer(30);
 for(let i=0;i<150;i++)v.tick(.02);
 const rotated=planetRenderPose(v.framePose(days),"terra",days);
 near(v.flightDynamics.yaw,30*Math.PI/180,.08);
 assert.ok(Math.abs(rotated.position[0]-baseline.position[0])>50,
  "planet must move in viewport when steering instead of only changing HUD");
});
test("pitch and roll respond independently, accelerate and save with existing schema",()=>{
 const v=start();
 v.setAutopilot(false);v.pitch(25);v.roll(32);
 for(let i=0;i<120;i++)v.tick(.02);
 assert.ok(v.flightDynamics.pitch>.25);
 assert.ok(v.flightDynamics.roll>.35);
 assert.ok(v.maneuverSpeedMps>1);
 const frame=v.framePose(.24);
 near(Math.hypot(...frame.right),1,1e-6);
 near(Math.hypot(...frame.up),1,1e-6);
 near(Math.hypot(...frame.back),1,1e-6);
 const q=ShipJourney.fromSnapshot(v.snapshot());
 assert.ok(q);
 near(q.flightDynamics.pitch,v.flightDynamics.pitch);
 near(q.flightDynamics.backM,v.flightDynamics.backM);
 assert.equal(q.launchSite.padElevationM,123);
 near(q.framePose(.24).maneuverSpeedMps,v.maneuverSpeedMps);
});
test("autopilot recentres ship with angular inertia",()=>{
 const v=start();v.setAutopilot(false);v.steer(-45);
 for(let i=0;i<100;i++)v.tick(.02);
 const yaw=v.flightDynamics.yaw;
 assert.ok(yaw<-.35);
 v.setAutopilot(true);
 v.tick(.015);
 assert.ok(Math.abs(v.flightDynamics.yaw)>0,"ship must not snap level in one frame");
 for(let i=0;i<500;i++)v.tick(.02);
 assert.ok(Math.abs(v.flightDynamics.yaw)<.03,"autopilot should smoothly level");
});
test("entry maneuver offset vanishes at touchdown while guided landing remains exact",()=>{
 const v=start();
 v.setLandingSite({bodyId:"terra",lat:0,lon:0,yaw:0,padElevationM:10}); // not allowed in origin-orbit
 v.destinationId="cinder";
 v.status="entry";
 v.landingSite={bodyId:"cinder",lat:8,lon:100,yaw:.7,padElevationM:321};
 v.flightDynamics=restoreShipDynamics({rightM:1200,backM:900,upM:130});
 v.stageProgress=.45;
 const frame=v.framePose(.24);
 assert.ok(frame.maneuverOffsetM[0]>0);
 assert.ok(shipDynamicsWeight(v)>0);
 v.stageProgress=1;
 const pad=v.framePose(.24);
 v.status="touchdown";
 const touched=v.framePose(.24);
 for(let i=0;i<3;i++)near(pad.position[i],touched.position[i],1e-5);
 near(shipDynamicsWeight(v),0);
});
test("invalid/broken dynamic saves never introduce NaNs or unbounded velocity",()=>{
 const d=restoreShipDynamics({yaw:NaN,upM:1e30,rightMps:Infinity,roll:-1000});
 assert.ok(Object.values(d).every(Number.isFinite));
 assert.ok(d.upM<=50000);
 assert.equal(d.yaw,0);
 assert.ok(d.roll>=-Math.PI);
 assert.throws(()=>advanceShipDynamics(d,{dt:NaN}),RangeError);
 const zero=advanceShipDynamics(emptyShipDynamics(),{dt:1,status:"landed",throttle:1,fuel:100});
 assert.equal(zero.backM,0);
});
