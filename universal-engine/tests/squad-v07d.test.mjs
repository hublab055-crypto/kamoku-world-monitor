import test from "node:test";
import assert from "node:assert/strict";
import {Planet} from "../planet/planet-core.mjs";
import {Terrain} from "../planet/terrain-engine.mjs";
import {ExplorerController} from "../planet-explorer/controller.mjs";
import {Actions} from "../planet-explorer/actions.mjs";
import {SquadEngine,sanitizeRule,testCondition,RULE_METRICS,RULE_OPERATORS,RULE_ACTIONS}
 from "../planet-explorer/squad.mjs";

function setup(){
 const terrain=new Terrain(new Planet({seed:77}));
 const player=new ExplorerController(terrain);
 player.altitudeM=2.5;player.targetAltitudeM=2.5;
 const actions=new Actions(),squad=new SquadEngine(terrain,player,actions);
 squad.agents.slice(1).forEach(a=>{a.control.altitudeM=2.5;a.control.targetAltitudeM=2.5;});
 return {terrain,player,actions,squad};
}
test("initial RTS party has three selectable independently controlled actors",()=>{
 const {player,squad}=setup();
 assert.deepEqual(squad.agents.map(a=>a.id),["player","scout","artisan"]);
 assert.equal(squad.get("player").control,player);
 assert.notEqual(squad.get("scout").control,player);
 assert.equal(squad.agents[1].rules.length,8);
 assert.equal(squad.agents[2].rules.length,8);
 assert.deepEqual(squad.selectedAgents().map(a=>a.id),["player"]);
 squad.choose("scout");assert.deepEqual(squad.selectedAgents().map(a=>a.id),["scout"]);
 squad.choose("artisan",{add:true});
 assert.deepEqual(squad.selectedAgents().map(a=>a.id),["scout","artisan"]);
 squad.selectAll();assert.equal(squad.selected.size,3);
});
test("condition comparisons preserve all inequalities and reject code injection",()=>{
 assert.deepEqual(RULE_OPERATORS,["<","<=",">",">=","==","!="]);
 assert.equal(testCondition(5,"<",5),false);
 assert.equal(testCondition(5,"<=",5),true);
 assert.equal(testCondition(5,">",5),false);
 assert.equal(testCondition(5,">=",5),true);
 assert.equal(testCondition(5,"==",5),true);
 assert.equal(testCondition(5,"!=",5),false);
 assert.ok(RULE_METRICS.includes("wood")&&RULE_ACTIONS.includes("follow"));
 const valid=sanitizeRule({enabled:true,metric:"wood",op:"<=",value:2,action:"gather_wood"});
 assert.equal(valid.value,2);
 assert.throws(()=>sanitizeRule({...valid,metric:"globalThis"}),/Invalid/);
 assert.throws(()=>sanitizeRule({...valid,action:"eval"}),/Invalid/);
 assert.throws(()=>sanitizeRule({...valid,value:Infinity}),/Invalid/);
});
test("rule priority picks the first matching condition, then produces wood",()=>{
 const {squad,actions}=setup();
 const a=squad.get("scout");
 a.rules[0]={enabled:true,metric:"wood",op:"<",value:20,action:"gather_wood"};
 a.rules[1]={enabled:true,metric:"stone",op:"<",value:20,action:"gather_stone"};
 squad.setAuto(["scout"],true);
 const wood=actions.resources.wood,stone=actions.resources.stone;
 for(let i=0;i<21;i++)squad.advance(.1);
 assert.equal(actions.resources.wood,wood+2);
 assert.equal(actions.resources.stone,stone);
 assert.equal(a.auto,true);
});
test("manual movement of lead does not suspend autonomous companion tasks",()=>{
 const {squad,actions}=setup();
 squad.setAuto(["scout"],true);
 const prev=actions.resources.wood;
 for(let i=0;i<20;i++)squad.advance(.1,{manualLead:true});
 assert.ok(actions.resources.wood>prev);
});
test("group move orders obey 350 m cap and halt clears all targets",()=>{
 const {squad}=setup();
 squad.selectAll();
 const moved=squad.orderMove(["player","scout","artisan"],20,20);
 assert.ok(moved>=1&&moved<=3);
 assert.equal(squad.orderMove(["player"],1000,1000),0);
 squad.halt(["player","scout","artisan"]);
 assert.ok(squad.agents.every(a=>!a.control.moveTarget));
});
test("manual RTS movement survives cancellation of an active Frontier gathering task",()=>{
 const {squad,player}=setup();
 const a=squad.get("player");
 a.task={kind:"gather_nearby",slot:2,target:null};
 const moved=squad.orderMove(["player"],player.x+6,player.z+4);
 assert.equal(moved,1);
 assert.ok(a.control.moveTarget,"manual target must remain after auto task cancellation");
 assert.equal(a.task,null);
});
test("per-actor 8 rules, enabled flags, rally and party state persist",()=>{
 const {terrain,player,actions,squad}=setup();
 squad.setRule("artisan",3,{enabled:true,metric:"houses",op:">=",value:2,action:"follow"});
 squad.setRally(["artisan"],17,-8);squad.setAuto(["artisan"],true);
 squad.choose("artisan");
 const copy=SquadEngineTestRestore(terrain,player,actions,squad.snapshot());
 assert.equal(copy.get("artisan").rules[3].action,"follow");
 assert.equal(copy.get("artisan").rally.x,17);
 assert.equal(copy.get("artisan").auto,true);
 assert.deepEqual([...copy.selected],["artisan"]);
 assert.throws(()=>squad.setRule("artisan",8,{enabled:false}),/Unknown slot/);
 const bad=squad.snapshot();bad.agents[2].rules[3].metric="__proto__";
 assert.throws(()=>SquadEngineTestRestore(terrain,player,actions,bad),/Invalid/);
});
function SquadEngineTestRestore(terrain,player,actions,snap){
 return new SquadEngine(terrain,player,actions,JSON.parse(JSON.stringify(snap)));
}
test("existing player save coordinates are unchanged by squad snapshot",()=>{
 const {squad,player}=setup();
 const old=JSON.stringify(player.snapshot());
 squad.snapshot();
 assert.equal(JSON.stringify(player.snapshot()),old);
});
