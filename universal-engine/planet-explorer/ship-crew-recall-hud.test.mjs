import test from "node:test";
import assert from "node:assert/strict";
import {SurfaceStarship} from "./surface-starship.mjs";
import {ShipJourney} from "./ship-journey.mjs";
import {ShipInterior} from "./ship-interior.mjs";
import {normalizeShipViewSettings} from "./ship-dashboard-layout.mjs";
import {spacecraftCockpitCrewWindowGeometry} from "./spacecraft-ground-geometry.mjs";

const pad={lat:35.50,lon:139.50,yaw:0.25,padElevationM:12};
test("old screen HUD can be selected; window-attached is the default",()=>{
 assert.equal(normalizeShipViewSettings({}).hudMode,"glass");
 assert.equal(normalizeShipViewSettings({hudMode:"overlay"}).hudMode,"overlay");
 assert.equal(normalizeShipViewSettings({hudMode:"nonsense"}).hudMode,"glass");
});
test("navigator recall starts at old pad, flies a route and actually lands",()=>{
 const ship=new SurfaceStarship();
 ship.place("terra",35.504,139.504,.25,10);
 assert.equal(ship.beginRecall("terra",pad),true);
 assert.equal(ship.flight,"recall");
 assert.equal(ship.remotePilotId,"navigator");
 assert.equal(ship.renderPose().lat,35.504);
 assert.equal(ship.renderPose().altitudeM,0);
 assert.equal(ship.present("terra"),false);
 assert.equal(ship.beginRecall("terra",pad),false);
 let reachedAir=false,reachedTransit=false,landed=false;
 for(let i=0;i<8000;i++){
  const pose=ship.renderPose();
  reachedAir||=pose.altitudeM>90;
  reachedTransit||=pose.lat<35.504&&pose.lat>35.50;
  if(ship.tick(.08)){landed=true;break;}
 }
 assert.equal(reachedAir,true);
 assert.equal(reachedTransit,true);
 assert.equal(landed,true);
 assert.equal(ship.flight,"parked");
 assert.equal(ship.lat,pad.lat);
 assert.equal(ship.lon,pad.lon);
 assert.equal(ship.present("terra"),true);
 assert.equal(ship.remotePilotId,null);
});
test("mid-flight save restores the same approach path, pilot and destination",()=>{
 const ship=new SurfaceStarship();
 ship.place("terra",35.504,139.504,0,10);
 ship.beginRecall("terra",pad);
 ship.tick(2);
 const restored=SurfaceStarship.fromSnapshot(ship.snapshot());
 assert.deepEqual(restored.snapshot(),ship.snapshot());
 assert.deepEqual(restored.renderPose(),ship.renderPose());
});
test("gravity turn banks the hull, release levels it and roll persists",()=>{
 const v=new ShipJourney({originId:"terra",status:"atmosphere"});
 v.autopilot=false;v.steer(6);
 assert.ok(v.rollDeg<0);
 assert.ok(v.rollDeg>=-25);
 const save=ShipJourney.fromSnapshot(v.snapshot());
 assert.equal(save.rollDeg,v.rollDeg);
 const first=Math.abs(v.rollDeg);
 v.tick(.1);
 assert.ok(Math.abs(v.rollDeg)<first);
 v.horizon=true;
 for(let i=0;i<100;i++)v.tick(.1);
 assert.ok(Math.abs(v.rollDeg)<.03);
});
test("crew get duty seats, can stand and follow without losing saved state",()=>{
 const interior=new ShipInterior();
 assert.equal(interior.crew.length,3);
 assert.equal(interior.crew.every(c=>c.seated),true);
 interior.x=-2.3;interior.z=-8.5;
 const first=interior.crew.find(c=>c.id==="navigator");
 assert.ok(interior.setCrewSeated("navigator",false).ok);
 assert.equal(first.seated,false);
 assert.ok(interior.setFollowing("navigator").ok);
 assert.equal(first.following,true);
 assert.equal(first.seated,false);
 const restored=ShipInterior.fromSnapshot(interior.snapshot());
 assert.equal(restored.crew.find(c=>c.id==="navigator").following,true);
});
test("exterior cockpit glazing carries visible pilot and navigator silhouettes",()=>{
 const mesh=spacecraftCockpitCrewWindowGeometry();
 assert.ok(mesh.positions.length>400);
 assert.equal(mesh.positions.length,mesh.normals.length);
 assert.equal(mesh.positions.length,mesh.colors.length);
});
