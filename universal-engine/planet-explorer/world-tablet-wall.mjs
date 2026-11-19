/**
 * Universal Engine building-wall screen. The projection is a DOM iframe
 * composed over the WebGL canvas, NOT a sampled cross-origin video texture.
 * A facade is resolved from actual player construction/owner building meshes.
 */
import {FACILITIES} from "./construction-system.mjs";
import {OWNER_FACILITIES} from "./owner-world.mjs";
import {geoLocal,terrainSurface} from "./geo.mjs";
export const WALL_SCREEN_STORAGE_KEY="universal-engine:tablet:mounted-screen:v1";
const MAX_DISTANCE=24,MAX_SITES=3600;
const FINITE=Number.isFinite;
const validGeo=g=>g&&FINITE(g.lat)&&FINITE(g.lon)&&Math.abs(g.lat)<=90&&Math.abs(g.lon)<=180;
const finiteSite=s=>s&&[s.x,s.y,s.z,s.rotation,s.halfX,s.halfZ].every(FINITE)&&s.halfX>0&&s.halfZ>0;
const SIDE_YAW={front:0,back:Math.PI,right:Math.PI/2,left:-Math.PI/2};

export function candidateWallSites(renderer,controller){
 if(!renderer||!controller||!validGeo(controller.origin))return [];
 const raw=[],sceneId=String(renderer.planet?.id||"");
 for(const site of renderer.constructionSystem?.structures||[]){
  if(!site||!FINITE(site.id)||!FINITE(site.x)||!FINITE(site.z)||!FINITE(site.height))continue;
  const config=FACILITIES[site.kind],stone=site.kind==="stone-wall";
  if(!stone&&!config)continue;
  const halfX=stone?1.05:config.footprint*.48,halfZ=stone?.40:config.footprint*.38;
  raw.push({scope:"construction",id:site.id,kind:site.kind,x:site.x,y:site.height,z:site.z,
   rotation:FINITE(site.rotation)?site.rotation:0,halfX,halfZ,planetId:sceneId});
 }
 for(const site of renderer.ownerWorld?.buildings||[]){
  const config=FACILITIES[site.kind]||OWNER_FACILITIES[site.kind];
  if(!site||!config||!validGeo(site))continue;
  const position=geoLocal(controller.origin.lat,controller.origin.lon,site.lat,site.lon,renderer.planet?.radiusM||6371000);
  const ground=renderer.terrain?terrainSurface(renderer.terrain,site.lat,site.lon):null;
  if(!FINITE(position.eastM)||!FINITE(position.northM)||!FINITE(ground?.elevationM))continue;
  raw.push({scope:"owner",id:site.id,kind:site.kind,x:position.eastM,y:ground.elevationM,z:position.northM,
   rotation:FINITE(site.rotation)?site.rotation:0,halfX:config.footprint*.48,halfZ:config.footprint*.38,
   planetId:sceneId});
 }
 return raw.slice(0,MAX_SITES).filter(finiteSite);
}

/** Choose the facade that actually faces the character; corner geometry
 * matches the existing placedBuildingGeometry() rotations and dimensions. */
export function facadeForSite(site,viewer,side=null){
 if(!finiteSite(site)||!viewer||![viewer.x,viewer.z].every(FINITE))return null;
 const choices=Object.entries(SIDE_YAW).map(([key,turn])=>{
  const yaw=site.rotation+turn,nx=Math.sin(yaw),nz=Math.cos(yaw);
  const distance=(viewer.x-site.x)*nx+(viewer.z-site.z)*nz;
  return {key,yaw,nx,nz,distance};
 });
 const chosen=side?choices.find(c=>c.key===side):choices.reduce((a,b)=>b.distance>a.distance?b:a);
 if(!chosen)return null;
 const isWidthZ=chosen.key==="right"||chosen.key==="left";
 const half=isWidthZ?site.halfZ:site.halfX;
 const width=site.kind==="stone-wall"?Math.min(1.6,half*1.64):Math.min(3.1,half*1.7);
 const height=width*9/16;
 const elevation=site.kind==="stone-wall"?1.02:2.28;
 const offset=(isWidthZ?site.halfX:site.halfZ)+(site.kind==="stone-wall"?.045:.20);
 return {
  scope:site.scope,id:site.id,kind:site.kind,side:chosen.key,planetId:site.planetId,
  x:site.x+chosen.nx*offset,y:site.y+elevation,z:site.z+chosen.nz*offset,
  normal:[chosen.nx,0,chosen.nz],
  right:[Math.cos(chosen.yaw),0,-Math.sin(chosen.y)],
  width,height
 };
}

export function nearestBuildingWall(renderer,controller,maxDistance=MAX_DISTANCE){
 if(!controller||!FINITE(controller.x)||!FINITE(controller.z))return null;
 let best=null,bestDistance=Math.min(MAX_DISTANCE,Math.max(1,maxDistance));
 for(const site of candidateWallSites(renderer,controller)){
  const distance=Math.hypot(site.x-controller.x,site.z-controller.z);
  if(distance>bestDistance)continue;
  const facade=facadeForSite(site,controller);
  if(!facade)continue;
  const normalDot=(controller.x-facade.x)*facade.normal[0]+(controller.z-facade.z)*facade.normal[2];
  if(normalDot<=.1)continue;
  best={facade,placement:{
   scope:site.scope,id:site.id,side:facade.side,kind:site.kind,
   planetId:site.planetId,origin:[controller.origin.lat,controller.origin.lon]
  },distance};
  bestDistance=distance;
 }
 return best;
}

