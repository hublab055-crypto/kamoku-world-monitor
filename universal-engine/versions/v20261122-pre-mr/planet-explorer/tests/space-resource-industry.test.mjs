import test from "node:test";
import assert from "node:assert/strict";
import {ASTEROID_CONTACTS,SpaceIndustry,SPACE_RECIPES} from "../space-resource-industry.mjs";

test("asteroid extraction uses a lockable contact, range and finite stores",()=>{
 const industry=new SpaceIndustry();
 const rock=ASTEROID_CONTACTS.find(c=>c.deposit==="metal");
 assert.equal(industry.mine(rock.id,{weapon:"pulse",distance:1600}).ok,false);
 const shot=industry.mine(rock.id,{weapon:"pulse",distance:880});
 assert.equal(shot.ok,true);
 assert(shot.amount>0);
 assert(industry.cargoKg>0);
 assert(industry.remaining[rock.id][shot.resource]>=0);
});

test("refining and refuelling consume cargo and persist through snapshots",()=>{
 const industry=new SpaceIndustry();
 industry.stock.water=24;
 const combat={supplies:{kits:0}},voyage={fuel:40};
 assert.equal(industry.craft("propellant",{voyage,combat}).ok,true);
 assert.equal(industry.stock.water,12);
 assert.equal(industry.stock.propellant,8);
 assert.equal(industry.craft("refuel",{voyage,combat}).ok,true);
 assert.equal(voyage.fuel,65);
 assert.equal(industry.stock.propellant,0);
 assert.deepEqual(new SpaceIndustry(industry.snapshot()).snapshot(),industry.snapshot());
});

test("repair material recipes and future helium-3 technology are gated",()=>{
 const industry=new SpaceIndustry();
 industry.stock.iron=20;industry.stock.aluminum=10;industry.stock.copper=10;
 const combat={supplies:{kits:0}};
 assert.equal(industry.craft("hull",{combat}).ok,true);
 assert.equal(industry.craft("repair",{combat}).ok,true);
 assert.equal(combat.supplies.kits,1);
 assert.equal(industry.craft("fusion",{combat}).ok,false);
 assert(SPACE_RECIPES.some(r=>r.id==="fusion"&&r.tech===3));
});

test("cargo limits and reloads do not mint new ores",()=>{
 const industry=new SpaceIndustry();
 industry.stock.iron=360;
 assert.equal(industry.mine(ASTEROID_CONTACTS[0].id,{distance:100}).ok,false);
 const save=industry.snapshot();
 const next=new SpaceIndustry(save);
 assert.deepEqual(next.remaining,save.remaining);
 assert.equal(next.cargoKg,360);
});
