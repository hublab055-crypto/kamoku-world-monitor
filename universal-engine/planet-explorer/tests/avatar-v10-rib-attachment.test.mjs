import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {gunzipSync} from "node:zlib";
import {parseFrontierRig} from "../frontier-animated.mjs";
import {avatarV10Skeleton,avatarV10SkinWeights,createAvatarV10ProceduralBody} from "../avatar-v10-procedural-body.mjs";

for(const model of ["ren","lyra"]){
 test("real "+model+" keeps left and right lateral ribs attached to spine",()=>{
  const raw=gunzipSync(readFileSync(new URL("../../original-assets/avatar-v10/"+model+".glb.gz",import.meta.url)));
  const rig=parseFrontierRig(raw),parts=avatarV10Skeleton(rig);
  assert(parts);
  const p=parts.points;
  const shoulderY=(p.leftShoulder[1]+p.rightShoulder[1])*.5;
  const height=shoulderY-p.pelvis[1],centerX=(p.leftShoulder[0]+p.rightShoulder[0])*.5;
  const torso=new Set([parts.ids.pelvis,parts.ids.waist,parts.ids.chest]);
  for(const sign of [-1,1])for(const frac of [.52,.64,.73]){
   const y=p.pelvis[1]+height*frac;
   const z=p.pelvis[2]+(p.chest[2]-p.pelvis[2])*frac;
   const point=[centerX+sign*.195,y,z];
   const influence=avatarV10SkinWeights(point,parts);
   const total=influence.weights.reduce((a,b)=>a+b,0);
   assert(Math.abs(total-1)<1e-5,"skin weights must sum to one");
   let torsoWeight=0,armWeight=0;
   for(let i=0;i<4;i++){
    assert(Number.isFinite(influence.weights[i]));
    if(torso.has(influence.joints[i]))torsoWeight+=influence.weights[i];
    if([parts.ids.leftShoulder,parts.ids.rightShoulder,parts.ids.leftElbow,parts.ids.rightElbow].includes(influence.joints[i]))
     armWeight+=influence.weights[i];
   }
   assert(torsoWeight>.95 && armWeight<.05,
     model+" "+JSON.stringify({sign,frac,point,torsoWeight,armWeight}));
  }
  // Original arm chain must remain functional well outside the trunk.
  const forearm=avatarV10SkinWeights(p.leftElbow,parts);
  assert(forearm.joints.some((id,i)=>
   forearm.weights[i]>.2 && [parts.ids.leftShoulder,parts.ids.leftElbow,parts.ids.leftWrist].includes(id)));
  const mesh=createAvatarV10ProceduralBody(rig,{resolution:.070});
  assert(mesh && mesh.indices.length>1000);
  const w=mesh.arrays.weights;
  for(let i=0;i<w.length;i+=4)assert(Math.abs(w[i]+w[i+1]+w[i+2]+w[i+3]-1)<1e-4);
 });
}
