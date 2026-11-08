import test from 'node:test';
import assert from 'node:assert/strict';
import {ShipJourney} from '../planet-explorer/ship-journey.mjs';
const ship=()=>new ShipJourney({originId:'terra',destinationId:'cinder',status:'cruise',seated:true,autopilot:true});
test('autopilot reaches the atmospheric entry boundary and can begin entry without manual toggle',()=>{
 const v=ship();let frames=0;
 while(!v.canDirectEntry&&frames++<3000)v.tick(.1);
 assert.ok(frames<3000);assert.equal(v.autopilot,true);
 assert.equal(v.enterAtmosphere().ok,true);assert.equal(v.status,'entry');
 for(let i=0;i<200&&v.status==='entry';i++)v.tick(.1);
 assert.equal(v.status,'atmosphere');
});
test('all selected contact categories steer the nose and close range with a safe stand-off',()=>{
 for(const faction of ['hostile','resource','friendly','neutral']){
  const v=ship();v.selectNavigationTarget({id:faction,name:faction,position:[800,300,500],faction});
  const distance=()=>Math.hypot(800-v.crossTrack*12000,300-v.routeVertical*12000,500-v.routeAlong*12000);
  const before=distance();for(let i=0;i<800;i++)v.tick(.1);
  assert.ok(distance()<before);assert.ok(distance()>60&&distance()<100);
  assert.ok(v.attitudeYawDeg>0);assert.ok(v.pitchDeg>0);assert.equal(v.canDirectEntry,false);
 }
});
test('selected moving contact can be refreshed while following',()=>{
 const v=ship();v.selectNavigationTarget({id:'trader',name:'trader',position:[0,0,600]});
 for(let i=0;i<100;i++){v.navigationTarget.position[0]+=2;v.tick(.1);}
 assert.ok(v.crossTrack>0);assert.ok(v.attitudeYawDeg>0);
 const restored=ShipJourney.fromSnapshot(v.snapshot());assert.deepEqual(restored.navigationTarget,v.navigationTarget);
});
test('a selected planet at the route endpoint permits automatic direct entry from orbit',()=>{
 const v=ship();v.status='orbit';v.routeAlong=.98;
 v.selectNavigationTarget({id:'planet',name:'planet',position:[0,0,12000]});
 v.tick(.1);assert.equal(v.canDirectEntry,true);assert.equal(v.enterAtmosphere().ok,true);
});
test('manual autopilot OFF does not run the selected-target guidance',()=>{
 const v=ship();v.selectNavigationTarget({id:'ore',name:'ore',position:[1200,0,0]});v.setAutopilot(false);v.setThrottle(0);
 v.tick(.1);assert.equal(v.crossTrack,0);assert.equal(v.attitudeYawDeg,0);
});
