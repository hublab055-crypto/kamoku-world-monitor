import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {joystickMovement} from "../planet-explorer/stick-input.mjs";
import {BattleTest,TEST_ENEMIES} from "../planet-explorer/battle-test.mjs";
import {HUMANOID_MONSTERS,enemyMotion} from "../planet-explorer/enemy-motion.mjs";
import {articulatedMonsterGeometry} from "../planet-explorer/render.mjs";

const player=()=>({x:0,z:0,yaw:0,altitudeM:3,jumpY:0});
test("touch joystick swaps only left/right while retaining forward/back axes",()=>{
 assert.deepEqual(joystickMovement({x:1,y:0}),{forward:0,strafe:-1});
 assert.deepEqual(joystickMovement({x:-1,y:0}),{forward:0,strafe:1});
 assert.deepEqual(joystickMovement({x:0,y:-1}),{forward:1,strafe:0});
 assert.deepEqual(joystickMovement({x:0,y:1}),{forward:-1,strafe:0});
 assert.deepEqual(joystickMovement({x:0,y:0}),{forward:0,strafe:0});
 const app=readFileSync(new URL("../planet-explorer/app.mjs",import.meta.url),"utf8");
 assert.match(app,/joystickMovement\(stick\)/);
 assert.match(app,/const axes=controlMode==="stick"/);
});
test("six humanoid types produce complete keyed mesh rigs",()=>{
 for(const kind of HUMANOID_MONSTERS){
  assert.ok(TEST_ENEMIES[kind],kind);
  const pieces=articulatedMonsterGeometry(kind);
  assert.deepEqual(Object.keys(pieces),[
   "torso","head","leftUpper","leftLower","rightUpper","rightLower",
   "leftThigh","leftShin","rightThigh","rightShin","weapon","shield"
  ]);
  for(const [part,mesh] of Object.entries(pieces)){
   assert.ok(mesh.positions.length>0,kind+" "+part);
   assert.equal(mesh.positions.length,mesh.normals.length);
   assert.equal(mesh.positions.length,mesh.colors.length);
   assert.equal(mesh.indices.length%3,0);
   assert.ok(mesh.indices.every(i=>Number.isInteger(i)&&i>=0&&i<mesh.positions.length/3));
   assert.ok(mesh.positions.every(Number.isFinite));
  }
 }
});
test("walking alternates arms and legs, attack winds weapon overhead then strikes",()=>{
 const enemy={type:"skeleton",hp:50,anim:"walk",walkPhase:Math.PI/2,animTime:.2};
 const walk=enemyMotion(enemy);
 assert.ok(walk.leftLegX>.45&&walk.rightLegX<-.45);
 assert.ok(walk.rightArmX>walk.leftArmX);
 enemy.anim="attack";enemy.animTime=.29;
 const high=enemyMotion(enemy);
 enemy.animTime=.60;
 const impact=enemyMotion(enemy);
 assert.ok(high.rightArmX<-1.5);
 assert.ok(impact.rightArmX>high.rightArmX+1.5);
});
test("guard braces shield, hit jerks torso, death tips entire body",()=>{
 const enemy={type:"orc",hp:70,anim:"guard",animTime:.25,walkPhase:0};
 const guard=enemyMotion(enemy);
 assert.ok(guard.leftArmX<-1.0&&guard.bodyX<-.1);
 enemy.anim="hit";enemy.animTime=.16;
 const hit=enemyMotion(enemy);
 assert.ok(hit.bodyX<-.3&&hit.rightArmZ>.25);
 enemy.anim="death";enemy.hp=0;enemy.deathTime=.95;
 const corpse=enemyMotion(enemy);
 assert.ok(corpse.rootFall>1.4);
 assert.ok(Object.values(corpse).every(v=>typeof v==="string"||Number.isFinite(v)));
});
test("enemy enters attack and damages only isolated test health once",()=>{
 const b=new BattleTest(),hero=player(),mob=b.spawn(hero,"orc").enemy;
 mob.x=0;mob.z=2.1;mob.attackCooldown=0;
 b.advance(.05,hero);
 assert.equal(mob.anim,"attack");
 for(let i=0;i<5;i++)b.advance(.1,hero);
 assert.equal(b.playerHp,88);
 assert.equal(b.consumeEnemyHits().length,1);
 for(let i=0;i<4;i++)b.advance(.1,hero);
 assert.equal(b.playerHp,88);
 assert.equal(hero.hp,undefined);
 assert.equal(b.consumeEnemyHits().length,0);
 b.clear();
 assert.equal(b.playerHp,100);
 assert.equal(b.count(),0);
});
test("guard reduces damage; hit interrupts enemy attack; death persists in animation",()=>{
 const b=new BattleTest(),hero=player(),mob=b.spawn(hero,"skeleton").enemy;
 mob.x=0;mob.z=2;
 const swing={kind:"sword",time:.1,duration:.58};
 b.advance(.05,hero,swing);
 assert.equal(mob.anim,"guard");
 const hit=b.damage(mob,20);
 assert.equal(hit.guarded,true);
 assert.equal(hit.damage,9);
 assert.equal(mob.hp,41);
 assert.equal(mob.anim,"hit");
 b.advance(.1,hero);
 assert.equal(mob.anim,"hit");
 const defeat=b.damage(mob,50);
 assert.equal(defeat.defeated,true);
 assert.equal(mob.anim,"death");
 b.advance(.2,hero);
 assert.ok(mob.deathTime>0);
 assert.ok(enemyMotion(mob).rootFall>0);
 assert.equal(b.count(),0);
});
test("battle test HUD/controls and version marker are wired",()=>{
 const page=readFileSync(new URL("../planet-explorer/index.html",import.meta.url),"utf8");
 assert.match(page,/V0\.7p/);
 assert.match(page,/app\.mjs\?v=0\.7p/);
 assert.match(page,/id="spawn-enemy"/);
 const app=readFileSync(new URL("../planet-explorer/app.mjs",import.meta.url),"utf8");
 assert.match(app,/battle\.advance\(dt,controller,attackInProgress\)/);
 assert.match(app,/battle\.consumeEnemyHits\(\)/);
 assert.match(app,/battle\?\.playerHp/);
});
