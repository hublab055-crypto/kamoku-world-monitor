import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {spawnSync} from "node:child_process";
import {SWIM_STYLES,DIVE_GEAR,SEA_SITE_TYPES,oceanFloorDepth,
 seabedPatch,seaSitesNear} from "../planet-explorer/ocean-exploration.mjs";
import {swimStroke,swimmingPresentation} from "../planet-explorer/swim-motion.mjs";
import {MarineWorld} from "../planet-explorer/marine.mjs";
import {submergedSiteGeometry,divingEquipmentGeometry,deepWaterFishGeometry} from "../planet-explorer/render.mjs";
const terrain={planet:{radiusM:6371000,seed:77},
 sample:()=>({water:true,river:false,category:"ocean",elevationM:-100})};
const player=()=>({lat:2,lon:3,x:0,z:0,nearGround:true,travelMode:"swim",moving:true});
test("four swim styles alter speed and limb strokes, including symmetric breaststroke",()=>{
 assert.deepEqual(Object.keys(SWIM_STYLES),["crawl","breast","back","tread"]);
 assert.equal(SWIM_STYLES.tread.speed,0);
 const c=swimStroke("crawl",.4),b=swimStroke("breast",.4),back=swimStroke("back",.4);
 assert.notEqual(c.leftShoulderX,b.leftShoulderX);
 assert.equal(b.leftShoulderX,b.rightShoulderX);
 assert.notEqual(back.leftShoulderX,back.rightShoulderX);
 assert.equal(swimmingPresentation("swim",true,0,0,2,"back").pitch<0,true);
 assert.equal(swimmingPresentation("swim",true,0,0,2,"breast").action,"breast");
 assert.equal(swimmingPresentation("swim",true,0,0,2,"tread").action,"tread");
});
test("scuba and hard diving suit must be crafted before equipping, costs are paid once",()=>{
 const m=new MarineWorld(),ctrl=player(),r={metal:40,fiber:45,plank:10,wood:5};
 assert.equal(m.equipGear("scuba",ctrl).ok,false);
 assert.equal(m.craftGear("scuba",r).ok,true);
 assert.equal(r.metal,32);assert.equal(r.fiber,35);
 assert.equal(m.craftGear("scuba",r).ok,false);
 assert.equal(m.equipGear("scuba",ctrl).ok,true);
 assert.equal(m.oxygen,DIVE_GEAR.scuba.air);
 assert.equal(m.craftGear("suit",r).ok,true);
 assert.equal(m.equipGear("suit",ctrl).ok,true);
 assert.equal(m.gear.maxDepth,85);
 const saved=m.snapshot(),restored=new MarineWorld(saved);
 assert.equal(restored.diveGear,"suit");
 assert.deepEqual(restored.ownedGear,m.ownedGear);
});
test("dive gear increases underwater endurance and controls desired depth",()=>{
 const ctrl=player(),m=new MarineWorld();
 assert.equal(m.dive(ctrl,terrain).ok,true);
 m.update(2,ctrl,terrain);
 assert.equal(ctrl.travelMode,"dive");
 assert.ok(m.depthM>0&&m.depthM<=4);
 assert.equal(m.adjustDepth(50,ctrl,terrain).ok,true);
 assert.ok(m.targetDepthM<=12);
 const previous=m.oxygen;m.update(1,ctrl,terrain);
 assert.ok(m.oxygen<previous);
 assert.equal(m.equipGear("scuba",ctrl).ok,false,"cannot change gear underwater");
 assert.equal(m.dive(ctrl,terrain).ok,true);
 assert.equal(m.depthM,0);
});
test("seabed geometry and sites are deterministic and on a real ocean point",()=>{
 const p=seabedPatch(terrain,{lat:2,lon:3},0,0,{cells:6,radius:85});
 assert.ok(p.indices.length>0);assert.ok(p.positions.some(v=>v<0));
 const floor=oceanFloorDepth(terrain,2,3);
 assert.ok(floor>8&&floor<75);
 const a=seaSitesNear(terrain,2,3,420),b=seaSitesNear(terrain,2,3,420);
 assert.deepEqual(a,b);
 assert.ok(a.length>0);assert.ok(a.every(s=>SEA_SITE_TYPES[s.kind]&&s.depthM>0));
 for(const name of Object.keys(SEA_SITE_TYPES)){
  const g=submergedSiteGeometry(name);
  assert.ok(g.positions.length>0, name);
 }
});
test("sunken discovery requires proximity/depth, awards materials once, persists forever",()=>{
 const m=new MarineWorld(),resources={wood:0,stone:0,metal:0};
 const initial=seaSitesNear(terrain,2,3,420)[0];
 assert.ok(initial);
 const c=player();c.lat=initial.lat;c.lon=initial.lon;m.diving=true;m.depthM=initial.depthM;
 const found=m.scan(c,terrain);
 assert.equal(found.ok,true);
 const result=m.salvage(c,terrain,resources);
 assert.equal(result.ok,true,result.message);
 assert.equal(m.salvage(c,terrain,resources).ok,false);
 const restored=new MarineWorld(m.snapshot());
 assert.ok(restored.salvagedSites.has(result.site.id));
 assert.ok(restored.scannedSites.has(result.site.id));
});
test("diving equipment, deep-sea fish and undersea exploration controls are present",()=>{
 for(const kind of ["snorkel","scuba","suit"]){
  const g=divingEquipmentGeometry(kind);assert.ok(g.positions.length>0);
 }
 assert.ok(deepWaterFishGeometry().positions.length>0);
 const html=readFileSync(new URL("../planet-explorer/index.html",import.meta.url),"utf8");
 const js=readFileSync(new URL("../planet-explorer/app.mjs",import.meta.url),"utf8");
 for(const id of ["marine-swim-style","marine-gear-equip","marine-equip","marine-gear-craft",
   "marine-descend","marine-ascend","marine-scan","marine-salvage"]){
  assert.ok(html.includes('id="'+id+'"'),id);
  assert.ok(js.includes('"'+id+'"'),id);
 }
});

test("full game entry modules parse without JavaScript syntax errors",()=>{
 for(const file of ["app.mjs","marine.mjs","render.mjs","swim-motion.mjs","ocean-exploration.mjs",
  "animator.mjs","frontier-animated.mjs","frontier-skinned-renderer.mjs"]){
  const uri=new URL("../planet-explorer/"+file,import.meta.url);
  const result=spawnSync(process.execPath,["--check",uri.pathname],{encoding:"utf8"});
  assert.equal(result.status,0,file+": "+result.stderr);
 }
});
test("ocean site cache avoids repeated global geology sampling during rendering",()=>{
 const m=new MarineWorld(),ctrl=player();let sampled=0;
 const counting={planet:terrain.planet,sample:(...args)=>{sampled++;return terrain.sample(...args);}};
 const first=m.sitesNear(ctrl,counting,140);
 const n=sampled;assert.ok(n>0);
 const second=m.sitesNear(ctrl,counting,140);
 assert.deepEqual(first,second);
 assert.ok(sampled-n<=2,"the cache must avoid rescanning site cells on every render frame");
});
