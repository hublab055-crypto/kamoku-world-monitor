import {test} from "node:test";
import assert from "node:assert/strict";
import {bodyById} from "./solar-system.mjs";
import {geoOffset} from "./geo.mjs";
import {ShipJourney} from "./ship-journey.mjs";
import {SurfaceStarship} from "./surface-starship.mjs";
import {
 PARKING_ORBIT_ALTITUDE_M,bodyCenterM,surfaceShipFrame,
 shipLocalToInertial,inertialToShipLocal,cameraRelativeMeters,
 geodeticToShipLocal,shipLocalToGeodetic,shipJourneyFrame
} from "./unified-space-frame.mjs";

const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
const almost=(a,b,tolerance=1e-4)=>assert.ok(Math.abs(a-b)<=tolerance,
 `Expected ${a} ≈ ${b} within ${tolerance}`);
const site={bodyId:"terra",lat:28,lon:179.999,yaw:Math.PI/5,padElevationM:260};
function ship(){
 return new ShipJourney({originId:"terra",destinationId:"cinder",launchDay:0.24,
  launchSite:site,flightDays:12,interior:{schemaVersion:1,x:0,z:-10},
  status:"docked",seated:true,hatchOpen:false});
}
test("ship and astronaut transforms are metre-accurate at heliocentric distances",()=>{
 const frame=surfaceShipFrame("terra",12.24,28,179.999,260,Math.PI/5);
 const center=bodyCenterM("terra",12.24);
 almost(distance(frame.position,center),bodyById("terra").radiusM+260,1e-3);
 for(const axis of [frame.right,frame.up,frame.back])almost(Math.hypot(...axis),1,1e-10);
 almost(frame.right.reduce((s,x,i)=>s+x*frame.up[i],0),0,1e-10);
 const local={x:3.1,y:1.65,z:11.2};
 const world=shipLocalToInertial(frame,local);
 const roundTrip=inertialToShipLocal(frame,world);
 for(const k of ["x","y","z"])almost(roundTrip[k],local[k],1e-4);
 const relative=cameraRelativeMeters(world,frame.position);
 almost(Math.hypot(...relative),Math.hypot(local.x,local.y,local.z),1e-4);
});
test("boarding and disembark across antimeridian share an exact geodesic frame",()=>{
 const geo=geoOffset(site.lat,site.lon,320,120,bodyById("terra").radiusM);
 assert.ok(geo.lon<0,"crossed the dateline");
 const aboard=geodeticToShipLocal(site,bodyById("terra").radiusM,geo.lat,geo.lon);
 const out=shipLocalToGeodetic(site,bodyById("terra").radiusM,aboard.x,aboard.z);
 almost(out.lat,geo.lat,1e-8);
 almost(out.lon,geo.lon,1e-8);
 const parked=new SurfaceStarship();parked.place("terra",site.lat,site.lon,site.yaw);
 const offset=parked.offsetFromCoords({lat:geo.lat,lon:geo.lon},0,0,bodyById("terra").radiusM);
 assert.ok(offset.hullDistanceM<400,"hull is close even after crossing the longitude seam");
});
test("launch surface -> ascent -> origin orbit is position-continuous",()=>{
 const v=ship(),day=v.launchDay;
 const docked=shipJourneyFrame(v,day);
 v.status="ascent";v.stageProgress=0;
 almost(distance(docked.position,v.framePose(day).position),0,1e-4);
 v.stageProgress=1;
 const top=v.framePose(day);
 v.status="origin-orbit";
 almost(distance(top.position,v.framePose(day).position),0,1e-4);
 almost(top.altitudeM,PARKING_ORBIT_ALTITUDE_M,1e-8);
});
test("transfer path ends at moving destination orbit and entry ends at the same landing site",()=>{
 const v=ship(),startDay=v.launchDay;
 v.status="origin-orbit";
 const departure=v.framePose(startDay);
 v.status="cruise";v.progress=0;
 almost(distance(departure.position,v.framePose(startDay).position),0,1e-4);
 v.progress=1;
 const arrivalDay=startDay+v.flightDays;
 const cruiseEnd=v.framePose(arrivalDay);
 v.status="orbit";
 almost(distance(cruiseEnd.position,v.framePose(arrivalDay).position),0,1e-4);
 const land={bodyId:"cinder",lat:-31.2,lon:176.5,yaw:.3,padElevationM:90};
 assert.equal(v.setLandingSite(land),true);
 v.status="entry";v.stageProgress=0;
 almost(distance(cruiseEnd.position,v.framePose(arrivalDay).position),0,1e-4);
 v.stageProgress=1;
 const entryEnd=v.framePose(arrivalDay);
 v.status="landed";
 almost(distance(entryEnd.position,v.framePose(arrivalDay).position),0,1e-4);
 almost(v.framePose(arrivalDay).altitudeM,land.padElevationM+2,1e-8);
});
test("save/load retains trajectory inputs and continuous geospatial pose",()=>{
 const v=ship();v.status="entry";v.stageProgress=.48;
 v.setLandingSite({bodyId:"cinder",lat:15.2,lon:44.8,yaw:-.5,padElevationM:36});
 const before=v.framePose(v.launchDay+v.flightDays).position;
 const restored=ShipJourney.fromSnapshot(v.snapshot());
 assert.ok(restored);
 const after=restored.framePose(v.launchDay+v.flightDays).position;
 almost(distance(before,after),0,1e-4);
 assert.equal(restored.snapshot().schemaVersion,2);
});
