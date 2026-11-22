import test from 'node:test';
import assert from 'node:assert/strict';
import {ShipJourney} from '../planet-explorer/ship-journey.mjs';
import {SpaceVoyage} from '../planet-explorer/space-voyage.mjs';
import {prepareShipArrivalTerrain} from '../planet-explorer/ship-arrival-terrain.mjs';
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

test('a grazing pass through the approach sphere is captured even with an enemy selected',()=>{
 const v=ship();
 v.selectNavigationTarget({id:'pirate-alpha',position:[300,0,12000]});
 v.routeAlong=1.01;v.crossTrack=.029;
 assert.equal(v.canDirectEntry,false);
 assert.equal(v.capturePlanetApproach([.029,0,-.01]),true);
 assert.equal(v.navigationTarget,null);
 assert.equal(v.canDirectEntry,true);
 assert.equal(v.enterAtmosphere().ok,true);
});

test('legacy orbital departure and cruise saves resume with working brakes and atmospheric entry',()=>{
 for(const status of ['preflight','cruise','orbit']){
  const old=new SpaceVoyage({originId:'terra',destinationId:'cinder',status,
   transferZ:status==='preflight'?0:.97,transferVZ:.01,interior:{schemaVersion:1,mode:'cockpit'}});
  const v=ShipJourney.fromSnapshot(old.snapshot());
  assert.equal(v.seated,true);
  assert.equal(v.routeAlong,old.transferZ);
  if(status==='preflight')assert.equal(v.startTransfer().ok,true);
  if(status==='cruise'){
   v.setThrottle(-1);
   v.tick(.08);
   assert.equal(v.throttle,-1);
   assert.ok(v.routeVelocity.along<old.transferVZ);
  }
  v.setThrottle(.72);
  v.setAutopilot(true);
  for(let i=0;i<2500&&!v.canDirectEntry;i++){
   const previous=v.planetOffset;
   v.tick(.08);
   v.capturePlanetApproach(previous);
  }
  assert.equal(v.canDirectEntry,true);
  const arrival=prepareShipArrivalTerrain({destinationId:v.destinationId});
  assert.equal(v.setLandingSite(arrival.site),true);
  assert.equal(v.enterAtmosphere().ok,true);
  for(let i=0;i<300&&v.status==='entry';i++)v.tick(.08);
  assert.equal(v.status,'atmosphere');
  assert.ok(v.airAltitude>0);
 }
});

test('a selected star requires warp, can pause and resume, and arrives outside atmospheric entry',()=>{
 const v=ship();
 assert.equal(v.chooseDestination('aster-vale',30,{fromStar:true}).ok,true);
 assert.equal(v.startTransfer().ok,false);
 assert.equal(v.setWarp(true).ok,true);
 for(let i=0;i<20;i++)v.tick(.1);
 assert.ok(v.warpSpeed>0);
 v.setThrottle(0);
 for(let i=0;i<10;i++)v.tick(.1);
 const progress=v.warpProgress;
 assert.equal(v.inWarp,false);
 assert.equal(v.canDirectEntry,false);
 v.tick(.1);assert.equal(v.warpProgress,progress);
 const resumed=ShipJourney.fromSnapshot(v.snapshot());
 assert.equal(resumed.setWarp(true).ok,true);
 for(let i=0;i<100&&resumed.inWarp;i++)resumed.tick(.1);
 assert.equal(resumed.warpArrived,true);
 assert.equal(resumed.status,'orbit');
 assert.equal(resumed.inWarp,false);
 assert.equal(resumed.canDirectEntry,false);
 assert.equal(resumed.enterAtmosphere().ok,true);
 const preview=prepareShipArrivalTerrain({destinationId:resumed.destinationId});
 assert.equal(resumed.setLandingSite(preview.site),true);
});

test('an arrived pilot can pick another system without landing first',()=>{
 const v=new ShipJourney({originId:'terra',destinationId:'lyra-haven',status:'orbit',warpArrived:true,seated:true});
 assert.equal(v.chooseDestination('terra',30,{fromStar:true}).ok,true);
 assert.equal(v.originId,'lyra-haven');
 assert.equal(v.warpProgress,0);
 assert.equal(v.warpArrived,false);
});
