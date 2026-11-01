/**
 * Rebase-safe musical stage: persistent planetary coordinates, render-only
 * procedural geometry and opt-in Quest ray selection. All geometry is meters.
 * No imports from the renderer or world simulation.
 */
import {GUITAR_OPEN_NOTES} from "./music-core.mjs";
export const MUSIC_WORLD_FORMAT="ue/music-world-stage";
export const MUSIC_KEY_Y=1.02;
export const MUSIC_GUITAR_Y=1.20;
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
const builder=()=>({positions:[],normals:[],colors:[],indices:[]});
function box(g,x,y,z,hx,height,hz,color){
 const verts=[
 [x-hx,y,z-hz],[x+hx,y,z-hz],[x+hx,y+height,z-hz],[x-hx,y+height,z-hz],
 [x-hx,y,z+hz],[x+hx,y,z+hz],[x+hx,y+height,z+hz],[x-hx,y+height,z+hz]];
 for(const quad of [[0,1,2,3],[4,7,6,5],[0,4,5,1],[3,2,6,7],[1,5,6,2],[4,0,3,7]]){
  const tris=[[quad[0],quad[1],quad[2]],[quad[0],quad[2],quad[3]]];
  for(const [a,b,c] of tris){
   const A=verts[a],B=verts[b],C=verts[c],u=B.map((v,i)=>v-A[i]),v=C.map((v,i)=>v-A[i]);
   const n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
   const l=Math.hypot(...n)||1,k=g.positions.length/3;
   for(const p of [A,B,C]){g.positions.push(...p);g.normals.push(...n.map(q=>q/l));g.colors.push(...color);}
   g.indices.push(k,k+1,k+2);
  }
 }
}
/** Piano plus acoustic-guitar-inspired physical prop. No external assets. */
export function musicStageGeometry(controls=null){
 if(Array.isArray(controls)&&controls.length){
  const g=builder();
  for(const control of controls){
   const color=control.kind==="string"?[.82,.70,.41]:control.kind==="button"?[.26,.69,.72]:[.89,.87,.78];
   box(g,control.x,control.y,control.z,control.width/2,control.height,control.depth/2,color);
  }
  return g;
 }
 const g=builder(),wood=[.31,.19,.12],dark=[.11,.14,.19],light=[.90,.91,.85];
 // The piano: supports and contrasting 13 semitone pads.
 box(g,0,.66,-.06,.89,.32,.48,wood);
 box(g,0,.86,.23,.88,.38,.14,dark);
 for(const x of [-.65,.65])for(const z of [-.31,.29])
  box(g,x,0,z,.065,.69,.07,wood);
 for(let n=0;n<13;n++){
  const pitch=60+n,x=-.75+n*.125;
  const black=[1,3,6,8,10].includes(pitch%12);
  box(g,x,.99,black?-.23:-.10,.058,black?.07:.025,black?.20:.32,black?dark:light);
 }
 // Guitar on a stand, neck extends +Z; strumming zone nearest the player.
 box(g,1.54,0,.07,.038,.98,.04,dark);
 box(g,1.54,.74,.02,.37,.31,.23,[.59,.30,.14]);
 box(g,1.54,.85,.09,.20,.09,.19,[.34,.18,.10]);
 box(g,1.54,.82,.42,.13,.23,.48,[.42,.23,.13]);
 box(g,1.54,1.04,.88,.15,.16,.13,wood);
 for(let i=0;i<6;i++){
  const x=1.24+i*.12;
  box(g,x,1.17,.04,.005,.005,.51,[.86,.84,.70]);
 }
 // Music stand with sheet-like face.
 box(g,-1.33,0,.28,.035,1.16,.035,dark);
 box(g,-1.33,1.00,.31,.39,.37,.035,[.18,.23,.28]);
 box(g,-1.33,1.05,.35,.32,.28,.006,[.82,.78,.64]);
 return g;
}
const VALID_ITEMS=new Set(["music-stage","music-keyboard","music-guitar","music-drums","music-custom"]);
function normalizedControls(raw){
 if(raw==null)return [];
 if(!Array.isArray(raw)||raw.length>80)throw Error("演奏部品の数が不正です");
 return raw.map(control=>{
  if(!["key","button","string"].includes(control?.kind)||
   !["keys","guitar","bass","drums"].includes(control.track)||
   !Number.isInteger(control.pitch)||control.pitch<28||control.pitch>96||
   ![control.x,control.y,control.z,control.width,control.height,control.depth].every(Number.isFinite)||
   [control.x,control.z].some(v=>Math.abs(v)>12)||control.y<0||control.y>8||
   [control.width,control.height,control.depth].some(v=>v<.1||v>4))throw Error("楽器パーツ情報が不正です");
  return {kind:control.kind,track:control.track,pitch:control.pitch,
   x:control.x,y:control.y,z:control.z,width:control.width,height:control.height,depth:control.depth};
 });
}
export function normalizeMusicStage(raw){
 if(!raw||raw.format!==MUSIC_WORLD_FORMAT||raw.version!==1||
  typeof raw.planetId!=="string"||raw.planetId.length>64||
  ![raw.lat,raw.lon,raw.yaw,raw.heightM].every(Number.isFinite)||
  Math.abs(raw.lat)>90||Math.abs(raw.lon)>180||
  Math.abs(raw.yaw)>Math.PI*2||raw.heightM< -12000||raw.heightM>12000)
  throw Error("楽器の設置データが不正です");
 const item=raw.item||"music-stage";
 if(!VALID_ITEMS.has(item))throw Error("不明な楽器種別です");
 const controls=normalizedControls(raw.controls);
 if(item==="music-custom"&&!controls.length)throw Error("自作楽器には音が鳴るパーツが必要です");
 return {format:MUSIC_WORLD_FORMAT,version:1,planetId:raw.planetId,
  lat:raw.lat,lon:raw.lon,yaw:raw.yaw,heightM:raw.heightM,item,controls,owned:raw.owned===true};
}
export function newMusicStage({planetId,lat,lon,yaw,heightM,item="music-stage",controls=[]}){
 return normalizeMusicStage({format:MUSIC_WORLD_FORMAT,version:1,planetId,lat,lon,yaw,heightM,item,controls});
}
/** Inverse-transform controller rays to the instrument's plane. The stage
 * matrix maps avatar-relative world metres into XR tracking coordinates.
 * localOffset = instrument origin relative to the avatar (x, y, z).
 * This only consumes rays that actually touch the musical stage.
 */
