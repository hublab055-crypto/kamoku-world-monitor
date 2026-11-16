import test from "node:test";
import assert from "node:assert/strict";
import {compassLabel,normalizeHeading,shipGeodeticPosition,windshieldTelemetry,
 formatLatitude,formatLongitude,pitchLadderOffset,windshieldBodyId} from "./ship-windshield-hud.mjs";

const body={id:"earth",radiusM:6371000};
const flight=()=>({status:"atmosphere",seated:true,attitudeYawDeg:-45,pitchDeg:12,
 airAltitude:450,airSpeed:93,airEast:0,airNorth:0,
 landingSite:{bodyId:"earth",lat:35.5,lon:139.5}});

test("windscreen eight-point compass wraps cleanly",()=>{
 assert.equal(compassLabel(0),"N");
 assert.equal(compassLabel(45),"NE");
 assert.equal(compassLabel(-45),"NW");
 assert.equal(compassLabel(270),"W");
 assert.equal(compassLabel(360),"N");
 assert.equal(normalizeHeading(-45),315);
});

test("HUD reference W is fixed; positive pitch shifts the horizon downward",()=>{
 assert.equal(pitchLadderOffset(20,0,8),160);
 assert.equal(pitchLadderOffset(-20,0,8),-160);
 assert.equal(pitchLadderOffset(20,20,8),0);
});

test("departure and arrival use the correct planetary reference",()=>{
 assert.equal(windshieldBodyId({status:"docked",originId:"earth",destinationId:"mars"}),"earth");
 assert.equal(windshieldBodyId({status:"ascent",originId:"earth",destinationId:"mars"}),"earth");
 assert.equal(windshieldBodyId({status:"atmosphere",originId:"earth",destinationId:"mars"}),"mars");
});

test("planet-local east and north offsets convert to geographic degrees",()=>{
 const site={lat:0,lon:0};
 const point=shipGeodeticPosition(site,111195,111195,6371000);
 assert.ok(Math.abs(point.lat-1)<.001);
 assert.ok(Math.abs(point.lon-1)<.001);
 assert.equal(shipGeodeticPosition(null,0,0,6371000),null);
 assert.equal(shipGeodeticPosition(site,0,0,null),null);
 assert.equal(shipGeodeticPosition({lat:90,lon:0},30,0,6371000),null);
});

test("atmospheric telemetry shows physically named speed, altitude and known coordinates",()=>{
 const v=flight();
 const t=windshieldTelemetry(v,{body,height:450});
 assert.equal(t.headingDeg,315);
 assert.equal(t.direction,"NW");
 assert.equal(t.pitchDeg,12);
 assert.equal(t.speedMps,93);
 assert.equal(t.altitudeM,450);
 assert.equal(t.lat,35.5);
 assert.equal(t.lon,139.5);
 assert.equal(formatLatitude(t.lat),"35.5000°N");
 assert.equal(formatLongitude(t.lon),"139.5000°E");
});

test("location and numeric speed are never fabricated for missing orbital/entry physics",()=>{
 const v=flight();
 v.landingSite=null;
 assert.equal(windshieldTelemetry(v,{body}).lat,null);
 v.status="entry";
 v.landingSite={bodyId:"earth",lat:35.5,lon:139.5};
 assert.equal(windshieldTelemetry(v,{body,height:6000}).speedMps,null);
 assert.equal(windshieldTelemetry(v,{body:{id:"mars",radiusM:3000000}}).lat,null);
 v.status="cruise";
 assert.equal(windshieldTelemetry(v,{body}),null);
});

test("ground HUD shows altitude and speed zero without old atmospheric velocities",()=>{
 const v=flight();
 v.status="landed";v.airAltitude=490;v.airSpeed=80;
 const t=windshieldTelemetry(v,{body});
 assert.equal(t.altitudeM,0);
 assert.equal(t.speedMps,0);
});
