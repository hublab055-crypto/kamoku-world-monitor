import test from 'node:test';
import assert from 'node:assert/strict';
import {projectShipHudTarget,shipSensorContacts,inertialToShip} from '../planet-explorer/ship-space-visuals.mjs';
import {ShipJourney} from '../planet-explorer/ship-journey.mjs';
const camera={eye:[0,2,0],target:[0,2,-1],fovDeg:108};
test('every offscreen target is placed on the inset screen perimeter',()=>{
 for(const [w,h] of [[390,844],[844,390],[1920,1080]])for(const pos of [[.1,2,100],[0,2,100],[-.1,2,100],[400,2,-1],[0,900,-2]]){
  const p=projectShipHudTarget(pos,camera,w,h,{margin:.08});assert.equal(p.visible,false);
  const nx=p.x/w*2-1,ny=1-p.y/h*2;
  assert.ok(Math.abs(Math.max(Math.abs(nx),Math.abs(ny))-.92)<1e-8);
 }
});
test('rear right and rear left choose their nearest turn direction, never the opposite edge',()=>{
 assert.ok(projectShipHudTarget([1,2,100],camera,844,390).x>422);
 assert.ok(projectShipHudTarget([-1,2,100],camera,844,390).x<422);
});
test('destination is stationary in route space and gets physically closer as pilot advances',()=>{
 const v=new ShipJourney({originId:'terra',destinationId:'cinder',status:'cruise',seated:true,autopilot:false,throttle:1});
 const distance=()=>Math.hypot(...shipSensorContacts(v).find(c=>c.id==='planet').position.map((n,i)=>n-(i===1?2:0)));
 const initial=distance();for(let i=0;i<100;i++)v.tick(.1);
 assert.ok(distance()<initial);assert.ok(distance()<11000);
 v.routeAlong=.975;v.crossTrack=0;v.routeVertical=0;v.status='approach';assert.equal(v.canDirectEntry,true);
 assert.ok(Math.abs(distance()-300)<1e-8);assert.equal(v.enterAtmosphere().ok,true);
});
test('combined yaw and pitch point at the same destination direction used by thrust',()=>{
 const yaw=.7,pitch=.4,dir=[Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),-Math.cos(yaw)*Math.cos(pitch)];
 const local=inertialToShip(dir,yaw*180/Math.PI,pitch*180/Math.PI);
 assert.ok(Math.abs(local[0])<1e-8);assert.ok(Math.abs(local[1])<1e-8);assert.ok(local[2]<-.99);
});
test('manual arrival from orbit is not trapped outside the atmospheric entry state',()=>{
 const v=new ShipJourney({originId:'terra',destinationId:'cinder',status:'orbit',routeAlong:.98,seated:true,autopilot:false});
 assert.equal(v.canDirectEntry,true);assert.equal(v.enterAtmosphere().ok,true);
});
