import test from "node:test";
import assert from "node:assert/strict";
import {inertialToShip,starDirections,starfieldGeometry,exhaustGeometry,
 shipSensorContacts,projectShipHudTarget} from "../planet-explorer/ship-space-visuals.mjs";
import {shipCameraPose} from "../planet-explorer/ship-view-controls.mjs";
const near=(a,b,t=1e-8)=>assert.ok(Math.abs(a-b)<t,`${a} != ${b}`);
test("yaw and pitch move ALL fixed stars opposite manual nose movement",()=>{
 const front=[0,0,-400],r=inertialToShip(front,30,0),
 l=inertialToShip(front,-30,0),up=inertialToShip(front,0,20);
 assert.ok(r[0]<0);assert.ok(l[0]>0);assert.ok(up[1]<0);
 near(Math.hypot(...r),400);near(Math.hypot(...up),400);
});
test("deterministic GPU starfield spans the whole sky and has legal indices",()=>{
 assert.deepEqual(starDirections(24),starDirections(24));
 const stars=starfieldGeometry(96,1500);
 assert.equal(stars.indices.length,96*6);
 assert.equal(stars.positions.length,stars.normals.length);
 assert.equal(stars.positions.length,stars.colors.length);
 assert.ok(stars.indices.every(i=>i<stars.positions.length/3));
});
test("engine exhaust contains separate colors for normal boost and reverse",()=>{
 const a=exhaustGeometry("cruise"),b=exhaustGeometry("boost"),c=exhaustGeometry("reverse");
 assert.equal(a.positions.length,b.positions.length);
 assert.notDeepEqual(a.colors,b.colors);
 assert.notDeepEqual(a.colors,c.colors);
});
test("HUD shows direction arrows for offscreen targets and rotates chase camera",()=>{
 const camera=shipCameraPose({mode:"chase",orbitYaw:0,orbitPitch:.31,wide:true});
 const front=projectShipHudTarget([0,4,-400],camera,900,500);
 const off=projectShipHudTarget([850,10,-400],camera,900,500);
 const behind=projectShipHudTarget([0,3,400],camera,900,500);
 assert.ok(front);assert.ok(off);assert.ok(behind);
 assert.equal(front.visible,true);
 assert.equal(off.visible,false);
 assert.equal(behind.visible,false);
 assert.ok(off.x>550);
 const rotated=shipCameraPose({mode:"chase",orbitYaw:Math.PI/2,orbitPitch:.9,wide:true});
 assert.ok(rotated.eye[0]>camera.eye[0]);
 assert.ok(rotated.eye[1]>camera.eye[1]);
});
test("planet flyby places destination behind, with a still valid distance",()=>{
 const data={originId:"terra",destinationId:"cinder",launchDay:0,flightDays:7,
  status:"flyby",progress:1,routeAlong:1.2,crossTrack:0,attitudeYawDeg:0,elapsedSeconds:3};
 const contacts=shipSensorContacts(data);
 const planet=contacts.find(c=>c.id==="planet");
 assert.ok(planet.position[2]>0);
 assert.ok(planet.distanceAU>0);
 assert.ok(contacts.some(c=>c.type==="pirate"));
 assert.ok(contacts.some(c=>c.type==="civilian"));
 assert.ok(contacts.every(c=>typeof c.distance==="string"&&c.distance.length>0));
});
