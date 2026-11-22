/** Adapted from uploaded avator-mod.zip/avatar-deformation.js.
 * Retains the original masks, landmarks, ratios and displacements. Compact
 * GLB face nodes store head position as normalized height, so subtract 1.60
 * from that coordinate when using the original head-relative equations.
 */
import {normalizeAppearance} from "./avatar-review-parameters.mjs?v=20261114-original";
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const gaussian=(x,y)=>Math.exp(-x*x-y*y);
const smooth=v=>{const t=clamp(v,0,1);return t*t*(3-2*t);};
function point(x,y,z,shape,female,earMesh){
 const size=name=>(shape[name+"Size"]-100)/100;
 const delta=name=>(shape[name]-50)/50;
 const side=Math.sign(x),ax=Math.abs(x);
 let dx=0,dy=0,dz=0;
 if(earMesh){
  const mask=smooth((ax-.063)/.030)*(1-smooth((Math.abs(y-.017)-.032)/.017));
  const e=y-.017,ear=size("ear"),round=delta("earShape");
  dx+=mask*side*(.014*delta("earSpread")+.85*ear*(ax-(female?.097:.104))-
   .012*round*smooth(e/.032));
  dy+=mask*(e*ear+.014*delta("earPosition")-.007*round*smooth(e/.032));
  dz+=mask*ear*(z+.016);
  return [x+dx,y+dy,z+dz];
 }
 const front=smooth((z-.040)/.065);
 if(!front)return [x,y,z];
 const lateral=ax-(female?.046:.048);
 const eyeMask=gaussian(lateral/.036,(y-.048)/.016);
 const browMask=gaussian((lateral-.002)/.034,(y-.072)/.0105);
 const bridge=gaussian(ax/.016,(y-.031)/.036);
 const tip=gaussian(ax/.023,(y-.001)/.019);
 const lips=gaussian(ax/.043,(y+.040)/.017);
 dx+=front*(side*(eyeMask*(1.22*lateral*size("eye")+.011*delta("eyeSpacing"))+
  browMask*lateral*size("brow")*1.18+
  .64*tip*ax*(size("nose")+.62*delta("noseShape")))+lips*x*size("mouth")*1.28);
 dy+=front*(eyeMask*(size("eye")*(y-.048)*1.58+.010*delta("eyePosition")+
  .22*lateral*delta("eyeShape"))+
  browMask*(size("brow")*(y-.072)*1.6+delta("browShape")*
  (.004-.007*Math.min(1,(lateral/.026)**2)))+
  (.66*tip+.34*bridge)*.013*delta("nosePosition")+
  lips*(.011*delta("mouthPosition")+(y+.040)*(size("mouth")+.57*delta("mouthShape"))));
 dz+=front*(bridge*(.020*delta("noseHeight")+.004*size("nose"))+
  tip*(.011*size("nose")+.007*delta("noseShape")+.006*delta("noseHeight"))+
  lips*.0028*delta("mouthShape"));
 const fw=(shape.faceWidth-100)/100,fl=(shape.faceLength-100)/100,fs=(shape.faceShape-50)/50;
 const faceMask=front*(1-smooth((y-.095)/.09));
 const jaw=gaussian((ax-.069)/.066,(y+.071)/.059);
 const cheek=gaussian((ax-.068)/.059,(y+.011)/.044);
 dx+=x*faceMask*(.91*fw+fs*(.19*jaw+.056*cheek));
 dy+=faceMask*(.57*fl*y-.0068*fs*jaw);
 dz+=faceMask*(fs*(.007*cheek-.004*jaw)+.025*fw*cheek);
 return [x+dx,y+dy,z+dz];
}
function normalRebuild(position,indices,normals){
 normals.fill(0);
 for(let i=0;i<indices.length;i+=3){
  const a=indices[i]*3,b=indices[i+1]*3,c=indices[i+2]*3;
  const ux=position[b]-position[a],uy=position[b+1]-position[a+1],uz=position[b+2]-position[a+2];
  const vx=position[c]-position[a],vy=position[c+1]-position[a+1],vz=position[c+2]-position[a+2];
  const x=uy*vz-uz*vy,y=uz*vx-ux*vz,z=ux*vy-uy*vx;
  for(const k of [a,b,c]){normals[k]+=x;normals[k+1]+=y;normals[k+2]+=z;}
 }
 for(let i=0;i<normals.length;i+=3){
  const l=Math.hypot(normals[i],normals[i+1],normals[i+2])||1;
  normals[i]/=l;normals[i+1]/=l;normals[i+2]/=l;
 }
}
export function deformAvatarReviewFace(source,settings,landmarks,female=false){
 if(!["Face and skull","Eyes, brows and lips","Neck and ears"].includes(source?.name))return null;
 if(!landmarks?.length)return null;
 const shape=normalizeAppearance(settings);
 const a=source.arrays,scale=landmarks[0],lift=landmarks[1];
 if(!(scale>0))return null;
 const remap=(x,y,z,index)=>{
  // Original face sculpt uses head-local Y and world-space Z. V10 compact
  // coordinates have a 1.60m body-height offset.
  const hx=x/scale,hy=y/scale-lift-1.60,hz=z/scale;
  const ear=source.name==="Neck and ears"&&index>=240;
  const p=point(hx,hy,hz,shape,female,ear);
  return [p[0]*scale,(p[1]+1.60+lift)*scale,p[2]*scale];
 };
 const positions=new Float32Array(a.positions.length),normals=new Float32Array(a.normals.length);
 const morphs=["morph0","morph1"].slice(0,source.names.length);
 const out={positions,normals};
 morphs.forEach(k=>out[k]=new Float32Array(positions.length));
 for(let i=0;i<positions.length;i+=3){
  const base=remap(a.positions[i],a.positions[i+1],a.positions[i+2],i/3);
  positions.set(base,i);
  for(const key of morphs){
   const delta=a[key];
   const altered=remap(a.positions[i]+delta[i],a.positions[i+1]+delta[i+1],a.positions[i+2]+delta[i+2],i/3);
   for(let axis=0;axis<3;axis++)out[key][i+axis]=altered[axis]-base[axis];
  }
 }
 normalRebuild(positions,source.indices,normals);
 return out;
}
