import test from "node:test";
import assert from "node:assert/strict";
import {shipTouchAxes,shipTouchPilot,shipCameraPose} from "../planet-explorer/ship-view-controls.mjs";
const near=(a,b,tol=1e-9)=>assert.ok(Math.abs(a-b)<tol,`expected ${a} ≈ ${b}`);

test("shipboard touch stick walks toward the cockpit, back and both sides",()=>{
 const up=shipTouchAxes({x:0,y:-1}),down=shipTouchAxes({x:0,y:1});
 const left=shipTouchAxes({x:-1,y:0}),right=shipTouchAxes({x:1,y:0});
 assert.equal(up.forward,1);assert.equal(down.forward,-1);
 assert.equal(left.sideways,-1);assert.equal(right.sideways,1);
 assert.equal(up.sideways,0);
});
test("diagonal input is normalized and deadzone suppresses unintentional steps",()=>{
 const diag=shipTouchAxes({x:1,y:-1});
 near(Math.hypot(diag.forward,diag.sideways),1);
 near(diag.forward,Math.SQRT1_2);near(diag.sideways,Math.SQRT1_2);
 assert.deepEqual(shipTouchAxes({x:0.05,y:-0.06}),{forward:0,sideways:0,magnitude:0});
 assert.deepEqual(shipTouchAxes({x:NaN,y:Infinity}),{forward:0,sideways:0,magnitude:0});
});
test("pilot left/right adjusts course and up/down adjusts throttle on existing flight engine",()=>{
 const right=shipTouchPilot({x:1,y:0},.04),up=shipTouchPilot({x:0,y:-1},.04),down=shipTouchPilot({x:0,y:1},.04);
 assert.ok(right.yawDelta>0);near(right.throttleDelta,0);
 assert.ok(up.throttleDelta>0);assert.ok(down.throttleDelta<0);
 near(shipTouchPilot({x:-1,y:0},.04).yawDelta,-right.yawDelta);
 assert.deepEqual(shipTouchPilot({x:1,y:1},0),{yawDelta:0,throttleDelta:0});
 assert.deepEqual(shipTouchPilot({x:1,y:1},NaN),{yawDelta:0,throttleDelta:0});
});
test("third-person ship camera shows the hull behind the nose and widens its field of view",()=>{
 const narrow=shipCameraPose({mode:"chase",wide:false,distance:52,interior:{seated:true}});
 const broad=shipCameraPose({mode:"chase",wide:true,distance:52,interior:{seated:true}});
 assert.equal(narrow.drawExterior,true);assert.equal(broad.drawExterior,true);
 assert.ok(broad.fovDeg>narrow.fovDeg);
 assert.ok(broad.eye[2]>20&&broad.target[2]<0);
 assert.ok(broad.eye[1]>broad.target[1]);
 const distant=shipCameraPose({mode:"chase",wide:true,distance:105});
 assert.ok(distant.eye[2]>broad.eye[2]);
});
test("cockpit camera preserves the walked position and pitch, with wide visibility",()=>{
 const p={x:2,z:-7,yaw:Math.PI/2,pitch:.2,seated:false};
 const narrow=shipCameraPose({interior:p,mode:"cockpit",wide:false});
 const wide=shipCameraPose({interior:p,mode:"cockpit",wide:true});
 assert.equal(narrow.drawExterior,false);assert.equal(narrow.eye[0],2);
 assert.equal(narrow.eye[2],-7);assert.ok(wide.fovDeg>narrow.fovDeg);
 assert.ok(narrow.target[0]>narrow.eye[0]);
 const seated=shipCameraPose({interior:{...p,seated:true},mode:"cockpit"});
 near(seated.eye[1],1.25);
});
