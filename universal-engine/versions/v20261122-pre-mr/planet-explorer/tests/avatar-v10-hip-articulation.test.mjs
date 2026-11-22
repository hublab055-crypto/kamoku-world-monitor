import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {gunzipSync} from "node:zlib";
import {parseFrontierRig} from "../frontier-animated.mjs";
import {avatarV10Skeleton,avatarV10BodyField,avatarV10SkinWeights,createAvatarV10ProceduralBody}
 from "../avatar-v10-procedural-body.mjs";

const rigFor=model=>parseFrontierRig(gunzipSync(readFileSync(
 new URL("../../original-assets/avatar-v10/"+model+".glb.gz",import.meta.url))));
function influenceAt(point,parts){
 const data=avatarV10SkinWeights(point,parts),sum=data.weights.reduce((a,b)=>a+b,0);
 assert(Math.abs(sum-1)<1e-5,"weights sum to one");
 assert(data.weights.every(w=>Number.isFinite(w)&&w>=0&&w<=1));
 return new Map(data.joints.map((id,i)=>[id,data.weights[i]]));
}

for(const model of ["ren","lyra"]){
 test(model+": hip surface joins pelvis to upper thigh without puncture",()=>{
  const rig=rigFor(model),parts=avatarV10Skeleton(rig);assert(parts);
  const p=parts.points,f=avatarV10BodyField(parts,model==="lyra",{includeAuthoredHands:true,includeAuthoredFeet:true});
  for(const side of ["left","right"]){
   const hip=p[side+"Hip"];
   for(const offset of [[0,0,0],[0,-.065,.027],[0,-.098,0]]){
    const pt=hip.map((n,i)=>n+offset[i]);
    assert(f(pt)<0,side+" hip inner surface must be continuous "+pt);
   }
   // A point beyond the front of the thigh must remain outside the mesh.
   assert(f([hip[0],hip[1]-.065,hip[2]+.26])>0,"hip depth excessive");
  }
  const mesh=createAvatarV10ProceduralBody(rig,{resolution:.070});
  assert(mesh?.indices.length>1000);
  assert(mesh.arrays.positions.every(Number.isFinite));
  assert(mesh.arrays.normals.every(Number.isFinite));
 });
 test(model+": upper thigh smoothly transfers weight from pelvis to corresponding femur",()=>{
  const rig=rigFor(model),parts=avatarV10Skeleton(rig);assert(parts);
  const p=parts.points,ids=parts.ids;
  for(const side of ["left","right"]){
   const other=side==="left"?"right":"left",hip=p[side+"Hip"];
   const upper=influenceAt([hip[0],hip[1]+.025,hip[2]],parts);
   const lower=influenceAt([hip[0],hip[1]-.065,hip[2]],parts);
   const hipID=ids[side+"Hip"];
   assert((upper.get(ids.pelvis)||0)>.45,side+" hip must connect to pelvis");
   assert((lower.get(hipID)||0)>(upper.get(hipID)||0)+.20,
    side+" leg motion should increasingly follow its femur");
   assert((upper.get(ids[other+"Hip"])||0)<.05,side+" hip affected by opposite leg");
   assert((lower.get(ids[other+"Hip"])||0)<.05,side+" thigh affected by opposite leg");
   for(const t of [0,.25,.5,.75,1]){
    const v=influenceAt([hip[0],hip[1]+.025-t*.09,hip[2]],parts);
    assert((v.get(hipID)||0)<=1.00001);
   }
  }
 });
}
