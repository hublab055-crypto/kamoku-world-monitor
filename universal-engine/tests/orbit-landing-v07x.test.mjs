import test from "node:test";
import assert from "node:assert/strict";
import {Planet} from "../planet/planet-core.mjs";
import {Terrain} from "../planet/terrain-engine.mjs";
import {ExplorerController} from "../planet-explorer/controller.mjs";
import {lookAt,multiply4,perspective} from "../planet-explorer/render.mjs";
import {pickOrbitalGeo} from "../planet-explorer/orbit-landing.mjs";
const DEG=Math.PI/180;
const globeVP=(eye=[0,0,1800])=>
 multiply4(perspective(53*DEG,1.6,20,6000),lookAt(eye,[0,0,0],Math.abs(eye[1])>1700?[0,0,1]:[0,1,0]));
test("the middle of the globe picks the front hemisphere, not the back",()=>{
 const point=pickOrbitalGeo(globeVP(),0,0,600);
 assert.ok(point);
 assert.ok(Math.abs(point.lat)<1e-8);
 assert.ok(Math.abs(point.lon-90)<1e-8);
});
test("globe taps off the disk do not produce landing coordinates",()=>{
 assert.equal(pickOrbitalGeo(globeVP(),.99,.99,600),null);
 assert.equal(pickOrbitalGeo(globeVP(),2,0,600),null);
});
test("the visible planet rotation is removed from native longitude",()=>{
 const p=pickOrbitalGeo(globeVP(),0,0,600,42);
 assert.ok(Math.abs(p.lon-48)<1e-8);
});
test("arbitrary selection handles poles and dateline without invalid values",()=>{
 for(const camera of [[0,1800,0],[-1800,0,0],[0,0,-1800],[120,1600,120]]){
  const p=pickOrbitalGeo(globeVP(camera),0,0,600,151);
  assert.ok(p);
  assert.ok(p.lat>=-90&&p.lat<=90);
  assert.ok(p.lon>=-180&&p.lon<180);
 }
});
test("explicit sea selection can rebase the landing origin, walking remains blocked",()=>{
 const planet=new Planet({seed:77});
 const terrain=new Terrain(planet),actor=new ExplorerController(terrain);
 let ocean=null;
 for(let lat=-80;lat<=80&&!ocean;lat+=10)
  for(let lon=-180;lon<180;lon+=10)if(terrain.sample(lat,lon).water){ocean={lat,lon};break;}
 assert.ok(ocean,"planet must have a sea sample");
 assert.throws(()=>actor.setLanding(ocean.lat,ocean.lon),/陸地/);
 actor.setLanding(ocean.lat,ocean.lon,{allowWater:true});
 assert.equal(actor.lat,ocean.lat);assert.equal(actor.lon,ocean.lon);
 assert.equal(actor.x,0);assert.equal(actor.z,0);
 actor.altitudeM=2.5;actor.targetAltitude(2.5);
 actor.update(.05,{forward:1});
 assert.equal(actor.blocked,true);
});
