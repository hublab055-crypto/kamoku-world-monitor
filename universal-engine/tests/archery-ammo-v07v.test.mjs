import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {SocialEquipment} from "../planet-explorer/social-equipment.mjs";
import {ArrowProjectiles} from "../planet-explorer/arrow-projectiles.mjs";
import {bowTimedProgress,applyBowHold,taskBowProgress} from "../planet-explorer/archery-timing.mjs";

test("legacy saved quiver stays wood; new iron and fire stocks start empty",()=>{
 const legacy={version:1,actors:{player:{arrows:7,hands:{right:"bow",left:"none"}}}};
 const ammo=new SocialEquipment(legacy);
 assert.equal(ammo.arrowCount("player","wood"),7);
 assert.equal(ammo.arrowCount("player","iron"),0);
 assert.equal(ammo.arrowCount("player","fire"),0);
 assert.equal(ammo.actor("player").arrowType,"wood");
});
test("each avatar can independently craft use recover and save typed arrows",()=>{
 const model=new SocialEquipment();
 const stock={wood:12,stone:5,metal:5,fiber:5};
 assert.ok(model.craftTypedArrows("scout","iron",stock).ok);
 assert.ok(model.craftTypedArrows("artisan","fire",stock).ok);
 assert.equal(stock.wood,10);assert.equal(stock.metal,3);assert.equal(stock.fiber,3);
 model.setArrowType("scout","iron");
 const result=model.useItem({id:"scout"},"bow");
 assert.equal(result.arrowType,"iron");
 assert.ok(model.spendArrow("scout","iron"));
 assert.equal(model.arrowCount("scout","iron"),2);
 assert.equal(model.arrowCount("artisan","fire"),3);
 assert.ok(model.recoverArrow("scout","iron"));
 assert.equal(new SocialEquipment(model.snapshot()).arrowCount("scout","iron"),3);
 assert.equal(model.arrowCount("scout","wood"),12);
});
test("cannot craft when ingredients are missing or overflow special arrow quiver",()=>{
 const model=new SocialEquipment(),stock={wood:20,metal:0,fiber:0,stone:0};
 assert.equal(model.craftTypedArrows("player","iron",stock).ok,false);
 assert.deepEqual(stock,{wood:20,metal:0,fiber:0,stone:0});
 model.actor("scout").specialArrows.fire=998;
 assert.equal(model.craftTypedArrows("scout","fire",{wood:10,fiber:10}).ok,false);
 assert.equal(model.recoverArrow("scout","fire"),true);
 assert.equal(model.recoverArrow("scout","fire"),false);
});
test("the last arrow is spent once, and reusing depleted ammo is rejected",()=>{
 const model=new SocialEquipment();
 model.actor("scout").arrows=1;
 model.setArrowType("scout","wood");
 assert.equal(model.useItem({id:"scout"},"bow").ok,true);
 assert.equal(model.spendArrow("scout"),true);
 assert.equal(model.spendArrow("scout"),false);
 assert.equal(model.useItem({id:"scout"},"bow").ok,false);
});
test("ripple timing holds 78% bow pose then releases once in order",()=>{
 const base=1.62;
 const delays=[0,.22,.44].map(delay=>{
  const task={kind:"equipped_bow",remaining:base,duration:base,impacted:false};
  assert.equal(applyBowHold(task,delay),true);
  return task;
 });
 const progress=(task,time)=>{task.remaining=Math.max(0,task.duration-time);return taskBowProgress(task);};
 assert.ok(progress(delays[0],base*.81)>=.81);
 assert.ok(progress(delays[1],base*.81)<.81);
 assert.ok(progress(delays[2],base*.81)<.81);
 assert.equal(bowTimedProgress(base*.78+.3,base,.44),.78);
 assert.ok(progress(delays[1],base*.81+.22)>=.81);
 assert.ok(progress(delays[2],base*.81+.44)>=.81);
});
function fireAndWait(type){
 const engine=new ArrowProjectiles();
 const enemy={id:17,x:0,z:9,radius:.75,height:2,hp:150};
 let hits=[];
 const source=engine.launch({shooterId:"scout",arrowType:type,actor:{x:0,z:0,yaw:0},
  target:{x:0,y:1.5,z:9},mode:"direct"});
 assert.equal(source.arrowType,type);
 const onEnemyHit=(mob,damage)=>{mob.hp-=damage;return {damage}};
 for(let i=0;i<250&&engine.flying.length;i++)
  hits.push(...engine.advance(.02,{groundHeight:()=>0,enemies:[enemy],onEnemyHit}));
 for(let i=0;i<160;i++)
  hits.push(...engine.advance(.02,{groundHeight:()=>0,enemies:[enemy],onEnemyHit}));
 return {engine,enemy,hits};
}
test("wood and iron impact for their own damage; fire applies three burn ticks",()=>{
 const wood=fireAndWait("wood"),iron=fireAndWait("iron"),fire=fireAndWait("fire");
 assert.equal(wood.enemy.hp,128);
 assert.equal(iron.enemy.hp,117);
 assert.equal(fire.enemy.hp,150-17-3*4);
 assert.equal(fire.hits.filter(e=>e.surface==="burn").length,3);
 assert.equal(fire.engine.burning.length,0);
});
test("recoverable iron and fire shafts retain type across projectile save",()=>{
 const fire=fireAndWait("fire");
 const arrowId=fire.engine.embedded[0].id;
 const saved=new ArrowProjectiles(fire.engine.snapshot());
 assert.equal(saved.recover(arrowId)?.arrowType,"fire");
 assert.equal(saved.recover(arrowId),null);
});
test("volley controls, typed physics integration and render assets are present",()=>{
 const src=n=>readFileSync(new URL("../planet-explorer/"+n,import.meta.url),"utf8");
 const ui=src("frontier-interaction-ui.mjs"),app=src("app.mjs"),render=src("render.mjs"),html=src("index.html");
 for(const name of ["archery-ammo","volley-aim","volley-timing","arrow-craft-type"])
  assert.match(html,new RegExp('id="'+name+'"'));
 for(const pattern of [/function volley\(/,/function nearestEnemy\(/,
  /applyBowHold\(task,shotOptions\.holdDelay\)/,/social\.spendArrow\(who\.id,result\.arrowType\)/,
  /social\.craftTypedArrows\(/])assert.match(ui,pattern);
 assert.match(app,/arrowType:plan\.arrowType/);
 assert.match(app,/addRecoveredArrow\(who\.id,embedded\?\.arrowType/);
 assert.match(render,/this\.typedArrows\[shot\.arrowType\]/);
});
