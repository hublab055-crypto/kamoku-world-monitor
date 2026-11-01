import test from "node:test";
import assert from "node:assert/strict";
import {defaultMobileConfig,normalizeMobileConfig} from "./mobile-controls.mjs";
import {shipStickAxes} from "./ship-mobile-ui.mjs";
import {ShipInterior} from "./ship-interior.mjs";

test("horse, boat, passenger, starship walking and cockpit have four programmable actions",()=>{
 const profiles=defaultMobileConfig().profiles;
 for(const mode of ["ride","boat","passenger","shipInterior","shipCockpit"]){
  assert.equal(profiles[mode].length,4);
  assert.ok(profiles[mode].every(slot=>slot.tap&&slot.hold));
 }
 assert.equal(profiles.shipInterior[0].tap,"interact");
 assert.equal(profiles.shipCockpit[0].tap,"launchLand");
 assert.equal(profiles.boat[1].tap,"anchor");
});
test("previous mobile saved settings survive the new vehicle profiles",()=>{
 const legacy={version:1,profiles:{walk:[{tap:"shoot",hold:"guard"}]},layers:{legacy:true}};
 const restored=normalizeMobileConfig(legacy);
 assert.equal(restored.profiles.walk[0].tap,"shoot");
 assert.equal(restored.profiles.ride.length,4);
 assert.equal(restored.profiles.shipInterior.length,4);
 assert.equal(restored.layers.legacy,true);
});
test("ship movement joystick maps up to forward and right to sideways in cabin",()=>{
 const axes=shipStickAxes({x:1,y:-1},.04);
 assert.equal(axes.forward,1);
 assert.equal(axes.strafe,1);
 const ship=new ShipInterior({x:0,z:0,yaw:0,mode:"interior"});
 assert.equal(ship.walk(axes.forward,axes.strafe,.04),true);
 assert.ok(ship.x>0);
 assert.ok(ship.z<0);
});
test("piloting joystick moves heading and throttle with bounded step and deadzone",()=>{
 const r=shipStickAxes({x:1,y:-1},2);
 assert.ok(r.headingDelta>0);
 assert.ok(r.throttleDelta>0);
 assert.ok(r.headingDelta<=.08*42+1e-10);
 const left=shipStickAxes({x:-1,y:1},.04);
 assert.ok(left.headingDelta<0);
 assert.ok(left.throttleDelta<0);
 assert.deepEqual(shipStickAxes({x:.03,y:.03},.08),{
  forward:0,strafe:0,headingDelta:0,throttleDelta:0
 });
});
