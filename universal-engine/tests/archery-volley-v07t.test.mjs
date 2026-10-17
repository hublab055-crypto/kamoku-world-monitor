import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {ArrowProjectiles} from "../planet-explorer/arrow-projectiles.mjs";
import {BattleTest} from "../planet-explorer/battle-test.mjs";
import {SocialEquipment} from "../planet-explorer/social-equipment.mjs";

function shoot(mode,distance,{trees=[],buildings=[],enemies=[]}={}){
 const world=new ArrowProjectiles(),owner={x:0,z:0,yaw:0};
 world.targets.push({id:1,x:0,z:distance,y:0,yaw:Math.PI});
 world.launch({shooterId:"player",actor:owner,groundY:0,
  target:{x:0,y:1.65,z:distance},mode});
 let events=[];
 for(let i=0;i<1000&&world.flying.length;i++)
  events.push(...world.advance(.02,{groundHeight:()=>0,trees,buildings,enemies}));
 return {world,events};
}

test("direct arrows and low-lob shots hit designated practice targets",()=>{
 for(const [mode,distance] of [["direct",9],["direct",40],["lob",40],["auto",85],["lob",100]]){
  const {world,events}=shoot(mode,distance);
  assert.equal(events.length,1,mode+" "+distance);
  assert.equal(events[0].surface,"target",mode+" "+distance);
  assert.equal(world.flying.length,0);
  assert.equal(world.embedded.length,1);
  assert.equal(world.embedded[0].objectId,1);
 }
});
test("gravity affects shot positions and auto selects lob for distant targets",()=>{
 const world=new ArrowProjectiles();
 const shot=world.launch({shooterId:"scout",actor:{x:0,z:0,yaw:0},groundY:50,
  target:{x:0,y:51.6,z:90},mode:"auto"});
 assert.equal(shot.mode,"lob");
 assert.ok(shot.vy>0);
 const y=shot.y;
 world.advance(.1,{groundHeight:()=>50});
 assert.ok(world.flying.length===1&&world.flying[0].y>y);
});
test("tree and building collisions stop arrows before intended target",()=>{
 const tree=shoot("direct",35,{trees:[{id:"tree",kind:"wood",x:0,z:7,elevationM:0}]});
 assert.equal(tree.events[0].surface,"tree");
 assert.ok(tree.events[0].z<10);
 const building=shoot("direct",35,{buildings:[{id:9,x:0,z:10,height:0,progress:1}]});
 assert.equal(building.events[0].surface,"building");
});
test("an arrow hits a real enemy only when its 3D swept path intersects",()=>{
 const battle=new BattleTest();
 const enemy={id:42,x:0,z:10,hp:45,maxHp:45,anim:"idle",animTime:0,radius:.65,height:2.0};
 battle.enemies=[enemy];
 const world=new ArrowProjectiles();
 world.launch({shooterId:"scout",actor:{x:0,z:0,yaw:0},groundY:0,
  target:{x:0,y:1.45,z:10},mode:"direct"});
 let events=[];
 for(let i=0;i<100&&!events.length;i++)events=world.advance(.02,{
  groundHeight:()=>0,enemies:battle.enemies,
  onEnemyHit:(mob,damage)=>battle.damage(mob,damage)
 });
 assert.equal(events.length,1);
 assert.equal(events[0].surface,"enemy");
 assert.equal(events[0].hit.damage,22);
 assert.equal(enemy.hp,23);
 assert.equal(world.embedded.length,1);
});
test("arrows in moving enemies follow until recovered, and cannot be recovered twice",()=>{
 const world=new ArrowProjectiles(),enemy={id:42,x:0,z:9,hp:50,radius:.65,height:2};
 world.launch({shooterId:"artisan",actor:{x:0,z:0,yaw:0},groundY:0,
  target:{x:0,y:1.45,z:9},mode:"direct"});
 for(let i=0;i<60&&world.flying.length;i++)world.advance(.02,{
  groundHeight:()=>0,enemies:[enemy]
 });
 assert.equal(world.embedded[0].surface,"enemy");
 const before=world.embedded[0].z;
 enemy.z+=2;
 world.advance(.016,{groundHeight:()=>0,enemies:[enemy]});
 assert.ok(world.embedded[0].z>before+1.9);
 const arrowId=world.embedded[0].id,loaded=new ArrowProjectiles(world.snapshot());
 assert.ok(loaded.recover(arrowId));
 assert.equal(loaded.recover(arrowId),null);
 assert.equal(loaded.embedded.length,0);
});
test("three simultaneous bows create independent shots and spent ammo is per actor",()=>{
 const arrows=new ArrowProjectiles(),social=new SocialEquipment();
 const shooters=["player","scout","artisan"].map((id,i)=>({id,x:i*1.5,z:0,yaw:0}));
 for(const actor of shooters){
  assert.equal(social.handItem(actor.id,"right"),"sword");
  social.actor(actor.id).hands.right="bow";
  assert.ok(social.spendArrow(actor.id));
  arrows.launch({shooterId:actor.id,actor,groundY:0,mode:"direct"});
 }
 assert.deepEqual(arrows.flying.map(a=>a.shooterId),["player","scout","artisan"]);
 assert.ok(shooters.every(a=>social.actor(a.id).arrows===11));
});
test("browser connects sync volley, trajectory choice, training target and tapping recovery",()=>{
 const read=name=>readFileSync(new URL("../planet-explorer/"+name,import.meta.url),"utf8");
 const ui=read("frontier-interaction-ui.mjs"),app=read("app.mjs"),render=read("render.mjs");
 for(const pattern of [/function volley\(/,/c\.squad\.selectedAgents\(\)/,
  /social\.handItem\(person\.id,h\)==="bow"/,/social\.spendArrow\(who\.id\)/,
  /function addRecoveredArrow\(/,/targetPoint=target\.targetPoint/,
  /"archery-trajectory"/,/practice-target-place/])assert.match(ui,pattern);
 for(const pattern of [/projectiles\.advance\(/,/renderer\.pickArrow\(/,
  /orderArrowPickup\(/,/v0_7t:/,/rts-sync/])assert.match(app,pattern);
 assert.match(render,/drawPhysicalArrows\(/);
 const html=read("index.html");
 for(const id of ["rts-sync","archery-trajectory","practice-target-place"])
  assert.match(html,new RegExp('id="'+id+'"'));
});
