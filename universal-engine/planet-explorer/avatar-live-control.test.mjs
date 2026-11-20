import test from "node:test";
import assert from "node:assert/strict";
import {normalizeAvatarRoster} from "./avatar-v10.mjs";
import {LIVE_AVATAR_FIELDS,setLiveAvatarValue,liveAvatarValue} from "./avatar-live-control.mjs";
test("player-only live morph clamps to the existing editor's limits",()=>{
 const before=normalizeAvatarRoster();
 const after=setLiveAvatarValue(before,"eyeSize",500);
 assert.equal(after.value,126);
 assert.equal(after.roster.player.appearance.eyeSize,126);
 assert.deepEqual(after.roster.navigator,before.navigator);
 assert.equal(liveAvatarValue(after.roster,"eyeSize"),126);
 assert.equal(before.player.appearance.eyeSize,100);
 assert.equal(LIVE_AVATAR_FIELDS.length,5);
});
test("Unknown and invalid morphs are rejected",()=>{
 const before=normalizeAvatarRoster();
 assert.equal(setLiveAvatarValue(before,"outfit","base"),null);
 assert.equal(setLiveAvatarValue(before,"eyeSize",Number.NaN),null);
 assert.equal(setLiveAvatarValue(before,"mouthSize",null),null);
 assert.equal(setLiveAvatarValue(before,"eyeSize",-5).value,76);
});