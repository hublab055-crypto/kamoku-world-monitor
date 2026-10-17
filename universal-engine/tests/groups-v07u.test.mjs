import test from "node:test";
import assert from "node:assert/strict";
import {Planet} from "../planet/planet-core.mjs";
import {Terrain} from "../planet/terrain-engine.mjs";
import {ExplorerController} from "../planet-explorer/controller.mjs";
import {Actions} from "../planet-explorer/actions.mjs";
import {SquadEngine} from "../planet-explorer/squad.mjs";
import {GroupRegistry,formationOffsets,FORMATIONS} from "../planet-explorer/groups.mjs";

function setup(save=null){
 const terrain=new Terrain(new Planet({seed:77}));
 const player=new ExplorerController(terrain);
 player.altitudeM=2.5;player.targetAltitudeM=2.5;
 const actions=new Actions();
 const squad=new SquadEngine(terrain,player,actions,save);
 squad.agents.slice(1).forEach(a=>{a.control.altitudeM=2.5;a.control.targetAltitudeM=2.5;});
 return {terrain,player,actions,squad};
}
test("four formations create unique positions with preserved registration order",()=>{
 assert.deepEqual(Object.keys(FORMATIONS),["line","column","wedge","square","battleline"]);
 for(const kind of Object.keys(FORMATIONS)){
  const coords=formationOffsets(3,kind,2.4);
  assert.equal(coords.length,3);
  assert.equal(new Set(coords.map(v=>v.x+","+v.z)).size,3);
 }
 assert.equal(formationOffsets(3,"line",2.4)[0].x,-2.4);
 assert.equal(formationOffsets(3,"column",2.4)[0].z,2.4);
 assert.equal(formationOffsets(3,"wedge",2.4)[0].x,0);
 assert.throws(()=>formationOffsets(3,"evil",2.4),/未対応/);
});
test("group registration is named, editable, ordered, independently selectable and deletable",()=>{
 const {squad}=setup();
 const first=squad.registerGroup("弓兵隊",["scout","player"],{formation:"line",sync:true});
 const second=squad.registerGroup("工兵隊",["artisan"],{formation:"column"});
 assert.notEqual(first.id,second.id);
 assert.equal(squad.activeGroup()?.name,"工兵隊");
 assert.deepEqual(squad.selectGroup(first.id).members,["scout","player"]);
 assert.deepEqual(squad.selectedAgents().map(a=>a.id),["player","scout"]);
 squad.updateGroup(first.id,{members:["player","scout"],formation:"wedge",spacing:3});
 assert.deepEqual(squad.activeGroup().members,["player","scout"]);
 assert.equal(squad.activeGroup().sync,true);
 assert.throws(()=>squad.registerGroup("弓兵隊",["artisan"]),/同じ名前/);
 squad.choose("artisan");assert.equal(squad.activeGroup(),null);
 squad.selectGroup(first.id);
 assert.equal(squad.removeGroup(first.id),true);
 assert.equal(squad.activeGroup(),null);
 assert.equal(squad.groups.all().length,1);
});
test("saved groups and rally positions survive older version-one squad saves",()=>{
 const {terrain,player,actions,squad}=setup();
 const group=squad.registerGroup("第一隊",["player","scout","artisan"],{formation:"square",spacing:4,sync:true});
 squad.setGroupRally(group.id,11,-5);
 const save=squad.snapshot();
 assert.equal(save.version,1);
 const next=new SquadEngine(terrain,player,actions,JSON.parse(JSON.stringify(save)));
 assert.equal(next.activeGroup().name,"第一隊");
 assert.equal(next.activeGroup().rally.x,11);
 assert.equal(next.activeGroup().sync,true);
 const old=JSON.parse(JSON.stringify(save));delete old.groups;
 const legacy=new SquadEngine(terrain,player,actions,old);
 assert.equal(legacy.groups.all().length,0);
});
test("group move applies formation and keeps manual commands higher priority than auto",()=>{
 const {squad}=setup();
 const group=squad.registerGroup("隊列",["player","scout","artisan"],{formation:"line",spacing:3});
 squad.setGroupRally(group.id,20,20);
 const count=squad.rallyGroup(group.id);
 assert.ok(count>=1&&count<=3);
 const locations=squad.agents.filter(a=>a.control.moveTarget).map(a=>a.control.moveTarget);
 if(locations.length===3)assert.ok(new Set(locations.map(p=>p.x+","+p.z)).size===3);
 assert.ok(squad.get("scout").cooldown>=1.5||!squad.get("scout").control.moveTarget);
});
test("registry rejects unsafe or missing members and corrupt saved groups safely",()=>{
 const registry=new GroupRegistry(()=>["player","scout","artisan"]);
 assert.throws(()=>registry.create({name:"",members:["player"]}),/部隊名/);
 assert.throws(()=>registry.create({name:"軍",members:["fake"]}),/メンバー/);
 assert.throws(()=>registry.create({name:"軍",members:["player","player"]}),/メンバー/);
 const g=registry.create({name:"軍",members:["player"]});
 const state=registry.snapshot();state.entries.push({...g,id:"g999",name:"bad",members:["fake"]});
 const restored=new GroupRegistry(()=>["player","scout"],state);
 assert.equal(restored.all().length,1);
 assert.equal(restored.active()?.id,g.id);
});