export function musicStageRayHit(rayMatrix,xrStageMatrix,localOffset,yaw,{maxReach=2.6,controls=[]}={}){
 if(!rayMatrix||!xrStageMatrix||!localOffset)return null;
 const origin=[rayMatrix[12]-xrStageMatrix[12],rayMatrix[13]-xrStageMatrix[13],rayMatrix[14]-xrStageMatrix[14]];
 const forward=[-rayMatrix[8],-rayMatrix[9],-rayMatrix[10]];
 const world=(v)=>[
  (v[0]*xrStageMatrix[0]+v[1]*xrStageMatrix[1]+v[2]*xrStageMatrix[2]),
  (v[0]*xrStageMatrix[4]+v[1]*xrStageMatrix[5]+v[2]*xrStageMatrix[6]),
  (v[0]*xrStageMatrix[8]+v[1]*xrStageMatrix[9]+v[2]*xrStageMatrix[10])
 ];
 const from=world(origin),dir=world(forward);
 if(!(dir[1]<-.12))return null; // play by pointing down, not through the side
 const c=Math.cos(yaw),s=Math.sin(yaw);
 if(controls.length)for(const control of controls){
  const t=(localOffset[1]+control.y+control.height-from[1])/dir[1];
  if(t<=0||t>maxReach)continue;
  const wx=from[0]+dir[0]*t-localOffset[0],wz=from[2]+dir[2]*t-localOffset[2];
  const x=c*wx-s*wz,z=s*wx+c*wz;
  if(Math.abs(x-control.x)<=control.width/2&&Math.abs(z-control.z)<=control.depth/2)
   return {track:control.track,pitch:control.pitch,distanceM:t};
 }
 if(controls.length)return null;
 for(const surface of [{kind:"keys",y:MUSIC_KEY_Y},{kind:"guitar",y:MUSIC_GUITAR_Y}]){
  const t=(localOffset[1]+surface.y-from[1])/dir[1];
  if(t<=0||t>maxReach)continue;
  const wx=from[0]+dir[0]*t-localOffset[0];
  const wz=from[2]+dir[2]*t-localOffset[2];
  const x=c*wx-s*wz,z=s*wx+c*wz;
  if(controls.length)continue;
  if(surface.kind==="keys"&&x>=-.83&&x<=.83&&z>=-.46&&z<=.23){
   const i=clamp(Math.floor((x+.81)/.125),0,12);
   return {track:"keys",pitch:60+i,distanceM:t};
  }
  if(surface.kind==="guitar"&&x>=1.18&&x<=1.90&&z>=-.35&&z<=.58){
   const stringIndex=clamp(Math.floor((x-1.18)/.12),0,5);
   return {track:"guitar",pitch:GUITAR_OPEN_NOTES[5-stringIndex],distanceM:t};
  }
 }
 return null;
}

