const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const add=(a,b)=>({x:a.x+b.x,y:a.y+b.y,z:a.z+b.z});
const sub=(a,b)=>({x:a.x-b.x,y:a.y-b.y,z:a.z-b.z});
const scale=(a,n)=>({x:a.x*n,y:a.y*n,z:a.z*n});
const dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z;
const cross=(a,b)=>({x:a.y*b.z-a.z*b.y,y:a.z*b.x-a.x*b.z,z:a.x*b.y-a.y*b.x});
const norm=a=>{const d=Math.hypot(a.x,a.y,a.z)||1;return scale(a,1/d);};
const rotateEuler=(point,part)=>{
 const pivot=part.pivot||{x:0,y:0,z:0},rx=part.rx||0,ry=part.ry||0,rz=part.rz??part.rotation??0;
 let x=point.x-pivot.x,y=point.y-pivot.y,z=point.z-pivot.z,c=Math.cos(rx),s=Math.sin(rx);
 [y,z]=[y*c-z*s,y*s+z*c];c=Math.cos(ry);s=Math.sin(ry);[x,z]=[x*c+z*s,-x*s+z*c];
 c=Math.cos(rz);s=Math.sin(rz);[x,y]=[x*c-y*s,x*s+y*c];
 return {x:x+pivot.x,y:y+pivot.y,z:z+pivot.z};
};

export function selectionCenter(parts,selected){
 const chosen=parts.filter(p=>selected?.has?.(p.id));
 if(!chosen.length)return {x:0,y:0,z:0};
 const centers=chosen.map(part=>add({x:part.x,y:part.y,z:part.z},rotateEuler({x:0,y:0,z:part.height/2},part)));
 return {x:centers.reduce((sum,p)=>sum+p.x,0)/centers.length,y:centers.reduce((sum,p)=>sum+p.y,0)/centers.length,
  z:centers.reduce((sum,p)=>sum+p.z,0)/centers.length};
}

export class AssetCamera{
 constructor(){this.yaw=-Math.PI/4;this.pitch=.62;this.distance=28;this.pan={x:0,y:0,z:0};this.fov=Math.PI/3;}
 target(parts,selected){return add(selectionCenter(parts,selected),this.pan);}
 basis(parts,selected){
  const target=this.target(parts,selected),cp=Math.cos(this.pitch),camera={x:target.x+Math.sin(this.yaw)*cp*this.distance,
   y:target.y+Math.cos(this.yaw)*cp*this.distance,z:target.z+Math.sin(this.pitch)*this.distance};
  const forward=norm(sub(target,camera)),right=norm(cross(forward,{x:0,y:0,z:1})),up=norm(cross(right,forward));
  return {target,camera,forward,right,up};
 }
 orbit(dx,dy){this.yaw-=dx*.008;this.pitch=clamp(this.pitch+dy*.008,.08,Math.PI/2-.025);}
 zoom(amount){this.distance=clamp(this.distance*Math.exp(amount*.0015),2,800);}
 panPixels(dx,dy,parts,selected,viewportHeight=600){const b=this.basis(parts,selected),units=this.distance*Math.tan(this.fov/2)*2/Math.max(100,viewportHeight);
  this.pan=add(this.pan,add(scale(b.right,-dx*units),scale(b.up,dy*units)));}
 resetPan(){this.pan={x:0,y:0,z:0};}
 preset(name){this.resetPan();if(name==="top"){this.yaw=0;this.pitch=Math.PI/2-.025;}else if(name==="front"){this.yaw=Math.PI;this.pitch=.025;}else if(name==="right"){this.yaw=-Math.PI/2;this.pitch=.025;}else{this.yaw=-Math.PI/4;this.pitch=.62;}this.distance=28;}
 project(point,width,height,parts,selected){const b=this.basis(parts,selected),r=sub(point,b.camera),depth=dot(r,b.forward);if(depth<=.05)return null;
  const f=height/(2*Math.tan(this.fov/2));return {x:width/2+dot(r,b.right)*f/depth,y:height/2-dot(r,b.up)*f/depth,depth};}
 rayToPlane(screenX,screenY,width,height,planeZ,parts,selected){const b=this.basis(parts,selected),f=height/(2*Math.tan(this.fov/2)),
  direction=norm(add(b.forward,add(scale(b.right,(screenX-width/2)/f),scale(b.up,-(screenY-height/2)/f))));
  if(Math.abs(direction.z)<1e-7)return null;const t=(planeZ-b.camera.z)/direction.z;if(t<=0)return null;const p=add(b.camera,scale(direction,t));return {x:p.x,y:p.y,z:planeZ};}
}
