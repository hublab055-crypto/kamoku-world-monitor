import {test} from "node:test";
import assert from "node:assert/strict";
import {ShipJourney} from "./ship-journey.mjs";
import {SurfaceStarship} from "./surface-starship.mjs";
import {ShipInterior} from "./ship-interior.mjs";

function advanceUntil(v,status,max=5000){
 let days=0;
 for(let i=0;i<max&&v.status!==status;i++)days+=v.tick(.08).days;
 assert.equal(v.status,status,"Reached "+status+" within bounded flight time");
 return days;
}
test("ground hatch -> walkway -> seated helm -> orbital transfer -> landed exit",()=>{
 const craft=new SurfaceStarship();
 craft.place("terra",28,42);
 assert.equal(craft.present("terra"),true);
 craft.hatchOpen=true;
 const v=new ShipJourney({originId:"terra",hatchOpen:true,status:"docked",
  interior:{schemaVersion:1,x:0,z:11.4}});
 assert.equal(v.launch().ok,false,"Airlock cannot be left open while lifting off");
 assert.equal(v.toggleHatch().ok,true);
 assert.equal(v.hatchOpen,false);
 for(let i=0;i<130;i++)v.interior.walk(1,0,.08);
 assert.ok(v.isNearSeat());
 assert.equal(v.sit().ok,true);
 assert.equal(v.interior.walk(1,0,.08),false,"Seated pilot cannot walk through cockpit");
 assert.equal(v.launch().ok,true);
 craft.takeOff();
 assert.equal(craft.present("terra"),false);
 advanceUntil(v,"origin-orbit");
 assert.equal(v.startTransfer().ok,false,"Cannot depart orbit before choosing destination");
 assert.equal(v.chooseDestination("selene",7).ok,true);
 assert.equal(v.startTransfer().ok,true);
 assert.ok(Math.abs(advanceUntil(v,"orbit")-7)<1e-7);
 assert.equal(v.enterAtmosphere().ok,true);
 advanceUntil(v,"landed");
 craft.landedOn("selene",19,30);
 assert.equal(craft.present("selene"),true);
 assert.equal(v.canDisembark(),false,"Must stand and open the hatch before exit");
 assert.equal(v.stand().ok,true);
 for(let i=0;i<130;i++)v.interior.walk(-1,0,.08);
 assert.ok(v.isNearHatch());
 assert.equal(v.toggleHatch().ok,true);
 assert.equal(v.canDisembark(),true);
 const saved=ShipJourney.fromSnapshot(v.snapshot());
 assert.equal(saved.hatchOpen,true);
 assert.equal(saved.status,"landed");
 assert.equal(saved.interior.z,v.interior.z);
 assert.equal(SurfaceStarship.fromSnapshot(craft.snapshot()).present("selene"),true);
});
test("save during ascent and cruise restores flight and cabin",()=>{
 const v=new ShipJourney({originId:"terra",hatchOpen:false,seated:true,
  interior:{schemaVersion:1,x:0,z:-10,status:"docked"}});
 assert.equal(v.launch().ok,true);
 for(let i=0;i<30;i++)v.tick(.08);
 const resumed=ShipJourney.fromSnapshot(v.snapshot());
 assert.equal(resumed.status,"ascent");
 assert.equal(resumed.seated,true);
 assert.equal(resumed.interior.seated,true);
 advanceUntil(resumed,"origin-orbit");
 assert.equal(resumed.chooseDestination("cinder",10).ok,true);
 assert.equal(resumed.startTransfer().ok,true);
 for(let i=0;i<75;i++)resumed.tick(.08);
 const cruise=ShipJourney.fromSnapshot(resumed.snapshot());
 assert.equal(cruise.progress,resumed.progress);
 assert.equal(cruise.fuel,resumed.fuel);
 assert.equal(cruise.destinationId,"cinder");
});
test("hatch and flight controls reject unsafe actions",()=>{
 const v=new ShipJourney({originId:"terra",hatchOpen:true,seated:false,
  interior:{schemaVersion:1,x:0,z:11.5}});
 assert.equal(v.enterAtmosphere().ok,false);
 assert.equal(v.chooseDestination("cinder",2).ok,false);
 assert.equal(v.sit().ok,false);
 assert.equal(v.toggleHatch().ok,true);
 assert.equal(v.toggleHatch().ok,true);
 assert.equal(v.hatchOpen,true);
 assert.equal(v.startTransfer().ok,false);
});
