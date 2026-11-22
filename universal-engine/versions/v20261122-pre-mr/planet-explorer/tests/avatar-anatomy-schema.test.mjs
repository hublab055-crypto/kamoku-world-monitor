import test from "node:test";
import assert from "node:assert/strict";
import {normalizeAvatarAnatomy,visibleAnatomyRegions} from "../avatar-anatomy-schema.mjs";

test("old saves without anatomy preserve neutral exterior defaults",()=>{
 const old=normalizeAvatarAnatomy(undefined);
 assert.equal(old.layer,"skin");
 assert.equal(old.preset,"neutral");
 assert.equal(old.chestJiggle,0);
 assert.equal(old.navelDepth,0);
});

test("settings are clamped; unfamiliar preset names cannot enter saved state",()=>{
 const fit=normalizeAvatarAnatomy({preset:"invalid",layer:"unknown",navelDepth:700,armDefinition:-600});
 assert.equal(fit.preset,"neutral");
 assert.equal(fit.layer,"skin");
 assert.equal(fit.navelDepth,100);
 assert.equal(fit.armDefinition,-100);
});

test("reproductive anatomy reference follows the explicit educational preset",()=>{
 const uterine=visibleAnatomyRegions({layer:"organs",preset:"uterine"}).map(x=>x.id);
 assert(uterine.includes("uterus"));
 assert(!uterine.includes("testes"));
 const testicular=visibleAnatomyRegions({layer:"organs",preset:"testicular"}).map(x=>x.id);
 assert(testicular.includes("testes"));
 assert(!testicular.includes("uterus"));
});