export function sanitizeMountedWall(raw){
 let v=raw;
 try{if(typeof v==="string")v=JSON.parse(v);}
 catch(_){return null;}
 if(!v||!["construction","owner"].includes(v.scope)||!Number.isSafeInteger(v.id)||v.id<1||
  !Object.hasOwn(SIDE_YAW,v.side)||typeof v.planetId!=="string"||v.planetId.length>60||
  !Array.isArray(v.origin)||v.origin.length!==2||!v.origin.every(FINITE)||
  Math.abs(v.origin[0])>90||Math.abs(v.origin[1])>180)return null;
 return {scope:v.scope,id:v.id,side:v.side,planetId:v.planetId,origin:v.origin.slice()};
}

export function resolveMountedWall(placement,renderer,controller){
 const p=sanitizeMountedWall(placement);
 if(!p||!renderer||!controller||!validGeo(controller.origin)||String(renderer.planet?.id||"")!==p.planetId||
  Math.abs(p.origin[0]-controller.origin.lat)>1e-6||Math.abs(p.origin[1]-controller.origin.lon)>1e-6)return null;
 const site=candidateWallSites(renderer,controller).find(s=>s.scope===p.scope&&s.id===p.id);
 return site?facadeForSite(site,controller,p.side):null;
}

export function projectedWallCorners(facade,vp,offsetX,offsetY,width,height,originX=0,originZ=0){
 if(!facade||!vp||vp.length!==16||![offsetX,offsetY,width,height,originX,originZ].every(FINITE)||
  !(width>0&&height>0))return null;
 const corners=[];
 for(const [side,up]of [[-1,1],[1,1],[1,-1],[-1,-1]]){
  const rx=side*facade.width/2,ry=up*facade.height/2;
  const wx=facade.x+facade.right[0]*rx-originX,wz=facade.z+facade.right[2]*rx-originZ,wy=facade.y+ry;
  const w=vp[3]*wx+vp[7]*wy+vp[11]*wz+vp[15];
  if(!(w>.01)||!FINITE(w))return null;
  const clipX=vp[0]*wx+vp[4]*wy+vp[8]*wz+vp[12];
  const clipY=vp[1]*wx+vp[5]*wy+vp[9]*wz+vp[13];
  corners.push([offsetX+(.5+.5*clipX/w)*width,offsetY+(.5-.5*clipY/w)*height]);
 }
 const xs=corners.map(c=>c[0]),ys=corners.map(c=>c[1]);
 if(Math.max(...xs)<offsetX||Math.min(...xs)>offsetX+width||
  Math.max(...ys)<offsetY||Math.min(...ys)>offsetY+height)return null;
 // Screen is too edge-on, far away, or warped.
 const area=Math.abs(corners.reduce((sum,p,i)=>{
  const q=corners[(i+1)%4];return sum+p[0]*q[1]-q[0]*p[1];
 },0)/2);
 return area>=350?corners:null;
}

/** Four-corner projective mapping; returns CSS3D column-major matrix to map
 * original 960×540 iframe pixels to the perspective projected quadrilateral.
 * No pixel reads from the foreign iframe are involved.
 */
export function perspectiveCssMatrix(corners,srcWidth=960,srcHeight=540){
 if(!Array.isArray(corners)||corners.length!==4||!(srcWidth>0&&srcHeight>0))return null;
 const points=[[0,0],[1,0],[1,1],[0,1]];
 const A=[];
 for(let i=0;i<4;i++){
  const [u,v]=points[i],[x,y]=corners[i];
  if(![x,y].every(FINITE))return null;
  A.push([u,v,1,0,0,0,-u*x,-v*x,x]);
  A.push([0,0,0,u,v,1,-u*y,-v*y,y]);
 }
 // Deterministic 8x8 Gaussian elimination with partial pivoting.
 for(let c=0;c<8;c++){
  let pivot=c;
  for(let r=c+1;r<8;r++)if(Math.abs(A[r][c])>Math.abs(A[pivot][c]))pivot=r;
  if(Math.abs(A[pivot][c])<1e-9)return null;
  [A[c],A[pivot]]=[A[pivot],A[c]];
  const scale=A[c][c];
  for(let j=c;j<=8;j++)A[c][j]/=scale;
  for(let r=0;r<8;r++)if(r!==c){
   const f=A[r][c];
   for(let j=c;j<=8;j++)A[r][j]-=f*A[c][j];
  }
 }
 const [a,b,c,d,e,f,g,h]=A.map(row=>row[8]);
 const matrix=[
  a/srcWidth,d/srcWidth,0,g/srcWidth,
  b/srcHeight,e/srcHeight,0,h/srcHeight,
  0,0,1,0,
  c,f,0,1
 ];
 return matrix.every(FINITE)?"matrix3d("+matrix.join(",")+")":null;
}
