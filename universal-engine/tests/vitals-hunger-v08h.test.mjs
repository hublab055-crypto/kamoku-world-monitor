import test from "node:test";
import assert from "node:assert/strict";
import {DEFAULT_VITALS,normalizeVitals,advanceVitals,damageStress,eatVitals,healVitals,restVitals}
 from "../planet-explorer/character-vitals.mjs";
import {ConstructionSystem,FACILITIES} from "../planet-explorer/construction-system.mjs";
import {placedBuildingGeometry} from "../planet-explorer/placed-buildings-geometry.mjs";
import {SquadEngine,RULE_METRICS} from "../planet-explorer/squad.mjs";
import {Planet} from "../planet/planet-core.mjs";
import {Terrain} from "../planet/terrain-engine.mjs";
import {ExplorerController} from "../planet-explorer/controller.mjs";
import {Actions} from "../planet-explorer/actions.mjs";

test("satiety drops with simulated time and faster with movement and work",()=>{
 const idle={...normalizeVitals()},running={...normalizeVitals()},working={...normalizeVitals()};
 for(let i=0;i<500;i++){
  advanceVitals(idle,.20,{hp:100});
  advanceVitals(running,.20,{hp:100,moving:true});
  advanceVitals(working,.20,{hp:100,working:true});
 }
 assert.ok(idle.hunger<DEFAULT_VITALS.hunger);
 assert.ok(running.hunger<idle.hunger);
 assert.ok(working.hunger<idle.hunger);
});
test("small natural HP recovery spends stamina and satiety and stops when deprived",()=>{
 const p={...normalizeVitals(),hunger:60,stamina:80};
 const start={...p};const result=advanceVitals(p,.25,{hp:30,maxHp:100});
 assert.ok(result.hp>30&&result.hp<31);
 assert.ok(p.stamina<start.stamina);
 assert.ok(p.hunger<start.hunger);
 const hungry={...normalizeVitals(),hunger:0,stamina:80};
 const none=advanceVitals(hungry,.25,{hp:30,maxHp:100});
 assert.equal(none.hp,30);
 const tired={...normalizeVitals(),hunger:80,stamina:5};
 assert.equal(advanceVitals(tired,.25,{hp:30,maxHp:100}).hp,30);
 assert.equal(advanceVitals({...normalizeVitals()},.25,{hp:0,maxHp:100}).hp,0,"unconscious does not auto-resurrect");
});
test("prolonged hunger and exhaustion deteriorate mental health",()=>{
 const p={...normalizeVitals(),hunger:8,stamina:12,mental:70};
 for(let i=0;i<100;i++)advanceVitals(p,.2,{hp:80,maxHp:100,externalStamina:true});
 assert.ok(p.mental<70);
 const another={...normalizeVitals(),mental:80};
 assert.ok(damageStress(another,20,100)>0);
 assert.ok(another.mental<80);
 const blocked={...normalizeVitals(),hunger:0,stamina:0,mental:0};
 for(let i=0;i<100;i++)advanceVitals(blocked,.2,{hp:1,externalStamina:true});
 assert.equal(blocked.mental,0);
});
test("potion, magic and church restore significantly more HP than passive regeneration",()=>{
 const p={...normalizeVitals(),mental:75,stamina:20};
 const slow=advanceVitals({...p},.25,{hp:30,maxHp:100}).recovered;
 const pot=healVitals(p,30,100,"potion");
 assert.equal(pot.ok,true);assert.equal(pot.healed,45);
 assert.equal(p.healingPotions,1);
 assert.ok(pot.healed>slow*100);
 const magic=healVitals(p,20,100,"magic");
 assert.equal(magic.healed,38);assert.equal(p.mental,59); // potion +4 then spell -20
 const before={...p};
 assert.equal(healVitals(p,20,100,"church").ok,false);
 assert.deepEqual(p,before,"cannot get free distance healing");
 const priest=healVitals(p,2,100,"church",{atChurch:true});
 assert.equal(priest.healed,85);
 assert.ok(p.stamina>20);
});
test("food and rest restore energy with physical resources still required",()=>{
 const p={...normalizeVitals(),hunger:22,stamina:15,mental:50};
 const meal=eatVitals(p,{quality:"meal"});
 assert.equal(meal.ok,true);assert.equal(p.hunger,67);
 const rest=restVitals(p,{sleep:true});
 assert.equal(rest.ok,true);assert.equal(p.hunger,58);
 assert.ok(p.stamina>60);
 const full={...normalizeVitals(),hunger:100};
 assert.equal(eatVitals(full,{quality:"apple"}).ok,false);
});
test("old Frontier saves migrate hunger and potions safely",()=>{
 const terrain=new Terrain(new Planet({seed:77})),lead=new ExplorerController(terrain);
 const team=new SquadEngine(terrain,lead,new Actions());
 const p=team.frontier.person("player");
 assert.equal(p.hunger,78);assert.equal(p.healingPotions,2);
 p.hunger=45;p.mental=60;p.healingPotions=1;
 const copy=new SquadEngine(terrain,lead,new Actions(),team.snapshot());
 assert.equal(copy.frontier.person("player").hunger,45);
 assert.equal(copy.frontier.person("player").healingPotions,1);
 assert.ok(RULE_METRICS.includes("hunger")&&RULE_METRICS.includes("mental"));
});
test("church is buildable, drawn and reachable for treatment",()=>{
 const c=new ConstructionSystem(),inventory={wood:100,stone:100,metal:20};
 const place=c.place("church",12,4,()=>({lat:28,lon:40,elevationM:300}),inventory);
 assert.equal(place.ok,true);assert.equal(FACILITIES.church.name,"教会");
 assert.ok(placedBuildingGeometry("church").indices.length>0);
 const near=c.structures.some(x=>x.kind==="church"&&Math.hypot(x.x-15,x.z-4)<=8);
 assert.equal(near,true);
 assert.equal(c.structures.some(x=>x.kind==="church"&&Math.hypot(x.x-75,x.z-4)<=8),false);
});
