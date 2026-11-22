import test from "node:test";
import assert from "node:assert/strict";
import {createScenario,INTRO_QUESTS} from "../planet-explorer/scenario-engine.mjs";
test("scenario choices and inheritance survive save roundtrip",()=>{
 const a=createScenario();a.start("story");for(const q of INTRO_QUESTS)a.addQuest(q);a.resolve("bridge-dispute","negotiate");a.inherit("daughter");const b=createScenario(a.snapshot());assert.equal(b.snapshot().generation,2);assert.equal(b.snapshot().quests["bridge-dispute"].choice,"negotiate");assert.equal(b.snapshot().history.length,3);
});
test("Kardashev index follows logarithmic energy scale",()=>{const a=createScenario();assert.equal(a.kardashev(),null);a.setEnergy(1e16);assert.equal(a.kardashev(),1);a.setEnergy(1e26);assert.equal(a.kardashev(),2);assert.throws(()=>a.setEnergy(-1));});
test("scenario preserves sandbox default and rejects invalid quest choice",()=>{const a=createScenario();assert.equal(a.snapshot().mode,"sandbox");a.addQuest(INTRO_QUESTS[0]);assert.throws(()=>a.resolve("first-journey","wrong"));assert.equal(a.snapshot().quests["first-journey"].status,"available");});
