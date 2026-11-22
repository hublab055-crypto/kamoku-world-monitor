import {test} from "node:test";
import assert from "node:assert/strict";
import {celestialBallGeometry,groundScenePhase,sharedShipInteriorGeometry} from "./ship-shared-scene.mjs";
import {ShipJourney} from "./ship-journey.mjs";
import {SurfaceStarship} from "./surface-starship.mjs";

test("a single WebGL2 mesh contract accepts cabin, open airlock and celestial sphere",()=>{
 for(const geo of [sharedShipInteriorGeometry(false),sharedShipInteriorGeometry(true),celestialBallGeometry()]){
  assert.ok(geo.positions.length>900);
  assert.equal(geo.positions.length,geo.normals.length);
  assert.equal(geo.positions.length,geo.colors.length);
  assert.ok(geo.indices.length>0);
  assert.ok(Math.max(...geo.indices)<65535);
  assert.ok(geo.positions.every(Number.isFinite));
 }
 assert.notEqual(sharedShipInteriorGeometry(false).indices.length,sharedShipInteriorGeometry(true).indices.length);
});
test("ground and atmosphere interpolate monotonically during launch and reentry",()=>{
 const at=phase=>groundScenePhase(phase);
 assert.equal(at({status:"docked"}).showGround,true);
 assert.equal(at({status:"landed"}).showGround,true);
 const lower=at({status:"ascent",stageProgress:.12});
 const higher=at({status:"ascent",stageProgress:.8});
 assert.ok(lower.lift<higher.lift);
 assert.ok(lower.sky>higher.sky);
 assert.equal(higher.showGround,false);
 const entryHigh=at({status:"entry",stageProgress:.12});
 const entryLow=at({status:"entry",stageProgress:.95});
 assert.ok(entryHigh.lift>entryLow.lift);
 assert.ok(entryHigh.sky<entryLow.sky);
});
test("airlock ramp can be traversed only when opened, and seat disallows walking",()=>{
 const v=new ShipJourney({originId:"terra",status:"docked",hatchOpen:true,
  launchSite:{bodyId:"terra",lat:28,lon:42,yaw:0},
  interior:{schemaVersion:1,x:0,z:17.2,yaw:0,mode:"interior"}});
 assert.ok(v.interior.hatchPassable);
 for(let i=0;i<25;i++)v.interior.walk(1,0,.08);
 assert.ok(v.interior.z<15);
 assert.ok(v.isNearHatch());
 assert.ok(v.toggleHatch().ok);
 assert.equal(v.interior.hatchPassable,false);
 v.interior.yaw=Math.PI;
 for(let i=0;i<30;i++)v.interior.walk(1,0,.08);
 assert.ok(v.interior.z<=12.7);
 v.interior.yaw=0;
 for(let i=0;i<155;i++)v.interior.walk(1,0,.08);
 assert.ok(v.isNearSeat());
 assert.ok(v.sit().ok);
 assert.equal(v.interior.walk(1,0,.1),false);
 assert.ok(v.launch().ok);
 const copy=ShipJourney.fromSnapshot(v.snapshot());
 assert.deepEqual(copy.launchSite,v.launchSite);
 assert.equal(copy.interior.hatchPassable,false);
});
test("parked ship mapping keeps the same location across save and departure",()=>{
 const p=new SurfaceStarship();
 p.place("terra",28,42,.2);
 const saved=p.snapshot();
 assert.equal(p.present("terra"),true);
 p.takeOff();
 assert.equal(p.present("terra"),false);
 assert.equal(SurfaceStarship.fromSnapshot(saved).present("terra"),true);
});
