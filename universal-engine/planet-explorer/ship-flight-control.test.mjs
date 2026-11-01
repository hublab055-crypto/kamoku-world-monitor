import test from "node:test";
import assert from "node:assert/strict";
import {ShipFlightControl} from "./ship-flight-control.mjs";
import {ShipJourney} from "./ship-journey.mjs";
import {SpaceVoyage} from "./space-voyage.mjs";

test("mobile cockpit yaw, pitch and roll are bounded and use deadzone",()=>{
 const flight=new ShipFlightControl();
 const y=flight.input({x:1,y:1,mode:"yaw",dt:3});
 assert.ok(y.yawDelta>0&&y.yawDelta<=42*.08+1e-10);
 assert.ok(flight.pitch<0);assert.equal(flight.roll,0);
 flight.input({x:1,y:0,mode:"roll",dt:10});
 assert.ok(flight.roll>0&&flight.roll<=60);assert.equal(flight.input({x:.03,y:.02,dt:.01}).yawDelta,0);
 for(let i=0;i<1000;i++)flight.input({x:1,y:-1,mode:"roll",dt:.08});
 assert.equal(flight.pitch,35);assert.equal(flight.roll,60);
});
test("flight attitude is damped by autopilot and affects cruising efficiency",()=>{
 const f=new ShipFlightControl({pitch:30,roll:40});
 assert.ok(f.maneuverEfficiency<1);assert.equal(f.landingAligned,false);
 for(let i=0;i<60;i++)f.stabilize(.08);
 assert.ok(Math.abs(f.pitch)<.02&&Math.abs(f.roll)<.02);
 assert.ok(f.landingAligned);assert.ok(f.maneuverEfficiency>.99);
});
test("landing gear cannot retract during atmospheric entry; saved gear persists",()=>{
 const f=new ShipFlightControl({gearDeployed:true});
 const invalid=f.setGear(false,"entry");assert.equal(invalid.ok,false);assert.equal(f.gearDeployed,true);
 assert.equal(f.setGear(false,"orbit").ok,true);
 assert.equal(f.gearDeployed,false);
 assert.equal(new ShipFlightControl(f.snapshot()).gearDeployed,false);
 assert.equal(new ShipFlightControl().gearDeployed,true); // old save compatibility
});
test("surface-to-surface landing checks require seated, aligned and deployed gear",()=>{
 const ship=new ShipJourney({originId:"terra",destinationId:"cinder",status:"orbit",
  seated:true,heading:2,flightControl:{gearDeployed:false}});
 assert.equal(ship.readyToLand,false);
 assert.equal(ship.enterAtmosphere().ok,false);
 assert.equal(ship.toggleLandingGear().ok,true);
 assert.equal(ship.readyToLand,true);
 ship.applyPilotStick({x:1,y:-1,mode:"roll",dt:1});
 assert.ok(ship.flightControl.pitch>0&&ship.flightControl.roll>0);
 ship.flightControl.pitch=25;
 assert.equal(ship.readyToLand,false);
 ship.flightControl.pitch=0;ship.flightControl.roll=0;
 assert.equal(ship.readyToLand,true);
 const restored=ShipJourney.fromSnapshot(ship.snapshot());
 assert.ok(restored?.flightControl.gearDeployed);
 assert.equal(restored.flightControl.roll,0);
});
test("legacy orbital flight retains save and gear safety",()=>{
 const v=new SpaceVoyage({originId:"terra",destinationId:"nix",status:"orbit",heading:0});
 assert.equal(v.readyToLand,true);
 v.toggleLandingGear();assert.equal(v.readyToLand,false);
 assert.equal(v.beginDescent().ok,false);
 v.toggleLandingGear();assert.equal(v.beginDescent().ok,true);
 assert.equal(v.toggleLandingGear().ok,false);
 const loaded=SpaceVoyage.fromSnapshot(v.snapshot());
 assert.ok(loaded);assert.equal(loaded.flightControl.gearDeployed,true);
});
test("automatic orbit arrival deploys landing gear; manual flight does not",()=>{
 const base={originId:"terra",destinationId:"nix",status:"cruise",progress:.9999,throttle:1,flightDays:1};
 const auto=new ShipJourney({...base,kind:"surface-to-surface",seated:true,autopilot:true,flightControl:{gearDeployed:false}});
 auto.tick(.12);assert.equal(auto.status,"orbit");assert.equal(auto.flightControl.gearDeployed,true);
 const manual=new ShipJourney({...base,kind:"surface-to-surface",seated:true,autopilot:false,flightControl:{gearDeployed:false}});
 manual.tick(.12);assert.equal(manual.status,"orbit");assert.equal(manual.flightControl.gearDeployed,false);
});
