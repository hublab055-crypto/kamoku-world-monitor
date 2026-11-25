/** Visual mechanism playback in Asset Studio, source dimensions in mm and game coordinates in m.
 * No collision/contact forces, and no authoritative movement is applied to multiplayer world.
 */
import {evaluateMechanism,validateMechanism} from "../model-lab/cad/mechanism-core.mjs";

export function applyAssetMechanismPose(baseParts,source,timeSeconds,scale){
 if(!Array.isArray(baseParts)||!source||!Array.isArray(source.objects)||!Number.isFinite(scale)||scale<=0)
  throw Error("CAD運動データが不正です");
 const mechanism=validateMechanism(source.mechanism,source.objects);
 const moving=evaluateMechanism(source.objects,mechanism,timeSeconds);
 const initial=source.objects.filter(o=>o.kind!=="assembly");
 const after=moving.filter(o=>o.kind!=="assembly");
 if(baseParts.length!==initial.length||initial.length!==after.length)throw Error("CAD部品数が一致しません");
 return baseParts.map((base,i)=>{
  const from=initial[i],to=after[i];
  if(from.id!==to.id)throw Error("部品IDが一致しません");
  const part={...base};
  for(const [a,index] of [["x",0],["y",1],["z",2]]){
   part[a]=base[a]+(to.pos[index]-from.pos[index])*scale;
  }
  for(const [a,index] of [["rx",0],["ry",1],["rz",2]]){
   part[a]=base[a]+(to.rot[index]-from.rot[index])*Math.PI/180;
  }
  part.rotation=part.rz;
  return part;
 });
}
