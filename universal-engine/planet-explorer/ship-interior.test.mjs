import {test} from "node:test";
import assert from "node:assert/strict";
import {ShipInterior,SHIP_CREW,SHIP_STATIONS} from "./ship-interior.mjs";
import {SpaceVoyage} from "./space-voyage.mjs";

test("walk from cockpit through bulkheads to ship cargo bay",()=>{
 const s=new ShipInterior();
 assert.equal(s.z,-8.2);
 for(let i=0;i<130;i++)s.walk(-1,0,.08);
 assert.ok(s.z>9,"Walkable axial corridor must reach cargo.");
 assert.ok(s.nearStations().some(p=>p.id==="cargo"));
 assert.ok(s.z<=12.7);
});
test("walls and cargo crates physically restrict walking",()=>{
 const s=new ShipInterior();
 s.turn(Math.PI/2);
 for(let i=0;i<80;i++)s.walk(1,0,.08);
 assert.ok(s.x<=3.48);
 assert.ok(s.x>0);
 const p=new ShipInterior({x:0,z:7});
 for(let i=0;i<50;i++)p.walk(0,1,.08);
 assert.ok(p.x<2.1,"Crate bank must prevent passing through shelves.");
});
test("nearby crew talk is distance checked and responds to voyage status",()=>{
 const s=new ShipInterior({x:-1.5,z:-9.5});
 const reply=s.talk("navigator",{status:"preflight",fuel:95});
 assert.equal(reply.ok,true);
 assert.equal(reply.name,"航法士");
 const far=s.talk("engineer",{status:"orbit",fuel:11});
 assert.equal(far.ok,false);
 s.x=1.7;s.z=7.2;
 const low=s.talk("engineer",{fuel:8,status:"cruise"});
 assert.equal(low.ok,true);
 assert.match(low.message,/少なく/);
});
test("3D camera heading and ship location roundtrip in voyage saves",()=>{
 const flight=new SpaceVoyage({originId:"terra",destinationId:"cinder",flightDays:13});
 flight.interior.walk(-1,0,.1);
 flight.interior.turn(.6,.15);
 flight.interior.mode="cockpit";
 flight.launch();flight.tick(.08);
 const restored=SpaceVoyage.fromSnapshot(flight.snapshot());
 assert.ok(restored);
 assert.deepEqual(restored.interior.snapshot(),flight.interior.snapshot());
 assert.equal(restored.progress,flight.progress);
});
test("invalid or legacy ship location is bounded safely",()=>{
 const s=ShipInterior.fromSnapshot({schemaVersion:1,x:900,z:-999,pitch:100});
 assert.ok(Math.abs(s.x)<=3.48);
 assert.ok(s.z>=-12.75);
 assert.ok(Math.abs(s.pitch)<=.8);
 const legacy=ShipInterior.fromSnapshot(null);
 assert.equal(legacy.mode,"interior");
});
