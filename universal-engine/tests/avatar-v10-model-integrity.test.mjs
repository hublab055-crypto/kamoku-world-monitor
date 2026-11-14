import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {gunzipSync} from "node:zlib";
import {parseFrontierRig} from "../planet-explorer/frontier-animated.mjs";
import {isBodySurface} from "../planet-explorer/avatar-v10-body.mjs";

const ROOT=new URL("../original-assets/avatar-v10/",import.meta.url);
for(const model of ["lyra","mina","sera","ren","noah","elio"]){
 test("Adult V10 "+model+" exposes complete non-wardrobe skinned body",()=>{
  const gzip=readFileSync(new URL(model+".glb.gz",ROOT));
  const data=gunzipSync(gzip);
  const buffer=data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength);
  const rig=parseFrontierRig(buffer);
  const base=rig.primitives.filter(part=>!part.wardrobe);
  const body=base.filter(part=>isBodySurface(part.name,part.wardrobe));
  const named=Object.fromEntries(["base","swim"].map(mode=>[mode,
   rig.primitives.filter(p=>p.wardrobe?.includes(mode)).map(p=>({name:p.name,verts:p.arrays.positions.length/3}))]));
  console.log(model+" wardrobe mesh inventory "+JSON.stringify(named));
  assert.equal(rig.isV10,true);
  assert.ok(base.length>=3,"base needs face, trunk, limbs and more");
  assert.ok(body.some(p=>p.arrays.positions.length>300),"base skin surface must exist");
  assert.ok(named.base.length>0,"full base body mesh must exist");
  assert.ok(named.swim.length>0,"full dedicated swimsuit mesh must exist");
 });
}
