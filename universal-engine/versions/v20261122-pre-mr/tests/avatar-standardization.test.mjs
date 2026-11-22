import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {AVATAR_PACK_VERSION,STANDARD_AVATAR_URLS,standardAvatarURL,findFrontierGLB,effectiveAvatarQuality} from "../planet-explorer/frontier-glb.mjs";
import {readFrontierGLB,parseFrontierRig} from "../planet-explorer/frontier-animated.mjs";

const expected={
 male:{high:[58982,38146],mobile:[12244,4804]},
 female:{high:[61954,41118],mobile:[13524,6084]}
};
function localModel(sex,quality){
 const file=fileURLToPath(new URL("../original-assets/models/frontier_"+sex+"_"+quality+".glb",import.meta.url));
 const data=readFileSync(file);
 return data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength);
}
test("canonical URLs choose distinct published high/mobile assets",()=>{
 assert.equal(STANDARD_AVATAR_URLS.male.high,"../original-assets/models/frontier_male_high.glb");
 assert.equal(STANDARD_AVATAR_URLS.female.mobile,"../original-assets/models/frontier_female_mobile.glb");
 assert.equal(effectiveAvatarQuality("auto"),"mobile");
 assert.equal(standardAvatarURL("male","auto"),standardAvatarURL("male","mobile"));
 assert.notEqual(standardAvatarURL("male","high"),standardAvatarURL("male","mobile"));
 assert.ok(standardAvatarURL("female").includes(AVATAR_PACK_VERSION));
 assert.throws(()=>standardAvatarURL("other"),/sex/);
});
test("all four binary GLBs are valid, well-formed, and rigged with expected triangle counts",()=>{
 for(const sex of ["male","female"])for(const quality of ["high","mobile"]){
  const {json,binary}=readFrontierGLB(localModel(sex,quality));
  const triangles=json.meshes.reduce((count,m)=>count+m.primitives.reduce((sum,p)=>sum+json.accessors[p.indices].count/3,0),0);
  const head=json.meshes.find(m=>m.name==="rig_head");
  assert.ok(head,"head group must be present");
  const headTris=head.primitives.reduce((sum,p)=>sum+json.accessors[p.indices].count/3,0);
  assert.deepEqual([triangles,headTris],expected[sex][quality]);
  assert.ok(json.nodes.some(n=>n.name==="rightHand"));
  assert.ok(json.nodes.some(n=>n.name==="leftHand"));
  assert.deepEqual(json.animations.map(a=>a.name),["idle","walk","sword","axe","mine","talk","jump"]);
  assert.equal(json.extras.license,"CC0-1.0");
  assert.ok(binary.byteLength>200000);
 }
});
test("actual mobile and high-quality GLBs can be parsed by animated game renderer",()=>{
 for(const quality of ["mobile","high"]){
  const rig=parseFrontierRig(localModel("male",quality));
  assert.equal(rig.triangles,expected.male[quality][0]);
  assert.equal(rig.primitives.length,20);
  assert.ok(rig.scale>0&&rig.scale<3);
  assert.ok(rig.clips.some(c=>c.name==="walk"));
 }
});
test("network standard load ignores browser local imports and reloads requested quality",async()=>{
 const oldFetch=globalThis.fetch,oldDB=globalThis.indexedDB;
 const binary=localModel("male","high");
 let url="",cache="";
 try{
  globalThis.indexedDB={open(){throw Error("standard source must not read IndexedDB");}};
  globalThis.fetch=async (u,opts)=>{url=u;cache=opts.cache;return {ok:true,arrayBuffer:async()=>binary};};
  const asset=await findFrontierGLB("male",{quality:"high",source:"standard",force:true});
  assert.equal(asset.version,AVATAR_PACK_VERSION);
  assert.equal(asset.quality,"high");
  assert.match(url,/frontier_male_high\.glb/);
  assert.equal(cache,"reload");
 }finally{globalThis.fetch=oldFetch;globalThis.indexedDB=oldDB;}
});
test("high-quality HTTP failure falls back to versioned mobile GLB",async()=>{
 const oldFetch=globalThis.fetch;
 const mobile=localModel("female","mobile");
 const visited=[];
 try{
  globalThis.fetch=async url=>{
   visited.push(url);
   return url.includes("_high.glb")?{ok:false,status:503}:{ok:true,arrayBuffer:async()=>mobile};
  };
  const asset=await findFrontierGLB("female",{quality:"high"});
  assert.equal(asset.quality,"mobile");
  assert.match(asset.warning,/高精細版/);
  assert.deepEqual(visited.map(u=>u.match(/_(high|mobile)\.glb/)[1]),["high","mobile"]);
 }finally{globalThis.fetch=oldFetch;}
});
