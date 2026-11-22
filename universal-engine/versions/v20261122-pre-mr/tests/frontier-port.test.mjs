import test from "node:test";
import assert from "node:assert/strict";
import {Planet} from "../planet/planet-core.mjs";
import {Terrain} from "../planet/terrain-engine.mjs";
import {ExplorerController} from "../planet-explorer/controller.mjs";
import {Actions} from "../planet-explorer/actions.mjs";
import {Lifestyle} from "../planet-explorer/lifestyle.mjs";
import {SquadEngine,RULE_METRICS,RULE_ACTIONS} from "../planet-explorer/squad.mjs";

function setup(){
 const terrain=new Terrain(new Planet({seed:77}));
 const control=new ExplorerController(terrain);
 control.altitudeM=2.5;control.targetAltitudeM=2.5;
 const actions=new Actions(),squad=new SquadEngine(terrain,control,actions);
 const life=new Lifestyle();
 squad.attachLifestyle(life);
 return {squad,actions,life};
}
test("Frontier World mechanics extend the original 8-slot per-actor RTS model",()=>{
 const {squad}=setup();
 assert.ok(RULE_METRICS.includes("stamina")&&RULE_METRICS.includes("load_kg"));
 assert.ok(RULE_METRICS.includes("resource_nearby")&&RULE_ACTIONS.includes("gather_nearby"));
 squad.setRule("scout",4,{enabled:true,metric:"wood",op:">",value:9,action:"wait"});
 squad.frontier.applyPreset("scout");
 const a=squad.get("scout");
 assert.deepEqual(a.rules.slice(0,3).map(r=>[r.metric,r.op,r.value,r.action]),[
  ["stamina","<=",30,"rest_home"],
  ["load_kg",">",18,"store_chest"],
  ["always","==",1,"gather_nearby"]
 ]);
 assert.equal(a.rules[4].action,"wait");
 assert.equal(squad.get("player").rules[0].metric,"wood");
 squad.frontier.setRadius("scout",27);
 assert.equal(squad.frontier.person("scout").radius,27);
 assert.equal(squad.frontier.person("player").radius,42);
});
test("a started rest job stays latched beyond 30% until 100%",()=>{
 const {squad}=setup(),a=squad.get("player"),f=squad.frontier;
 f.applyPreset("player");a.auto=true;
 f.person("player").stamina=29;
 assert.equal(f.start(a,"rest_home",0),true);
 for(let i=0;i<20&&a.task;i++)f.tick(a,1);
 assert.equal(f.person("player").stamina,100);
 assert.equal(a.task,null);
});
test("22kg inventory deposits in the existing material chest and Lifestyle kitchen inventory",()=>{
 const {squad,actions,life}=setup(),a=squad.get("player"),f=squad.frontier;
 f.applyPreset("player");a.auto=true;
 const beforeWood=actions.resources.wood,beforeStone=actions.resources.stone,beforeFood=life.inventory.rawFood;
 f.person("player").inventory={wood:4,stone:2,fiber:0,food:2,water:0};
 assert.equal(f.loadKg("player"),22);
 assert.equal(f.start(a,"store_chest",1),true);
 f.tick(a,1);
 assert.equal(f.loadKg("player"),0);
 assert.equal(actions.resources.wood,beforeWood+4);
 assert.equal(actions.resources.stone,beforeStone+2);
 assert.equal(life.inventory.rawFood,beforeFood+2);
});
test("finite resources are limited by actor radius, save, and restore without duplication",()=>{
 const {squad,actions}=setup(),a=squad.get("player"),f=squad.frontier;
 f.applyPreset("player");a.auto=true;
 f.nodes=[{id:"inside",kind:"wood",x:a.control.x+1,z:a.control.z,quantity:2},
          {id:"outside",kind:"stone",x:a.control.x+90,z:a.control.z,quantity:3}];
 assert.equal(f.metrics(a).resource_nearby,2);
 assert.equal(f.start(a,"gather_nearby",2),true);
 f.tick(a,1);f.tick(a,1);
 assert.equal(f.person("player").inventory.wood,2);
 assert.equal(f.nodes[0].quantity,0);
 assert.equal(f.nodes[1].quantity,3);
 const copy=new SquadEngine(squad.terrain,a.control,actions,squad.snapshot());
 assert.equal(copy.frontier.person("player").inventory.wood,2);
 assert.equal(copy.frontier.nodes[0].quantity,0);
 const oldSave=squad.snapshot();delete oldSave.frontier;
 const migrated=new SquadEngine(squad.terrain,a.control,actions,oldSave);
 assert.equal(migrated.frontier.person("player").stamina,100);
 assert.equal(migrated.frontier.person("player").radius,42);
});
