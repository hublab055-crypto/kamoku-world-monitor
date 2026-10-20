import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {spawnSync} from "node:child_process";
import {SocialEquipment,ITEM_MAP} from "../planet-explorer/social-equipment.mjs";
import {MarineWorld} from "../planet-explorer/marine.mjs";
import {mapToWorld,worldToMap,routePreview} from "../planet-explorer/map-navigation.mjs";
import {isAquaticAction,swimStroke} from "../planet-explorer/swim-motion.mjs";
import {geoOffset} from "../planet-explorer/geo.mjs";
const R=6371000;
const coast={planet:{radiusM:R,seed:77,gravity:9.8},sample(lat,lon){
 const water=lon>0;return {water,river:false,elevationM:water?-50:100,category:water?"ocean":"coast"};
}};
function human(lon=-.00003){
 return {lat:0,lon,origin:{lat:0,lon},x:0,z:0,yaw:0,altitudeM:2.5,
 nearGround:true,travelMode:"walk",boatOceanOnly:false,
 locationAt(x,z){return geoOffset(this.origin.lat,this.origin.lon,x,z,R);},
 clearMoveTarget(){this.moveTarget=null;},
 setMoveTarget(x,z){
  if(Math.hypot(x-this.x,z-this.z)>350)return false;
  this.moveTarget={x,z};return true;
 }};
}
test("a fishing rod is a real permanent equipable item; using either hand returns a fishing action",()=>{
 const inventory=new SocialEquipment(),person={id:"player",name:"開拓者"};
 const life={inventory:{}},frontier={person:()=>({inventory:{},gifts:{}})};
 assert.equal(ITEM_MAP.get("fishingRod").name,"釣竿");
 assert.equal(inventory.quantity(person,"fishingRod",life,frontier),1);
 assert.equal(inventory.equipHand(person,"right","fishingRod",life,frontier).ok,true);
 assert.deepEqual(inventory.useHand(person,"right",life,frontier),
  {ok:true,kind:"fishing",item:"fishingRod"});
 assert.equal(inventory.equipHand(person,"left","fishingRod",life,frontier).ok,true,
 "fishing rod is a non-consumable tool");
 const backup=new SocialEquipment(inventory.snapshot());
 assert.equal(backup.handItem("player","right"),"fishingRod");
});
test("the map translates top-down taps into real world metres and previews safe routes",()=>{
 const p=human(-.001);
 const world=mapToWorld(.8,.25,p,160),uv=worldToMap(world.x,world.z,p,160);
 assert.ok(Math.abs(uv.u-.8)<1e-9&&Math.abs(uv.v-.25)<1e-9);
 const approved=routePreview(p,coast,world.x,world.z);
 assert.equal(approved.ok,true,approved.message);
 const far=routePreview(p,coast,750,0);
 assert.equal(far.ok,false);
 assert.throws(()=>mapToWorld(-.4,0,p,160),RangeError);
 const ship=human(.002);
 ship.travelMode="boat";ship.boatOceanOnly=true;
 assert.equal(routePreview(ship,coast,-500,0).ok,false,"sailing ship cannot enter land");
 assert.equal(routePreview(ship,coast,200,0).ok,true,"boat can pick open water");
});
test("shore double-tap jump enters nearby water, plays animation, preserves dry shore otherwise",()=>{
 const m=new MarineWorld(),c=human(-.00004);
 const sea={x:8,z:0};
 assert.ok(coast.sample(c.locationAt(sea.x,sea.z).lat,c.locationAt(sea.x,sea.z).lon).water);
 const result=m.jumpIntoWater(c,coast,sea);
 assert.equal(result.ok,true,result.message);
 assert.equal(c.travelMode,"swim");
 assert.equal(m.entrySeconds,m.entryDuration);
 assert.equal(m.diving,false);
 assert.equal(m.jumpIntoWater(c,coast,sea).ok,false,"cannot jump again while swimming");
 m.update(.2,c,coast);assert.ok(m.entrySeconds<m.entryDuration);
 assert.equal(isAquaticAction("splash"),true);
 const pose=swimStroke("splash",.2);
 assert.ok(pose.leftShoulderX< -1.5&&pose.rightShoulderX< -1.5);
});
test("jumping overboard leaves ship in its place and lets diver descend",()=>{
 const c=human(.001),m=new MarineWorld();
 const boat={id:"boat-1",kind:"sailing_ship",lat:c.lat,lon:c.lon,yaw:0,sailTrim:0,
  anchor:true,cruise:false};
 m.boats=[boat];m.boardedId=boat.id;c.travelMode="boat";
 const result=m.jumpIntoWater(c,coast,{x:5,z:0});
 assert.equal(result.ok,true,result.message);
 assert.equal(m.boardedId,null);
 assert.equal(m.boats.length,1);
 assert.equal(m.boats[0].id,"boat-1");
 assert.equal(m.dive(c,coast).ok,true,"water entry permits diving");
 m.update(.3,c,coast);
 assert.equal(c.travelMode,"dive");
 assert.ok(m.depthM>0);
});
test("dive controls and sea prompt, map chart, compact reel HUD and equipped rod callback are wired",()=>{
 const base=new URL("../planet-explorer/",import.meta.url);
 const html=readFileSync(new URL("index.html",base),"utf8"),
  app=readFileSync(new URL("app.mjs",base),"utf8"),
  social=readFileSync(new URL("frontier-interaction-ui.mjs",base),"utf8"),
  render=readFileSync(new URL("render.mjs",base),"utf8");
 for(const id of ["water-entry-confirm","water-entry-accept","water-entry-cancel",
  "marine-swim-hud","marine-hud-dive","marine-hud-down","marine-hud-up",
  "marine-hud-surface","fishing-reel-hud","fishing-mini-reel","fishing-hud-stop",
  "viewport-route-map","map-route-panel","route-map-canvas","map-route-go"]){
  assert.ok(html.includes('id="'+id+'"'),id);
  assert.ok(app.includes('"'+id+'"')||id==="route-map-canvas"||id==="map-route-go"||id==="map-route-panel",id);
 }
 assert.match(social,/result\.kind==="fishing"/);
 assert.match(app,/onFish:\(\)=>/);
 assert.match(render,/this\.tools\.fishingRod/);
 assert.match(render,/marinePose=\{action:"splash"/);
});
test("all touched browser module entrypoints pass Node syntax check",()=>{
 for(const file of ["app.mjs","marine.mjs","render.mjs","map-navigation.mjs",
  "map-route-ui.mjs","social-equipment.mjs","frontier-interaction-ui.mjs",
  "swim-motion.mjs","frontier-skinned-renderer.mjs","animator.mjs"]){
  const u=new URL("../planet-explorer/"+file,import.meta.url);
  const result=spawnSync(process.execPath,["--check",u.pathname],{encoding:"utf8"});
  assert.equal(result.status,0,file+": "+result.stderr);
 }
});
