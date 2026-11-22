import test from "node:test";
import assert from "node:assert/strict";
import {BattleTest,TEST_ENEMIES} from "../planet-explorer/battle-test.mjs";
import {projectileTransform} from "../planet-explorer/render.mjs";
import {samplePose,point,translate,rotY,matrixMultiply} from "../planet-explorer/rig.mjs";
import {Actions} from "../planet-explorer/actions.mjs";
const player=(yaw=0)=>({x:0,z:0,yaw,altitudeM:3,jumpY:0});
const near=(a,b)=>Math.abs(a-b)<1e-8;
test("arrows always point at actor facing rather than raised wrist",()=>{
 for(const yaw of [0,Math.PI/2,Math.PI,-Math.PI/2]){
  const facing=matrixMultiply(translate(12,0,7),rotY(yaw));
  for(const hand of ["left","right"])for(const t of [.25,.67,.84,.98]){
   const model=projectileTransform(facing,t,hand);
   const at=point(model,[0,0,0]),tip=point(model,[0,0,1]);
   assert.ok(near(tip[0]-at[0],Math.sin(yaw)),"arrow world x");
   assert.ok(near(tip[1]-at[1],0),"arrow is horizontal");
   assert.ok(near(tip[2]-at[2],Math.cos(yaw)),"arrow world z");
  }
 }
});
test("wide sword and axe sweeps use visibly larger shoulder and torso arcs",()=>{
 for(const weapon of ["sword","axe"]){
  const windup=samplePose({action:weapon,variant:"sweep",progress:.24});
  const impact=samplePose({action:weapon,variant:"sweep",progress:.62});
  assert.ok(windup.torsoY<-.75);
  assert.ok(impact.torsoY>.75);
  assert.ok(windup.rightShoulderZ>.85);
  assert.ok(impact.rightShoulderZ<-.72);
  assert.ok(impact.rightWristX>.20);
 }
});
test("enemy button domain can spawn all seven types in front and cap population",()=>{
 const battle=new BattleTest(),user=player();
 for(const kind of Object.keys(TEST_ENEMIES)){
  const result=battle.spawn(user,kind);
  assert.equal(result.ok,true);
  assert.equal(result.enemy.type,kind);
  assert.ok(result.enemy.z>0);
  assert.ok(result.enemy.hp>0);
 }
 assert.equal(battle.count(),Object.keys(TEST_ENEMIES).length);
 for(let i=Object.keys(TEST_ENEMIES).length;i<10;i++)assert.equal(battle.spawn(user,"slime").ok,true);
 assert.equal(battle.spawn(user,"slime").ok,false);
 assert.equal(battle.spawn(user,"unknown").ok,false);
 battle.clear();assert.equal(battle.count(),0);
 assert.equal(battle.spawn({...user,altitudeM:100},"slime").ok,false);
});
test("test targets slowly pursue without changing player health",()=>{
 const b=new BattleTest(),p=player();
 const enemy=b.spawn(p,"goblin").enemy;
 const first=Math.hypot(enemy.x,enemy.z);
 for(let i=0;i<150;i++)b.advance(1/60,p);
 assert.ok(Math.hypot(enemy.x,enemy.z)<first);
 assert.ok(Math.hypot(enemy.x,enemy.z)>2.4);
 assert.equal(p.hp,undefined);
});
test("sword and axe hit only when within forward arc",()=>{
 const b=new BattleTest(),p=player();
 const front=b.spawn(p,"slime").enemy;front.x=0;front.z=2;
 const behind=b.spawn(p,"goblin").enemy;behind.x=0;behind.z=-2;
 const side=b.spawn(p,"bandit").enemy;side.x=2;side.z=1;
 const hits=b.hitArc(p,{range:2.6,arc:Math.PI*.9,damage:18});
 assert.ok(hits.some(h=>h.id===front.id));
 assert.ok(hits.some(h=>h.id===side.id));
 assert.ok(!hits.some(h=>h.id===behind.id));
 assert.equal(front.hp,12);
});
test("a swing or arrow release inflicts a single hit, not damage every frame",()=>{
 const p=player(),b=new BattleTest();
 const e=b.spawn(p,"slime").enemy;e.x=0;e.z=2.4;
 const sword={kind:"sword",variant:"sweep",time:.37,duration:.58};
 assert.equal(b.resolveAttack(sword,p).length,1);
 assert.equal(b.resolveAttack(sword,p).length,0);
 assert.equal(e.hp,12);
 const archery=new BattleTest(),far=archery.spawn(p,"bandit").enemy;
 far.x=0;far.z=8;
 const bow={kind:"bow",time:1.35,duration:1.62,variant:"overhead"};
 assert.equal(archery.resolveAttack(bow,p).length,1);
 assert.equal(archery.resolveAttack(bow,p).length,0);
 assert.equal(far.hp,TEST_ENEMIES.bandit.hp-22);
});
test("sword three-hit combo uses separate strike stages and defeat stops further hits",()=>{
 const b=new BattleTest(),p=player();
 const enemy=b.spawn(p,"slime").enemy;enemy.x=0;enemy.z=2;
 const combo={kind:"sword",variant:"combo",time:.35,duration:1.42};
 assert.equal(b.resolveAttack(combo,p).length,1);
 combo.time=.82;
 assert.equal(b.resolveAttack(combo,p).length,1);
 assert.equal(enemy.hp,0);
 combo.time=1.42;
 assert.equal(b.resolveAttack(combo,p).length,0);
});
test("action completion remains backward compatible with old battle-free saves",()=>{
 const a=new Actions(),p=player();
 assert.equal(a.start("axe",p,null,"sweep"),true);
 const saved=a.snapshot();
 const restored=Actions.fromSnapshot(saved);
 assert.equal(restored.getAnimation().variant,"sweep");
});