/** Touch-key collision against tracked Quest hand/grip pose in XR metres.
 * A small forward offset approximates the index-finger/contact point.
 * Tracking gaps return null instead of replaying stale hand coordinates.
 */
export function musicStageHandHit(handMatrix,xrStageMatrix,localOffset,yaw,{tolerance=.12,controls=[]}={}){
 if(!handMatrix||!xrStageMatrix||!localOffset)return null;
 const physical=[
  handMatrix[12]-handMatrix[8]*.06-xrStageMatrix[12],
  handMatrix[13]-handMatrix[9]*.06-xrStageMatrix[13],
  handMatrix[14]-handMatrix[10]*.06-xrStageMatrix[14]
 ];
 const projected=[
  physical[0]*xrStageMatrix[0]+physical[1]*xrStageMatrix[1]+physical[2]*xrStageMatrix[2]-localOffset[0],
  physical[0]*xrStageMatrix[4]+physical[1]*xrStageMatrix[5]+physical[2]*xrStageMatrix[6]-localOffset[1],
  physical[0]*xrStageMatrix[8]+physical[1]*xrStageMatrix[9]+physical[2]*xrStageMatrix[10]-localOffset[2]
 ];
 const c=Math.cos(yaw),sn=Math.sin(yaw);
 const x=c*projected[0]-sn*projected[2],z=sn*projected[0]+c*projected[2];
 if(controls.length){
  for(const control of controls){
   if(Math.abs(projected[1]-(control.y+control.height))<tolerance&&
      Math.abs(x-control.x)<=control.width/2&&Math.abs(z-control.z)<=control.depth/2)
    return {track:control.track,pitch:control.pitch};
  }
  return null;
 }
 if(Math.abs(projected[1]-MUSIC_KEY_Y)<tolerance&&
    x>=-.83&&x<=.83&&z>=-.46&&z<=.23)
  return {track:"keys",pitch:60+clamp(Math.floor((x+.81)/.125),0,12)};
 if(Math.abs(projected[1]-MUSIC_GUITAR_Y)<tolerance&&
    x>=1.18&&x<=1.90&&z>=-.35&&z<=.58)
  return {track:"guitar",pitch:GUITAR_OPEN_NOTES[5-clamp(Math.floor((x-1.18)/.12),0,5)]};
 return null;
}
