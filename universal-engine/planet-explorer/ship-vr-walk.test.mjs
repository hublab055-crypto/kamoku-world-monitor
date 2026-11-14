import test from "node:test";
import assert from "node:assert/strict";
import {ShipInterior} from "./ship-interior.mjs";
import {applyShipVRWalk} from "./ship-vr-walk.mjs";

const newShip=(options={})=>({
 interior:new ShipInterior({x:0,z:0,yaw:0,...options}),
 seated:Boolean(options.seated)
});

test("Quest immersive stick moves player inside ship coordinates",()=>{
 const ship=newShip();
 const result=applyShipVRWalk(ship,0.1,{forward:1,strafe:0,turn:0});
 assert.ok(ship.interior.z<-.2);
 assert.equal(result.indoor,true);
 assert.equal(result.onShip,true);
 assert.ok(result.traveledM>.2);
 assert.equal(result.blocked,false);
});
test("Quest strafe is applied to the ship-local actor rather than vessel",()=>{
 const ship=newShip();
 applyShipVRWalk(ship,0.1,{forward:0,strafe:-1,turn:0});
 assert.ok(ship.interior.x<-.2);
 assert.equal(ship.interior.z,0);
});
test("Ship walls block XR movement and expose the blocked diagnostic",()=>{
 const ship=newShip({x:3.4,z:0});
 const result=applyShipVRWalk(ship,.1,{forward:0,strafe:1,turn:0});
 assert.equal(result.traveledM,0);
 assert.equal(result.blocked,true);
});
test("Pilot seat locks walking but does not alter flight input or ship position",()=>{
 const ship=newShip({seated:true});
 const before=ship.interior.snapshot();
 const result=applyShipVRWalk(ship,.1,{forward:1,strafe:1,turn:1});
 assert.equal(result.traveledM,0);
 assert.equal(result.blocked,false);
 assert.equal(result.seated,true);
 assert.deepEqual(ship.interior.snapshot(),before);
});
test("Ship-local turn and input validation prevent NaN propagation",()=>{
 const ship=newShip();
 const result=applyShipVRWalk(ship,.05,{forward:NaN,strafe:0,turn:1});
 assert.equal(result.traveledM,0);
 assert.ok(ship.interior.yaw>.05);
 assert.ok(Number.isFinite(ship.interior.x));
 assert.ok(Number.isFinite(ship.interior.z));
});
