import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
 partControls,hairStyles,outfits,REVIEW_SLIDERS,defaultAppearance,normalizeAppearance,
 rangeText,fromReviewStorage,exportReviewStorage,reviewModelKey,REVIEW_STORAGE_KEY
} from "../planet-explorer/avatar-review-parameters.mjs";
import {reviewShaderParams,migrateLegacyFit,reviewHairPreset} from "../planet-explorer/avatar-review-adapter.mjs";
import {normalizeAvatarV10} from "../planet-explorer/avatar-v10.mjs";
import {deformAvatarReviewFace} from "../planet-explorer/avatar-review-face.mjs";

test("Original ZIP fields: 16 sections and all 43 slider definitions retain exact ranges",()=>{
 assert.equal(Object.keys(partControls).length,16);
 assert.equal(REVIEW_SLIDERS.length,43);
 assert.deepEqual(Object.keys(outfits),["base","swim","casual","work","space"]);
 assert.deepEqual([partControls.chest.controls[0].min,partControls.chest.controls[0].max],[60,150]);
 assert.deepEqual([partControls.hair.controls[0].min,partControls.hair.controls[0].max],[75,130]);
 assert.deepEqual([partControls.face.controls[0].min,partControls.face.controls[0].max],[85,117]);
 assert.equal(REVIEW_STORAGE_KEY,"universal-engine-avatar-appearance-v1");
 assert.equal(Object.keys(hairStyles).length,8);
 assert.equal(Object.keys(defaultAppearance()).length,45);
});
test("Original neutral values, clamping and explanatory readouts are preserved",()=>{
 const neutral=defaultAppearance();
 for(const {key,min} of REVIEW_SLIDERS)assert.equal(neutral[key],min===0?50:100,key);
 const result=normalizeAppearance({chestSize:"170",hairVolume:-90,eyeShape:58,
  noseSize:"",outfit:"swim",hairStyle:"waves"});
 assert.equal(result.chestSize,150);
 assert.equal(result.hairVolume,85);
 assert.equal(result.eyeShape,58);
 assert.equal(result.noseSize,100);
 assert.equal(result.outfit,"swim");
 assert.equal(result.hairStyle,"waves");
 assert.equal(rangeText("eyeShape",50),"標準");
 assert.match(rangeText("chestFirmness",23),/柔らかめ/);
});
test("Review JSON model keys round trip, including six lineup models",()=>{
 assert.equal(reviewModelKey("lyra"),"anime-lyra");
 const sample={"anime-lyra":{...defaultAppearance(),torsoWidth:116,glutesFirmness:18,outfit:"swim"}};
 const imported=fromReviewStorage(JSON.stringify(sample),"lyra");
 assert.equal(imported.glutesFirmness,18);
 assert.equal(imported.torsoWidth,116);
 assert.equal(fromReviewStorage(sample,"ren"),null);
 assert.equal(fromReviewStorage("{invalid","lyra"),null);
 const roster={player:normalizeAvatarV10("player",{model:"lyra",outfit:"swim",appearance:imported})};
 const exported=exportReviewStorage(roster);
 assert.equal(exported["anime-lyra"].outfit,"swim");
 assert.equal(exported["anime-lyra"].glutesFirmness,18);
});
test("V10 save carries source appearance; old V10 saves migrate without losing outfit",()=>{
 const fit=normalizeAvatarV10("player",{model:"ren",outfit:"base",
  appearance:{torsoWidth:117,chestSize:147,faceWidth:114,hairLength:123}});
 assert.equal(fit.appearance.outfit,"base");
 assert.equal(fit.appearance.torsoWidth,117);
 assert.equal(fit.appearance.chestSize,147);
 assert.equal(migrateLegacyFit({body:{height:20,waist:60}}).torsoLength,106);
});
test("Every proportion and soft-part control reaches the renderer adapter",()=>{
 const appearance=normalizeAppearance({headWidth:115,torsoLength:112,armWidth:110,
  legLength:120,handWidth:107,footLength:87,chestSize:140,
  abdomenShape:80,glutesFirmness:9,hairLength:125,hairStyle:"bald"});
 const p=reviewShaderParams(appearance);
 assert.equal(p.ratios.length,12);
 assert.equal(p.ratios[1],.15);
 assert.equal(p.ratios[2],.12);
 assert.equal(p.volume[0],.8);
 assert.ok(p.shape[1]>.5);
 assert.ok(p.firmness[2]<-.8);
 assert.equal(p.hideHair,true);
 assert.equal(reviewHairPreset("long")[0]>1,true);
});
test("Original face region masks change actual GLB vertex positions, not just slider text",()=>{
 const positions=new Float32Array([.05,1.648,.11,.06,1.645,.12,.04,1.66,.13]);
 const src={name:"Face and skull",arrays:{
  positions,normals:new Float32Array(9),morph0:new Float32Array(9),morph1:new Float32Array(9)
 },indices:new Uint32Array([0,1,2]),names:[]};
 const baseline=deformAvatarReviewFace(src,defaultAppearance(),[1,0],true);
 const settings=normalizeAppearance({eyeSize:126,eyePosition:95,faceWidth:117});
 const changed=deformAvatarReviewFace(src,settings,[1,0],true);
 assert.ok(baseline&&changed);
 assert.notDeepEqual(Array.from(baseline.positions),Array.from(changed.positions));
 assert.deepEqual(Array.from(src.arrays.positions),Array.from(positions));
});
test("Embedded original-editor controls and render shader are wired into game UI",()=>{
 const root=new URL("../planet-explorer/",import.meta.url);
 const ui=readFileSync(new URL("avatar-v10-ui.mjs",root),"utf8");
 const renderer=readFileSync(new URL("frontier-skinned-renderer.mjs",root),"utf8");
 assert.ok(ui.includes("Object.entries(partControls)"));
 assert.ok(ui.includes("fromReviewStorage(data,fit.model)"));
 assert.ok(ui.includes("reviewInputs.set(key"));
 assert.ok(renderer.includes("deformAvatarReviewFace"));
 assert.ok(renderer.includes("uReviewVol"));
 assert.ok(renderer.includes("uReviewFirm"));
 assert.ok(renderer.includes("uReviewHair"));
});
