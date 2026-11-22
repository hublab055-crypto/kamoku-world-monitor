import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {gunzipSync} from "node:zlib";
import {parseFrontierRig} from "../frontier-animated.mjs";
import {createAvatarV10ProceduralBody} from "../avatar-v10-procedural-body.mjs";

/** Asset-level smoke tests catch changed authoring rigs. Unit fixtures alone
 * cannot guarantee real V10 joints still match the procedural generator. */
for(const model of ["ren","lyra"]){
 test("real V10 "+model+" GLB provides a separate skinned human volume",async()=>{
  const bytes=gunzipSync(await readFile(new URL("../../original-assets/avatar-v10/"+model+".glb.gz",import.meta.url)));
  const rig=parseFrontierRig(bytes);
  assert.equal(rig.isV10,true);
  rig.studyModelBust=model==="lyra";
  const body=createAvatarV10ProceduralBody(rig,{resolution:.070});
  assert(body,"expected every shipped avatar to have the named body joints");
  assert.equal(body.proceduralAnatomy,true);
  assert(body.indices.length>1000);
  assert.equal(body.skin,0);
  assert(body.arrays.positions.every(Number.isFinite));
  assert(body.arrays.normals.every(Number.isFinite));
  assert(rig.primitives.some(p=>p.wardrobe?.includes("base")));
  const fitting=rig.primitives.find(p=>p.name==="Fitting body");
  if(fitting){
   // Generated vertices must not be copied from the old clothes-like proxy.
   assert.notDeepEqual(Array.from(body.arrays.positions.slice(0,36)),
    Array.from(fitting.arrays.positions.slice(0,36)));
  }
 });
}
