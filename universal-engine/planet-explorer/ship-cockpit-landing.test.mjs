import {test} from "node:test";
import assert from "node:assert/strict";
import {ShipJourney} from "./ship-journey.mjs";
import {groundScenePhase} from "./ship-shared-scene.mjs";

const landingSite=Object.freeze({
 bodyId:"cinder",lat:22.4,lon:18.5,yaw:.5,padElevationM:317.24
});
test("cockpit sees target terrain and touchdown before entering the destination world",()=>{
 const voyage=new ShipJourney({
  originId:"terra",destinationId:"cinder",status:"orbit",
  seated:true,hatchOpen:false,
  interior:{schemaVersion:1,x:0,z:-10.1}
 });
 assert.equal(voyage.setLandingSite(landingSite),true);
 assert.equal(voyage.enterAtmosphere().ok,true);
 assert.equal(voyage.status,"entry");
 const first=groundScenePhase(voyage);
 assert.equal(first.showGlobe,true);
 assert.equal(first.showGround,false);
 let frames=0,firstGround=null;
 while(voyage.status==="entry"&&frames++<180){
  voyage.tick(.12);
  const phase=groundScenePhase(voyage);
  if(phase.showGround&&firstGround===null)firstGround=frames;
 }
 assert.equal(voyage.status,"touchdown");
 assert.ok(firstGround>0,"actual terrain appears before contact");
 assert.equal(groundScenePhase(voyage).lift,0);
 assert.equal(groundScenePhase(voyage).showGround,true);
 assert.equal(groundScenePhase(voyage).showGlobe,false);
 assert.equal(voyage.landingSite.lat,landingSite.lat);
 const restored=ShipJourney.fromSnapshot(voyage.snapshot());
 assert.equal(restored.status,"touchdown");
 assert.deepEqual(restored.landingSite,landingSite);
 for(let i=0;i<25&&restored.status!=="landed";i++)restored.tick(.12);
 assert.equal(restored.status,"landed");
 assert.equal(restored.landingSite.padElevationM,landingSite.padElevationM);
 assert.equal(restored.seated,true,"pilot must still stand up manually");
});
test("wrong-body landing pads or unsafe orbital phases cannot update touchdown location",()=>{
 const voyage=new ShipJourney({originId:"terra",destinationId:"cinder",status:"cruise",seated:true});
 assert.equal(voyage.setLandingSite(landingSite),false);
 voyage.status="orbit";
 assert.equal(voyage.setLandingSite({...landingSite,bodyId:"nix"}),false);
 assert.equal(voyage.setLandingSite({...landingSite,lat:NaN}),false);
 assert.equal(voyage.setLandingSite(landingSite),true);
 assert.deepEqual(voyage.landingSite,landingSite);
});
test("atmospheric ground rises continuously in ship-local camera frame",()=>{
 const v={status:"entry",stageProgress:0};
 let previous=Infinity;
 for(let i=0;i<=100;i++){
  v.stageProgress=i/100;
  const phase=groundScenePhase(v);
  assert.ok(phase.lift<=previous+1e-8);
  previous=phase.lift;
 }
 assert.equal(previous,0);
 assert.equal(groundScenePhase({status:"touchdown"}).sky,1);
});
