/**
 * Universal Engine WebXR spatial math. Column-major matrices, meters in XR.
 * Independent of WebXR globals so the mapping can be regression-tested in Node.
 */
export const xrIdentity=()=>[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
export function xrMul(a,b){
 const o=new Array(16).fill(0);
 for(let c=0;c<4;c++)for(let r=0;r<4;r++)for(let k=0;k<4;k++)o[c*4+r]+=a[k*4+r]*b[c*4+k];
 return o;
}
export function xrTranslate(x,y,z){
 const m=xrIdentity();m[12]=x;m[13]=y;m[14]=z;return m;
}
export function xrRotateY(a){
 const m=xrIdentity(),c=Math.cos(a),s=Math.sin(a);
 m[0]=c;m[2]=-s;m[8]=s;m[10]=c;return m;
}
export function xrScale(v){
 const m=xrIdentity();m[0]=m[5]=m[10]=v;return m;
}
export function xrHeading(poseMatrix){
 // The XR viewer looks down its local -Z axis.
 const fx=-poseMatrix[8],fz=-poseMatrix[10];
 return Math.atan2(-fx,-fz);
}
export function xrForward(poseMatrix){
 return [-poseMatrix[8],-poseMatrix[9],-poseMatrix[10]];
}
export function xrAnchor(poseMatrix,{floor=false}={}){
 const forward=xrForward(poseMatrix);
 const horizontal=Math.hypot(forward[0],forward[2])||1;
 const origin=[poseMatrix[12],poseMatrix[13],poseMatrix[14]];
 // local-floor has Y=0 at floor; local space is approximately head-relative.
 return {
  position:[origin[0]+forward[0]/horizontal*1.25,
   floor ? .78 : origin[1]-.64,
   origin[2]+forward[2]/horizontal*1.25],
  vrFloor:[origin[0],floor?0:origin[1]-1.64,origin[2]],
  heading:xrHeading(poseMatrix)
 };
}
export function xrStage({mode,anchor,actorYaw=0,planetRadius=1,rtsScale=.0014,planetScale=1}){
 const isVR=mode==="vr",isPlanet=mode==="mr-planet";
 const position=isVR?anchor.vrFloor:anchor.position;
 const yaw=anchor.heading+Math.PI-(isPlanet?0:actorYaw);
 const scale=isVR?1:(isPlanet?planetScale/planetRadius:rtsScale);
 return xrMul(xrTranslate(...position),xrMul(xrRotateY(yaw),xrScale(scale)));
}
export function xrTableHit(rayMatrix,anchor,actorYaw,actor,scale=.0014){
 const from=[rayMatrix[12],rayMatrix[13],rayMatrix[14]];
 const direction=xrForward(rayMatrix);
 if(Math.abs(direction[1])<.00001)return null;
 const t=(anchor.position[1]-from[1])/direction[1];
 if(t<=0||t>15)return null;
 const world=[from[0]+direction[0]*t-anchor.position[0],from[2]+direction[2]*t-anchor.position[2]];
 const a=anchor.heading+Math.PI-actorYaw,c=Math.cos(a),s=Math.sin(a);
 // Inverse of the Y rotation, then inverse of miniature world scale.
 const x=(c*world[0]-s*world[1])/scale;
 const z=(s*world[0]+c*world[1])/scale;
 return {x:actor.x+x,z:actor.z+z,distanceM:t};
}
export function xrPlacementFromHit(hitMatrix,viewerMatrix,floor=false){
 const anchor=xrAnchor(viewerMatrix,{floor});
 return {...anchor,position:[hitMatrix[12],hitMatrix[13]+.025,hitMatrix[14]]};
}
