import test from "node:test";
import assert from "node:assert/strict";
import {
 DASHBOARD_ACTIONS,DEFAULT_DASHBOARD_SLOTS,
 normalizeDashboardSlots,normalizeShipViewSettings,shipCameraStickDelta
} from "../planet-explorer/ship-dashboard-layout.mjs";
import {ShipJourney} from "../planet-explorer/ship-journey.mjs";
import {shipCameraPose} from "../planet-explorer/ship-view-controls.mjs";

test("cockpit dashboard accepts only known actions in four physical slots",()=>{
 assert.deepEqual(normalizeDashboardSlots(["hatch","fire","none","auto"]),["hatch","fire","none","auto"]);
 assert.deepEqual(normalizeDashboardSlots(["danger","scan",null,{}]),["scan","scan","fire","hatch"]);
 assert.deepEqual(normalizeDashboardSlots(null),[...DEFAULT_DASHBOARD_SLOTS]);
 assert.ok(DASHBOARD_ACTIONS.some(x=>x.id==="hatch"));
});
test("camera settings default to panoramic 108 degrees and clamp malformed preferences",()=>{
 assert.deepEqual(normalizeShipViewSettings(null),{wide:true,fov:108,rightStick:true});
 assert.deepEqual(normalizeShipViewSettings({wide:false,fov:1000,rightStick:false}),{wide:false,fov:116,rightStick:false});
 assert.deepEqual(normalizeShipViewSettings({fov:NaN}),{wide:true,fov:108,rightStick:true});
});
test("right stick look moves view but returns to rest on neutral input",()=>{
 const right=shipCameraStickDelta({x:.8,y:0},.08);
 const up=shipCameraStickDelta({x:0,y:-.7},.08);
 assert.ok(right.yaw>0);assert.equal(right.pitch,0);
 assert.ok(up.pitch>0);assert.equal(up.yaw,0);
 assert.deepEqual(shipCameraStickDelta({x:0,y:0},.08),{yaw:0,pitch:0});
 assert.deepEqual(shipCameraStickDelta({x:1,y:1},NaN),{yaw:0,pitch:0});
});
test("panoramic cabin FOV can be adjusted independently of orbit chase",()=>{
 const p=shipCameraPose({mode:"cockpit",wide:true,fovDeg:110,interior:{seated:true,z:-9.8}});
 assert.equal(p.fovDeg,110);assert.equal(p.drawExterior,false);
 assert.equal(shipCameraPose({mode:"cockpit",wide:true,fovDeg:999}).fovDeg,116);
 assert.equal(shipCameraPose({mode:"cockpit",wide:false}).fovDeg,85);
 const orbit=shipCameraPose({mode:"chase",wide:true});
 assert.equal(orbit.drawExterior,true);
});
test("seated pilot can open and close remote hatch only when grounded",()=>{
 const ship=new ShipJourney({originId:"terra",status:"docked",hatchOpen:false,
  interior:{schemaVersion:1,x:0,z:-9.8,yaw:0,mode:"cockpit"},seated:true});
 assert.equal(ship.toggleHatch().ok,false); // aft local switch still requires walking
 assert.equal(ship.toggleCockpitHatch().ok,true);
 assert.equal(ship.hatchOpen,true);
 assert.equal(ship.launch().ok,false); // no liftoff with open airlock
 assert.equal(ship.toggleCockpitHatch().ok,true);
 assert.equal(ship.hatchOpen,false);
 ship.status="cruise";
 assert.equal(ship.toggleCockpitHatch().ok,false);
 assert.equal(ship.hatchOpen,false);
 ship.status="landed";
 assert.equal(ship.toggleCockpitHatch().ok,true);
 ship.stand();
 assert.equal(ship.toggleCockpitHatch().ok,false);
});
