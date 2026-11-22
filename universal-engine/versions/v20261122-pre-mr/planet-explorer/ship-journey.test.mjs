import {test} from "node:test";
import assert from "node:assert/strict";
import {ShipJourney} from "./ship-journey.mjs";

const newShip=()=>new ShipJourney({originId:"terra",launchDay:.24,
 interior:{schemaVersion:1,x:0,z:11.4,yaw:0,mode:"interior"}});

test("boarding requires closing the pressure hatch and actually sitting",()=>{
 const ship=newShip();
 assert.equal(ship.status,"docked");
 assert.equal(ship.launch().ok,false);
 assert.equal(ship.toggleHatch().ok,true);
 assert.equal(ship.launch().ok,false);
 ship.interior.z=-8.3;
 assert.equal(ship.sit().ok,true);
 assert.equal(ship.launch().ok,true);
 assert.equal(ship.status,"ascent");
 assert.equal(ship.hatchOpen,false);
 assert.equal(ship.toggleHatch().ok,false);
});
test("orbital waypoint selection follows ascent and is required for transfer",()=>{
 const ship=newShip();
 ship.toggleHatch();ship.interior.z=-8.3;ship.sit();ship.launch();
 let elapsed=0;
 while(ship.status!=="origin-orbit"&&elapsed++<5000)ship.tick(.08);
 assert.equal(ship.status,"origin-orbit");
 assert.equal(ship.startTransfer().ok,false);
 assert.equal(ship.chooseDestination("cinder",18).ok,true);
 assert.equal(ship.startTransfer().ok,true);
 let days=0;
 for(let n=0;n<5000&&ship.status!=="orbit";n++)days+=ship.tick(.08).days;
 assert.equal(ship.status,"orbit");
 assert.ok(Math.abs(days-18)<1e-7);
});
test("atmospheric descent only begins when seated and aligned",()=>{
 const ship=newShip();
 ship.status="orbit";ship.destinationId="nix";
 ship.heading=24;ship.seated=true;
 assert.equal(ship.enterAtmosphere().ok,false);
 ship.heading=0;
 assert.equal(ship.enterAtmosphere().ok,true);
 assert.equal(ship.status,"entry");
 for(let n=0;n<5000&&ship.status!=="landed";n++)ship.tick(.08);
 assert.equal(ship.status,"landed");
 assert.equal(ship.hatchOpen,false);
 assert.equal(ship.canDisembark(),false);
 ship.stand();ship.interior.x=0;ship.interior.z=11.4;
 assert.equal(ship.toggleHatch().ok,true);
 assert.equal(ship.canDisembark(),true);
});
test("save round trip preserves location, autopilot, chosen destination and airlock",()=>{
 const ship=newShip();
 ship.toggleHatch();ship.interior.z=-8.3;ship.sit();ship.launch();
 for(let n=0;n<60;n++)ship.tick(.08);
 const restored=ShipJourney.fromSnapshot(ship.snapshot());
 assert.ok(restored);
 assert.deepEqual(restored.snapshot(),ship.snapshot());
 assert.equal(ShipJourney.fromSnapshot(null),null);
});
test("manual heading and throttle affect transfer time while still being bounded",()=>{
 const a=newShip();
 a.status="cruise";a.destinationId="selene";a.flightDays=5;a.autopilot=false;a.setThrottle(0.3);a.steer(40);
 assert.equal(a.heading,40);
 const fast=newShip();
 fast.status="cruise";fast.destinationId="selene";fast.flightDays=5;fast.setThrottle(1);
 for(let n=0;n<30;n++){a.tick(.08);fast.tick(.08);}
 assert.ok(fast.progress>a.progress);
 assert.throws(()=>a.setThrottle(NaN));
 assert.equal(a.chooseDestination("terra",6).ok,false);
});
