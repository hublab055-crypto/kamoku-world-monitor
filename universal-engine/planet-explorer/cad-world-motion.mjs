/** Non-destructive owner-placed CAD prefab motion.
 * Computes prescribed movement only, not contact forces, friction or collisions.
 */
import {evaluateMechanism,validateMechanism} from "../model-lab/cad/mechanism-core.mjs";
const finite=Number.isFinite;
const degrees=Math.PI/180;
const geoShift=(p,x,z)=>{
 const lat=p.lat+z/111195;
 const c=Math.max(.01,Math.cos(p.lat*Math.PI/180));
 const lon=((p.lon+x/(111195*c)+540)%360)-180;
 return {lat,lon};
};
export function ownerMechanismPoseOverrides(owner,timeSeconds){
 const overrides=new Map();
 if(!owner||!finite(timeSeconds)||!Array.isArray(owner.prefabs)||!Array.isArray(owner.primitives))return overrides;
 const byGroup=new Map();
 for(const part of owner.primitives){
  if(typeof part.group!=="string")continue;
  if(!byGroup.has(part.group))byGroup.set(part.group,[]);
  byGroup.get(part.group).push(part);
 }
 for(const prefab of owner.prefabs){
  const motion=prefab.assetDocument?.cadMotion;
  if(!motion?.source?.mechanism?.joints?.length||!finite(motion.scale)||motion.scale<=0)continue;
  try{
   const source=motion.source;
   const joints=validateMechanism(source.mechanism,source.objects);
   const evaluated=evaluateMechanism(source.objects,joints,timeSeconds);
   const original=source.objects.filter(o=>o.kind!=="assembly");
   const moving=evaluated.filter(o=>o.kind!=="assembly");
   if(original.length!==prefab.parts.length||moving.length!==original.length)continue;
   for(const [group,parts] of byGroup){
    const suffix=group.startsWith(prefab.name+" #")?group.slice(prefab.name.length+2):null;
    if(group!==prefab.name&&!(suffix&&/^[0-9]+$/.test(suffix)))continue;
    if(parts.length!==original.length)continue;
    const sorted=[...parts].sort((a,b)=>a.id-b.id);
    const theta=(sorted[0].rz||0)-(prefab.parts[0].rz||0);
    const c=Math.cos(theta),s=Math.sin(theta);
    for(let i=0;i<sorted.length;i++){
     const initial=original[i],next=moving[i],part=sorted[i];
     if(initial.id!==next.id)continue;
     const dx=(next.pos[0]-initial.pos[0])*motion.scale,dy=(next.pos[1]-initial.pos[1])*motion.scale;
     const dEast=c*dx+s*dy,dNorth=-s*dx+c*dy;
     const geo=geoShift(part,dEast,dNorth);
     const result={...part,...geo,
      offsetY:part.offsetY+(next.pos[2]-initial.pos[2])*motion.scale,
      rx:(part.rx||0)+(next.rot[0]-initial.rot[0])*degrees,
      ry:(part.ry||0)+(next.rot[1]-initial.rot[1])*degrees,
      rz:(part.rz||0)+(next.rot[2]-initial.rot[2])*degrees};
     result.rotation=result.rz;overrides.set(part.id,result);
    }
   }
  }catch(_){/* Invalid sidecars leave the original prefab unchanged. */}
 }
 return overrides;
}
