import test from "node:test";
import assert from "node:assert/strict";
import {Planet} from "../planet/planet-core.mjs";
import {Terrain} from "../planet/terrain-engine.mjs";
import {ExplorerController} from "../planet-explorer/controller.mjs";
import {Actions} from "../planet-explorer/actions.mjs";
import {SquadEngine} from "../planet-explorer/squad.mjs";
import {BattleTest} from "../planet-explorer/battle-test.mjs";
import {TROOP_ROLES,rosterForPreset,tacticalOffsets,MAX_ALLIES} from "../planet-explorer/tactical-roster.mjs";

function scene(){
 const terrain=new Terrain(new Planet({seed:77}));
 const lead=new ExplorerController(terrain);
 lead.altitudeM=2.5;lead.targetAltitudeM=2.5;
 const actions=new Actions(),squad=new SquadEngine(terrain,lead,actions);
 return {terrain,lead,actions,squad};
}
test("adventure party creates six independent role-bearing companions",()=>{
 const {squad}=scene(),group=squad.deployPreset("party");
 assert.equal(group.ids.length,6);
 assert.equal(squad.agents.length,9);
 assert.deepEqual(group.roles,["sword","spear","axe","archer","mage","healer"]);
 assert.deepEqual(group.group.members,group.ids);
 assert.equal(group.group.formation,"battleline");
 assert.equal(group.group.follow,true);
 assert.ok(group.ids.every(id=>squad.get(id)?.control!==squad.get("player").control));
});
test("company creates exactly 20 spears, 10 swords, 10 archers, 5 mages, 5 healers",()=>{
 const {squad}=scene(),company=squad.deployPreset("company");
 assert.equal(company.ids.length,50);
 const expected={spear:20,sword:10,archer:10,mage:5,healer:5};
 for(const [key,n] of Object.entries(expected))
  assert.equal(company.roles.filter(r=>r===key).length,n);
 assert.equal(squad.agents.length,53);
 assert.equal(company.group.formation,"battleline");
 assert.ok(company.ids.every(id=>squad.frontier.person(id)));
});
test("tactical formation puts melee front and support behind archers",()=>{
 const roles=rosterForPreset("company"),offsets=tacticalOffsets(roles,2.4);
 assert.equal(offsets.length,50);
 const first=(rank)=>offsets.filter((p,i)=>TROOP_ROLES[roles[i]].rank===rank);
 const front=first("front"),rear=first("rear"),support=first("support");
 assert.ok(Math.min(...front.map(p=>p.z))>Math.max(...rear.map(p=>p.z)));
 assert.ok(Math.min(...rear.map(p=>p.z))>Math.max(...support.map(p=>p.z)));
});
test("additional squads retain roles and HP in a version-one save",()=>{
 const {terrain,lead,actions,squad}=scene();
 squad.deployPreset("party");
 const hurt=squad.get("troop-1");hurt.hp=32;
 const saved=squad.snapshot();
 const copy=new SquadEngine(terrain,lead,actions,JSON.parse(JSON.stringify(saved)));
 assert.equal(copy.agents.length,9);
 assert.equal(copy.get("troop-1").hp,32);
 assert.equal(copy.get("troop-4").role,"archer");
 assert.equal(copy.groups.all().length,1);
});
test("old three-member saves remain loadable",()=>{
 const {terrain,lead,actions,squad}=scene();
 const old=squad.snapshot();delete old.groups;
 const copy=new SquadEngine(terrain,lead,actions,old);
 assert.equal(copy.agents.length,3);
});
test("large deployment cap prevents runaway spawning",()=>{
 const {squad}=scene();
 squad.deployPreset("company");squad.deployPreset("party");
 assert.throws(()=>squad.deployPreset("company"),/最大/);
 assert.ok(squad.agents.length<=MAX_ALLIES);
});
test("hostile units spawn as independent enemies and engage squad members",()=>{
 const {lead,squad}=scene(),battle=new BattleTest();
 squad.deployPreset("party");
 const bandits=battle.spawnUnit(lead,"raiders");
 assert.equal(bandits.ok,true);
 assert.equal(bandits.count,10);
 assert.equal(battle.enemyUnits.length,1);
 const monsters=battle.spawnUnit(lead,"warband");
 assert.equal(monsters.count,18);
 assert.equal(battle.count(),28);
 assert.doesNotThrow(()=>battle.advance(.1,lead,null,squad));
 assert.ok(battle.enemies.every(e=>e.hp>0));
});
test("healers heal wounded comrades, ranged and magic units attack valid foes",()=>{
 const {squad,lead}=scene(),battle=new BattleTest();
 squad.deployPreset("party");
 const mage=squad.agents.find(a=>a.role==="mage"&&a.id.startsWith("troop-"));
 const archer=squad.agents.find(a=>a.role==="archer"&&a.id.startsWith("troop-"));
 const healer=squad.agents.find(a=>a.role==="healer"&&a.id.startsWith("troop-"));
 const hurt=squad.agents.find(a=>a.role==="sword"&&a.id.startsWith("troop-"));
 hurt.hp=40;
 // Place one enemy in range of rear lines to exercise each combat type.
 const enemy=battle.spawn(lead,"orc").enemy;
 enemy.x=archer.control.x+2;enemy.z=archer.control.z+2;
 mage.control.x=archer.control.x;mage.control.z=archer.control.z;
 healer.control.x=hurt.control.x;healer.control.z=hurt.control.z;
 let shots=0;
 const before=enemy.hp;
 battle.advanceAllies(.1,squad,{launchArrow:()=>{shots++;return true;}});
 assert.ok(shots>0);
 assert.ok(enemy.hp<before);
 assert.ok(hurt.hp>40);
});
