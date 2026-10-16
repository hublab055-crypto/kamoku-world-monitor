import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {samplePose,jointTransforms,point,matrixMultiply,translate,rotY,rotX} from "../planet-explorer/rig.mjs";
import {uprightBowTransform,humanoidMonsterGeometry,projectileTransform} from "../planet-explorer/render.mjs";
import {BattleTest,TEST_ENEMIES} from "../planet-explorer/battle-test.mjs";
const approx=(a,b,tolerance=1e-7)=>Math.abs(a-b)<tolerance;
const player=()=>({x:0,z:0,yaw:0,altitudeM:3,jumpY:0});
test("held bow stays vertical as a raised wrist pitches, for all heading directions",()=>{
 for(const yaw of [-Math.PI,-Math.PI/2,0,Math.PI/3,Math.PI]){
  const facing=matrixMultiply(translate(10,0,7),rotY(yaw));
  for(const progress of [0,.1,.23,.39,.59,.75,.86,1]){
   const pose=samplePose({action:"bow",progress});
   const wrist=matrixMultiply(translate(10,0,7),jointTransforms(pose,yaw).rightWrist);
   const held=uprightBowTransform(wrist,facing);
   const bottom=point(held,[0,-.5,0]),top=point(held,[0,.5,0]);
   assert.ok(approx(top[0],bottom[0]),"no horizontal stave tilt X");
   assert.ok(approx(top[2],bottom[2]),"no horizontal stave tilt Z");
   assert.ok(approx(top[1]-bottom[1],1),"stave points vertically upwards");
   const hand=point(wrist),grip=point(held);
   assert.ok(Math.hypot(grip[0]-hand[0],grip[2]-hand[2])<.06,"grip remains near wrist");
   assert.ok(approx(grip[1]-hand[1],-.155),"grip retains anatomical vertical offset");
  }
 }
});
test("GLB wrist pitch no longer tips bow; arrow still shoots horizontally forward",()=>{
 const actorFacing=matrixMultiply(translate(1,0,9),rotY(.76));
 const pitchedWrist=matrixMultiply(translate(2,1.45,9.5),rotX(Math.PI*.49));
 const bow=uprightBowTransform(pitchedWrist,actorFacing);
 const up=point(bow,[0,1,0]),origin=point(bow,[0,0,0]);
 assert.ok(approx(up[0],origin[0])&&approx(up[2],origin[2]));
 assert.ok(approx(up[1]-origin[1],1));
 const arrow=projectileTransform(actorFacing,.94);
 const front=point(arrow,[0,0,1]),back=point(arrow,[0,0,0]);
 assert.ok(approx(front[1],back[1]));
 assert.ok(approx(front[0]-back[0],Math.sin(.76)));
 assert.ok(approx(front[2]-back[2],Math.cos(.76)));
});
test("all four new humanoid enemies have distinctive original indexed mesh geometry",()=>{
 const kinds=["skeleton","orc","lizardman","demon"];
 for(const kind of kinds){
  const geometry=humanoidMonsterGeometry(kind);
  const v=geometry.positions.length/3;
  assert.ok(v>100,kind+" should have full 3D parts");
  assert.equal(geometry.normals.length,geometry.positions.length);
  assert.equal(geometry.colors.length,geometry.positions.length);
  assert.equal(geometry.indices.length%3,0);
  assert.ok(geometry.indices.every(i=>Number.isInteger(i)&&i>=0&&i<v));
  const heights=geometry.positions.filter((_,i)=>i%3===1);
  assert.ok(Math.max(...heights)>1.8,kind+" stands upright");
  assert.ok(Math.min(...heights)>=-.01,kind+" is grounded");
 }
 const shapes=kinds.map(k=>humanoidMonsterGeometry(k));
 assert.equal(new Set(shapes.map(g=>g.positions.length)).size,4);
});
test("all seven enemies spawn from battle sandbox with distinct HP, speed and size",()=>{
 const arena=new BattleTest();
 const types=["slime","goblin","bandit","skeleton","orc","lizardman","demon"];
 assert.deepEqual(Object.keys(TEST_ENEMIES),types);
 for(const kind of types){
  const r=arena.spawn(player(),kind);
  assert.equal(r.ok,true);
  assert.equal(r.enemy.type,kind);
  assert.equal(r.enemy.hp,TEST_ENEMIES[kind].hp);
  assert.equal(r.enemy.height,TEST_ENEMIES[kind].height);
  assert.ok(r.enemy.speed>0);
 }
 assert.equal(arena.count(),7);
 for(let i=7;i<10;i++)assert.equal(arena.spawn(player(),"orc").ok,true);
 assert.equal(arena.spawn(player(),"demon").ok,false);
 arena.clear();
 assert.equal(arena.count(),0);
});
test("humanoid adversaries walk towards player, receive strikes and can be defeated",()=>{
 const arena=new BattleTest(),hero=player();
 const enemy=arena.spawn(hero,"skeleton").enemy;
 enemy.x=0;enemy.z=3;
 for(let i=0;i<90;i++)arena.advance(1/60,hero);
 assert.ok(enemy.walkPhase>0);
 const results=arena.hitArc(hero,{range:3.1,arc:Math.PI,damage:60});
 assert.equal(results.length,1);
 assert.equal(enemy.hp,0);
 assert.equal(arena.count(),0);
});
test("enemy selector exposes all four entries in current version",()=>{
 const page=readFileSync(new URL("../planet-explorer/index.html",import.meta.url),"utf8");
 for(const id of ["skeleton","orc","lizardman","demon"])
  assert.match(page,new RegExp('value="'+id+'"'));
 assert.match(page,/V0\.7[opq]/);
 assert.match(page,/app\.mjs\?v=0\.7[opq]/);
});
