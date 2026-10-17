import test from "node:test";
import assert from "node:assert/strict";
import {Planet} from "../planet/planet-core.mjs";
import {Terrain} from "../planet/terrain-engine.mjs";
import {ExplorerController} from "../planet-explorer/controller.mjs";
import {Actions} from "../planet-explorer/actions.mjs";
import {GroupRegistry} from "../planet-explorer/groups.mjs";
import {SquadEngine} from "../planet-explorer/squad.mjs";

function setup(saved=null){
 const terrain=new Terrain(new Planet({seed:77}));
 const player=new ExplorerController(terrain);
 player.altitudeM=2.5;player.targetAltitudeM=2.5;
 const actions=new Actions();
 const squad=new SquadEngine(terrain,player,actions,saved);
 for(const a of squad.agents){
  a.control.altitudeM=2.5;a.control.targetAltitudeM=2.5;
 }
 return {terrain,player,actions,squad};
}

test("registered groups store independent follow toggles and multi-selection",()=>{
 const {squad}=setup();
 const a=squad.registerGroup("弓兵隊",["player","scout"],{formation:"line",follow:true,sync:true});
 const b=squad.registerGroup("工作隊",["artisan"],{formation:"column",follow:false,sync:false});
 assert.equal(squad.activeGroup()?.id,b.id);
 const selected=squad.selectGroups([a.id,b.id]);
 assert.deepEqual(selected.map(g=>g.id),[a.id,b.id]);
 assert.equal(squad.activeGroup(),null);
 assert.deepEqual(new Set(squad.selected),new Set(["player","scout","artisan"]));
 const save=squad.snapshot();
 assert.deepEqual(save.groups.activeIds,[a.id,b.id]);
 assert.equal(save.groups.entries.find(g=>g.id===a.id).follow,true);
});

test("legacy group snapshots without follow and activeIds migrate",()=>{
 const known=()=>["player","scout","artisan"];
 const g=new GroupRegistry(known),item=g.create({name:"旧隊",members:["player","scout"]});
 const snapshot=g.snapshot();
 delete snapshot.activeIds;delete snapshot.entries[0].follow;
 const restored=new GroupRegistry(known,snapshot);
 assert.equal(restored.active().id,item.id);
 assert.equal(restored.get(item.id).follow,false);
 assert.throws(()=>restored.activateMany(["missing"]),/存在しない/);
});

test("manual waypoint has priority; re-enabling following clears manual override",()=>{
 const {squad}=setup();
 const group=squad.registerGroup("護衛",["player","scout"],{follow:true,formation:"column"});
 const scout=squad.get("scout");
 assert.equal(squad.orderMove(["scout"],20,20),1);
 assert.equal(scout.formationOverride,true);
 const target={...scout.control.moveTarget};
 squad.advance(.1);
 assert.equal(scout.formationOverride,true);
 assert.deepEqual(scout.control.moveTarget,target);
 squad.setGroupFollow(group.id,true);
 assert.equal(scout.formationOverride,false);
});

test("multiple squads stop union once when registrations overlap",()=>{
 const {squad}=setup();
 const a=squad.registerGroup("甲",["player","scout"],{follow:true});
 const b=squad.registerGroup("乙",["scout","artisan"],{follow:true});
 squad.selectGroups([a.id,b.id]);
 assert.equal(squad.orderGroups([a.id,b.id],"stop"),3);
 assert.ok(squad.agents.every(person=>person.formationOverride));
 assert.ok(squad.agents.every(person=>!person.control.moveTarget));
});

test("formation leader offset retargets when the leader moves and rotates",()=>{
 const {squad}=setup();
 const group=squad.registerGroup("隊列",["player","scout"],{formation:"column",spacing:3,follow:true});
 const scout=squad.get("scout"),lead=squad.get("player").control;
 lead.x+=10;
 squad.updateFormationFollowers(0);
 assert.equal(scout.order,"formation");
 const start={...scout.control.moveTarget};
 lead.x+=12;lead.yaw=Math.PI/2;
 squad.updateFormationFollowers(0);
 assert.ok(scout.control.moveTarget);
 assert.ok(Math.hypot(scout.control.moveTarget.x-start.x,scout.control.moveTarget.z-start.z)>5);
 squad.setGroupFollow(group.id,false);
 assert.equal(scout.order,"idle");
 assert.equal(scout.control.moveTarget,null);
});

test("multi-squad rally keeps their destinations; old squad saves load",()=>{
 const {terrain,player,actions,squad}=setup();
 const a=squad.registerGroup("甲",["player","scout"],{follow:true});
 const b=squad.registerGroup("乙",["artisan"],{follow:false});
 squad.setGroupRally(a.id,20,20);squad.setGroupRally(b.id,15,15);
 squad.selectGroups([a.id,b.id]);
 const moved=squad.orderGroups([a.id,b.id],"rally");
 assert.ok(moved>=1&&moved<=3);
 const saved=squad.snapshot();
 const restored=new SquadEngine(terrain,player,actions,JSON.parse(JSON.stringify(saved)));
 assert.deepEqual(restored.selectedGroups().map(g=>g.id),[a.id,b.id]);
 const old=JSON.parse(JSON.stringify(saved));delete old.groups;
 assert.doesNotThrow(()=>new SquadEngine(terrain,player,actions,old));
});
