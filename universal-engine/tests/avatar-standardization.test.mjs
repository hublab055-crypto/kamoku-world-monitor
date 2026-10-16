import test from "node:test";
import assert from "node:assert/strict";
import {AVATAR_PACK_VERSION,STANDARD_AVATAR_URLS,standardAvatarURL,findFrontierGLB} from "../planet-explorer/frontier-glb.mjs";
import {parseFrontierRig} from "../planet-explorer/frontier-animated.mjs";
import {exportOriginalGLB} from "../original-assets/export.mjs";

test("standard avatars use deterministic, versioned shipped GLBs",()=>{
 assert.equal(STANDARD_AVATAR_URLS.male,"../original-assets/models/pioneer.glb");
 assert.equal(STANDARD_AVATAR_URLS.female,"../original-assets/models/scout.glb");
 assert.equal(standardAvatarURL("male","high"),standardAvatarURL("male","mobile"));
 assert.ok(standardAvatarURL("female").includes(AVATAR_PACK_VERSION));
 assert.throws(()=>standardAvatarURL("other"),/sex/);
});
test("standard GLB download never reads browser IndexedDB",async()=>{
 const oldFetch=globalThis.fetch,oldDB=globalThis.indexedDB;
 const generated=exportOriginalGLB("pioneer");
 let url="",cache="";
 try{
  globalThis.indexedDB={open(){throw Error("standard GLB must not read IndexedDB");}};
  globalThis.fetch=async (u,opts)=>{url=u;cache=opts.cache;return {ok:true,arrayBuffer:async()=>generated.buffer};};
  const result=await findFrontierGLB("male",{source:"standard",quality:"mobile",force:true});
  assert.equal(result.source,"standard");
  assert.equal(result.version,AVATAR_PACK_VERSION);
  assert.match(url,/pioneer\.glb/);
  assert.equal(cache,"reload");
 }finally{globalThis.fetch=oldFetch;globalThis.indexedDB=oldDB;}
});
test("original rigid GLBs calculate avatar height using world-space pivot transforms",()=>{
 for(const id of ["pioneer","scout"]){
  const rig=parseFrontierRig(exportOriginalGLB(id));
  assert.ok(rig.triangles>100);
  assert.ok(rig.bounds.max[1]-rig.bounds.min[1]>1.3);
  assert.ok(rig.scale>0&&rig.scale<3);
  assert.ok(rig.clips.some(c=>c.name==="walk"));
 }
});
