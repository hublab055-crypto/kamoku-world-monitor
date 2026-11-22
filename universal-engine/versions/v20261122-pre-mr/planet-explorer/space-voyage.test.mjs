import {test} from "node:test";
import assert from "node:assert/strict";
import {SpaceVoyage} from "./space-voyage.mjs";

test("flight requires departure and preserves surface while in preflight",()=>{
 const flight=new SpaceVoyage({originId:"terra",destinationId:"cinder",flightDays:18,launchDay:.24});
 assert.equal(flight.tick(1).days,0);
 assert.equal(flight.status,"preflight");
 assert.equal(flight.cancel().ok,true);
 assert.equal(flight.active,false);
});
test("voyage advances continuously and consumes exactly planned game days",()=>{
 const flight=new SpaceVoyage({originId:"terra",destinationId:"selene",flightDays:8,launchDay:.24});
 assert.equal(flight.launch().ok,true);
 let days=0;
 for(let k=0;k<5000&&flight.status!=="orbit";k++){
  const result=flight.tick(.08);
  days+=result.days;
  assert.ok(flight.progress>=0&&flight.progress<=1);
  assert.ok(flight.fuel>=0&&flight.fuel<=100);
 }
 assert.equal(flight.status,"orbit");
 assert.ok(Math.abs(days-8)<1e-8);
 assert.equal(flight.readyToLand,true);
 assert.equal(flight.tick(.08).days,0);
});
test("manual helm changes heading; autopilot returns to docking corridor",()=>{
 const flight=new SpaceVoyage({originId:"terra",destinationId:"nix",flightDays:13});
 flight.setAutopilot(false);flight.steer(40);flight.launch();
 for(let k=0;k<25;k++)flight.tick(.08);
 assert.equal(flight.heading,40);
 flight.setAutopilot(true);
 for(let k=0;k<100;k++)flight.tick(.08);
 assert.ok(Math.abs(flight.heading)<.0001);
});
test("serialized in-flight state can continue from the same progress",()=>{
 const first=new SpaceVoyage({originId:"terra",destinationId:"cinder",flightDays:16});
 first.launch();
 for(let k=0;k<70;k++)first.tick(.08);
 const copy=SpaceVoyage.fromSnapshot(first.snapshot());
 assert.ok(copy);
 assert.equal(copy.status,first.status);
 assert.equal(copy.progress,first.progress);
 assert.equal(copy.fuel,first.fuel);
 assert.equal(copy.destinationId,"cinder");
 assert.ok(copy.tick(.08).progress===undefined); // public tick contract returns elapsed/days
 assert.ok(copy.progress>first.progress);
});
test("rejects malformed destination and invalid physics inputs",()=>{
 assert.throws(()=>new SpaceVoyage({originId:"terra",destinationId:"terra",flightDays:1}));
 assert.throws(()=>new SpaceVoyage({originId:"terra",destinationId:"belt",flightDays:1}));
 const flight=new SpaceVoyage({originId:"terra",destinationId:"cinder",flightDays:5});
 assert.throws(()=>flight.tick(-1));
 assert.throws(()=>flight.setThrottle(Number.NaN));
 assert.equal(flight.setThrottle(2),undefined);
 assert.equal(flight.throttle,1);
});
