import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {ActionSlots,DECK_KINDS,COMMAND_LABELS} from "../planet-explorer/action-slots.mjs";
import {SocialEquipment} from "../planet-explorer/social-equipment.mjs";
import {BattleTest} from "../planet-explorer/battle-test.mjs";
const player=()=>({id:"player",name:"開拓者",x:0,z:0,yaw:0,altitudeM:3,jumpY:0});
test("five independent decks have correct icons and four commands each",()=>{
 const d=new ActionSlots();
 assert.deepEqual(d.slots.map(s=>DECK_KINDS[s.kind].icon),["⚔️","🏹","🔨","💬","⚙️"]);
 assert.deepEqual(d.current().hands,{right:"sword",left:"shield"});
 assert.deepEqual(d.slots[1].hands,{right:"bow",left:"none"});
 assert.deepEqual(d.slots[3].hands,{right:"none",left:"none"});
 for(const slot of d.slots){
  assert.equal(slot.commands.length,4);
  assert.ok(slot.commands.every(id=>COMMAND_LABELS[id]));
 }
});
test("per-slot hand sets and commands can be changed and saved",()=>{
 const d=new ActionSlots();
 assert.equal(d.configure(0,{hands:{left:"axe"}}),true);
 assert.equal(d.setCommand(0,2,"heal"),true);
 d.autoTarget=false;
 assert.equal(d.select(2),true);
 const restored=new ActionSlots(d.snapshot());
 assert.equal(restored.selected,2);
 assert.equal(restored.autoTarget,false);
 assert.deepEqual(restored.slots[0].hands,{right:"sword",left:"axe"});
 assert.equal(restored.slots[0].commands[2],"heal");
 assert.equal(restored.select(18),false);
 assert.equal(restored.setCommand(2,4,"heal"),false);
});
test("old five-item quick slots migrate without breaking familiar five categories",()=>{
 const old={slots:["sword","axe","pickaxe","cup","book"],selected:0};
 const d=new ActionSlots(null,old);
 assert.deepEqual(d.slots.map(s=>s.kind),["melee","bow","work","social","system"]);
 const unusual=new ActionSlots(null,{slots:["bow","sword","book","cup","axe"],selected:3});
 assert.equal(unusual.selected,3);
 assert.deepEqual(unusual.slots.map(s=>s.kind),["bow","melee","system","social","melee"]);
});
test("manual target wins over auto choice, then falls back on death",()=>{
 const d=new ActionSlots(),p=player();
 const enemies=[
  {id:1,x:0,z:3,radius:.6,hp:30,name:"近い敵"},
  {id:2,x:0,z:7,radius:.7,hp:90,name:"遠い敵"},
  {id:3,x:0,z:-2,radius:.7,hp:90,name:"後方の敵"}
 ];
 assert.equal(d.resolveTarget(enemies,p,18).id,1);
 assert.equal(d.setManualTarget(2),true);
 assert.equal(d.resolveTarget(enemies,p,18).id,2);
 d.autoTarget=false;
 assert.equal(d.resolveTarget(enemies,p,18).id,2);
 enemies[1].hp=0;
 assert.equal(d.resolveTarget(enemies,p,18),null);
 assert.equal(d.manualTargetId,null);
 d.autoTarget=true;
 assert.equal(d.resolveTarget(enemies,p,18).id,1);
 assert.equal(d.setManualTarget(3),true);
 assert.equal(d.resolveTarget(enemies,p,18).id,3,"manual can pick an enemy behind");
 assert.equal(d.select(1),true);
 assert.equal(d.manualTargetId,null,"changing action deck clears manual targeting");
});
test("shield and potions exist, healing consumable survives snapshot",()=>{
 const equipment=new SocialEquipment(),p=player();
 assert.ok(equipment.quantity(p,"shield",null,null)>0);
 assert.equal(equipment.equipHand(p,"left","shield",null,null).ok,true);
 assert.equal(equipment.quantity(p,"potion",null,null),3);
 assert.equal(equipment.useItem(p,"potion",null,null).kind,"heal");
 assert.equal(equipment.quantity(p,"potion",null,null),2);
 const loaded=new SocialEquipment(equipment.snapshot());
 assert.equal(loaded.actor("player").potions,2);
 const legacy=equipment.snapshot();
 delete legacy.actors.player.potions;
 assert.equal(new SocialEquipment(legacy).actor("player").potions,3);
});
test("combat guard decreases incoming damage and healing caps at 100",()=>{
 const battle=new BattleTest(),p=player();
 const foe=battle.spawn(p,"orc").enemy;
 foe.x=0;foe.z=2;foe.attackCooldown=0;
 battle.guard(2);
 battle.advance(.05,p);
 for(let i=0;i<6;i++)battle.advance(.1,p);
 assert.equal(battle.playerHp,96,"12 incoming damage reduced to four");
 assert.equal(battle.heal(35),4);
 assert.equal(battle.playerHp,100);
 assert.equal(battle.heal(35),0);
});
test("explicitly chosen enemy takes precedence over closer aligned target on arrow shot",()=>{
 const battle=new BattleTest(),p=player();
 const front=battle.spawn(p,"goblin").enemy;
 const picked=battle.spawn(p,"orc").enemy;
 front.x=0;front.z=3;picked.x=0;picked.z=7;
 battle.targetId=picked.id;
 const hit=battle.hitArrow(p,{range:18,damage:22});
 assert.equal(hit.length,1);
 assert.equal(hit[0].id,picked.id);
 assert.equal(front.hp,front.maxHp);
});
test("browser view wires action toolbar, crosshair, touch priority and target ring",()=>{
 const html=readFileSync(new URL("../planet-explorer/index.html",import.meta.url),"utf8");
 for(const id of ["action-command-bar","aim-reticle","combat-target-label","combat-auto-target","quick-config-rows"])
  assert.ok(html.includes('id="'+id+'"'),id);
 assert.match(html,/V0\.7[qr]/);
 const app=readFileSync(new URL("../planet-explorer/app.mjs",import.meta.url),"utf8");
 assert.match(app,/frontierUI\?\.selectTargetAt/);
 assert.match(app,/frontierUI\?\.updateTarget/);
 const ui=readFileSync(new URL("../planet-explorer/frontier-interaction-ui.mjs",import.meta.url),"utf8");
 assert.match(ui,/manualTargetId/);
 assert.match(ui,/function runCommand/);
 const renderer=readFileSync(new URL("../planet-explorer/render.mjs",import.meta.url),"utf8");
 assert.match(renderer,/combatTargetId/);
 assert.match(renderer,/screenEnemies/);
});
