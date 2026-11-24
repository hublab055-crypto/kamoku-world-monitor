/** XR command geometry and bounded MR navigation. All points are expressed
 * in metres, no raw camera data, no persistent XR tracking matrices. */
const finite=n=>typeof n==="number"&&Number.isFinite(n);
const dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
export function groundRayHit(matrix,floorY=0,maxDistance=12){
 if(!matrix||matrix.length!==16||![8,9,10,12,13,14].every(i=>finite(matrix[i]))||!finite(floorY))return null;
 const direction=[-matrix[8],-matrix[9],-matrix[10]];
 if(direction[1]>=-.025)return null;
 const t=(floorY-matrix[13])/direction[1];
 if(!(t>.05&&t<=maxDistance))return null;
 return {x:matrix[12]+direction[0]*t,z:matrix[14]+direction[2]*t,y:floorY,distanceM:t};
}
export function stageGroundToWorld(hit,stage,controller){
 if(!hit||!stage||!controller||![controller.x,controller.z].every(finite))return null;
 // xrStage maps world metres into headset metres. Dot onto its horizontal basis,
 // including the scale of its RTS miniature representation.
 const sx=stage[0],sz=stage[2],tx=stage[8],tz=stage[10],dx=hit.x-stage[12],dz=hit.z-stage[14];
 const determinant=sx*tz-sz*tx;
 if(!finite(determinant)||Math.abs(determinant)<1e-9)return null;
 const x=(dx*tz-dz*tx)/determinant,z=(sx*dz-sz*dx)/determinant;
 return {x:controller.x+x,z:controller.z+z};
}
export function validBoundary(points){
 if(!Array.isArray(points)||points.length<3||points.length>24)return false;
 if(!points.every(p=>p&&finite(p.x)&&finite(p.z)&&Math.abs(p.x)<50&&Math.abs(p.z)<50))return false;
 const area=Math.abs(points.reduce((n,p,i)=>n+p.x*points[(i+1)%points.length].z-p.z*points[(i+1)%points.length].x,0))/2;
 if(area<.35)return false;
 const cross=(a,b,c)=>(b.x-a.x)*(c.z-a.z)-(b.z-a.z)*(c.x-a.x);
 const hit=(a,b,c,d)=>{const aa=cross(a,b,c),bb=cross(a,b,d),cc=cross(c,d,a),dd=cross(c,d,b);return aa*bb<0&&cc*dd<0;};
 for(let i=0;i<points.length;i++)for(let j=i+1;j<points.length;j++){
  if(j===i+1||(i===0&&j===points.length-1))continue;
  if(hit(points[i],points[(i+1)%points.length],points[j],points[(j+1)%points.length]))return false;
 }
 return true;
}
export function boundaryContains(points,p,clearance=.22){
 if(!validBoundary(points)||!p||!finite(p.x)||!finite(p.z))return false;
 let inside=false;
 for(let i=0,j=points.length-1;i<points.length;j=i++){
  const a=points[i],b=points[j];
  const dx=b.x-a.x,dz=b.z-a.z;
  const t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.z-a.z)*dz)/(dx*dx+dz*dz||1)));
  if(Math.hypot(a.x+dx*t-p.x,a.z+dz*t-p.z)<clearance)return false;
  if((a.z>p.z)!==(b.z>p.z)&&p.x<(b.x-a.x)*(p.z-a.z)/(b.z-a.z)+a.x)inside=!inside;
 }
 return inside;
}
export function boundaryPathClear(points,start,end,clearance=.28){
 if(!boundaryContains(points,start,clearance)||!boundaryContains(points,end,clearance))return false;
 const length=dist(start,end),steps=Math.ceil(length/.12);
 for(let i=1;i<steps;i++){
  const t=i/steps;
  if(!boundaryContains(points,{x:start.x+(end.x-start.x)*t,z:start.z+(end.z-start.z)*t},clearance))return false;
 }
 return true;
}
export function safeMoveTarget(room,start,destination,{radius=.28}={}){
 if(!room?.ready||!room.navigationBoundary?.length)return {ok:false,reason:"移動可能範囲が未設定です"};
 if(!boundaryContains(room.worldBoundary(),destination,radius))return {ok:false,reason:"移動可能範囲の外です"};
 if(!room.free(destination.x,destination.z,radius))return {ok:false,reason:"家具や壁に近すぎます"};
 if(start&&!boundaryPathClear(room.worldBoundary(),start,destination,radius))return {ok:false,reason:"囲みの外を横切る経路です"};
 if(start){
  const span=Math.hypot(destination.x-start.x,destination.z-start.z),steps=Math.ceil(span/.12);
  for(let i=1;i<steps;i++){
   const t=i/steps,x=start.x+(destination.x-start.x)*t,z=start.z+(destination.z-start.z)*t;
   if(!room.free(x,z,radius))return {ok:false,reason:"直線経路に障害物があります"};
  }
 }
 return {ok:true};
}
