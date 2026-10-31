import {test} from "node:test";
import assert from "node:assert/strict";
import {SurfaceStarship} from "./surface-starship.mjs";
import {evaluateStarshipPad,findStarshipPad,starshipDescentHeight} from "./surface-starship-landing.mjs";

test("ship descends and becomes interactable only after touching ground",()=>{
 const pad={lat:28,lon:42,yaw:.3,padElevationM:215};
 const s=new SurfaceStarship();
 s.beginLanding("terra",pad);
 assert.equal(s.visible("terra"),true);
 assert.equal(s.present("terra"),false);
 assert.equal(s.flight,"landing");
 assert.equal(s.padElevationM,215);
 let frames=0;
 while(s.flight==="landing"&&frames++<100)s.tick(.12);
 assert.equal(s.present("terra"),true);
 assert.equal(s.landingProgress,1);
 assert.ok(frames<=45);
 assert.equal(starshipDescentHeight(0),85);
 assert.equal(starshipDescentHeight(1),0);
 assert.ok(starshipDescentHeight(.2)>starshipDescentHeight(.8));
 assert.deepEqual(SurfaceStarship.fromSnapshot(s.snapshot()).snapshot(),s.snapshot());
});
test("one craft never remains visible on two planets",()=>{
 const s=new SurfaceStarship();
 s.landedOn("terra",28,42,0,400);
 assert.equal(s.present("terra"),true);
 s.takeOff();
 assert.equal(s.visible("terra"),false);
 s.landedOn("cinder",16,11,0,180);
 assert.equal(s.present("cinder"),true);
 assert.equal(s.visible("terra"),false);
});
test("water or too-high terrain cannot receive the landing gear",()=>{
 const terrain={
  planet:{id:"terra",radiusM:6371000,seed:77},
  sample:()=>({water:true,river:false,lake:false,category:"ocean",elevationM:0})
 };
 assert.equal(evaluateStarshipPad(terrain,28,42),null);
 assert.equal(findStarshipPad(terrain,{lat:28,lon:42}),null);
});
test("invalid terrain samples and invalid coordinates reject landing",()=>{
 const bad={planet:{id:"terra",radiusM:6371000,seed:77},
  sample:()=>({water:false,river:false,lake:false,category:"mountain",elevationM:3500})};
 assert.equal(evaluateStarshipPad(bad,28,42),null);
 assert.equal(findStarshipPad(bad,{lat:28,lon:42}),null);
 assert.equal(findStarshipPad(bad,{lat:NaN,lon:42}),null);
});
