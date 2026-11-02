import test from "node:test";
import assert from "node:assert/strict";
import {shipTouchAxes,shipTouchPilot,shipCameraPose,shipCelestialPosition} from "../planet-explorer/ship-view-controls.mjs";
import {ShipJourney} from "../planet-explorer/ship-journey.mjs";
import {SpaceVoyage} from "../planet-explorer/space-voyage.mjs";
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
test("cockpit stick adjusts yaw and nose pitch, not engine thrust",()=>{
 const right=shipTouchPilot({x:1,y:0},.04);
 const up=shipTouchPilot({x:0,y:-1},.04);
 const down=shipTouchPilot({x:0,y:1},.04);
 assert.ok(right.yawDelta>0);near(right.pitchDelta,0);
 assert.ok(up.pitchDelta>0);assert.ok(down.pitchDelta<0);
 near(shipTouchPilot({x:-1,y:0},.04).yawDelta,-right.yawDelta);
 assert.equal("throttleDelta" in up,false);
 assert.equal("throttleDelta" in down,false);
 assert.deepEqual(shipTouchPilot({x:1,y:1},0),{yawDelta:0,pitchDelta:0});
 assert.deepEqual(shipTouchPilot({x:1,y:1},NaN),{yawDelta:0,pitchDelta:0});
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

test("planet moves across cockpit window in opposite direction to a manual yaw turn",()=>{
 const front=shipCelestialPosition({yawDeg:0,pitchDeg:0,distance:420});
 const rightTurn=shipCelestialPosition({yawDeg:30,pitchDeg:0,distance:420});
 const leftTurn=shipCelestialPosition({yawDeg:-30,pitchDeg:0,distance:420});
 near(front[0],0);near(front[1],-50);near(front[2],-420);
 assert.ok(rightTurn[0]<front[0]);
 assert.ok(leftTurn[0]>front[0]);
 assert.ok(rightTurn[2]>front[2]); // rotation keeps orbital distance constant
 near(Math.hypot(rightTurn[0],rightTurn[2]),420);
});
test("planet falls in the cockpit window when nose is raised",()=>{
 const level=shipCelestialPosition({yawDeg:0,pitchDeg:0,distance:350});
 const noseUp=shipCelestialPosition({yawDeg:0,pitchDeg:24,distance:350});
 const noseDown=shipCelestialPosition({yawDeg:0,pitchDeg:-24,distance:350});
 assert.ok(noseUp[1]<level[1]);
 assert.ok(noseDown[1]>level[1]);
 const invalid=shipCelestialPosition({yawDeg:NaN,pitchDeg:Infinity,distance:NaN});
 near(invalid[0],0);near(invalid[1],-50);near(invalid[2],-420);
});
test("ship journey saves pilot attitude and loads older saves at zero attitude",()=>{
 const ship=new ShipJourney({originId:"terra",status:"cruise",seated:true,throttle:.66});
 const initialThrottle=ship.throttle;
 ship.steer(29);ship.pitch(15);
 near(ship.throttle,initialThrottle);
 near(ship.attitudeYawDeg,29);near(ship.pitchDeg,15);
 const restored=ShipJourney.fromSnapshot(ship.snapshot());
 assert.ok(restored);near(restored.pitchDeg,15);near(restored.attitudeYawDeg,29);
 near(restored.throttle,initialThrottle);
 const previous=ship.snapshot();delete previous.attitudeYawDeg;delete previous.pitchDeg;
 const migrated=ShipJourney.fromSnapshot(previous);
 near(migrated.attitudeYawDeg,0);near(migrated.pitchDeg,0);
});
test("legacy orbit voyage preserves its pitch/yaw additions without breaking schema v1",()=>{
 const old=new SpaceVoyage({originId:"terra",destinationId:"selene"});
 old.steer(12);old.pitch(-11);
 const snapshot=old.snapshot();
 assert.equal(snapshot.schemaVersion,1);
 const restored=SpaceVoyage.fromSnapshot(snapshot);
 assert.ok(restored);near(restored.attitudeYawDeg,12);near(restored.pitchDeg,-11);
 delete snapshot.pitchDeg;delete snapshot.attitudeYawDeg;
 near(SpaceVoyage.fromSnapshot(snapshot).pitchDeg,0);
});
