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
export function xrStage({mode,anchor,actorYaw=0,yawOffset=0,planetRadius=1,rtsScale=.0014,planetScale=1}){
 const isVR=mode==="vr",isPlanet=mode==="mr-planet";
 const position=isVR?anchor.vrFloor:anchor.position;
 const yaw=anchor.heading+Math.PI-(isPlanet?0:actorYaw)+yawOffset;
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

/**
 * Controller ray → the *visible* side of the tabletop planet. The rendered
 * sphere is translated, Y-rotated, and uniformly scaled. Ray units are XR m.
 * Returns native latitude/longitude degrees, matching geoNormal() and the
 * unchanged orbital descent path. A miss never becomes a landing.
 */
export function xrPlanetHit(rayMatrix,anchor,{yawOffset=0,radius=.24}={}){
 if(!rayMatrix||!anchor||!Number.isFinite(radius)||radius<=0)return null;
 const from=[rayMatrix[12]-anchor.position[0],
  rayMatrix[13]-anchor.position[1],rayMatrix[14]-anchor.position[2]];
 const dir=xrForward(rayMatrix);
 const along=from[0]*dir[0]+from[1]*dir[1]+from[2]*dir[2];
 const c=from[0]**2+from[1]**2+from[2]**2-radius**2;
 const d=along*along-c;
 if(d<0)return null;
 const root=Math.sqrt(d),near=-along-root,far=-along+root;
 const t=near>=0?near:far>=0?far:null;
 if(t===null||t>10)return null;
 const world=[from[0]+dir[0]*t,from[1]+dir[1]*t,from[2]+dir[2]*t];
 const yaw=anchor.heading+Math.PI+yawOffset,co=Math.cos(yaw),si=Math.sin(yaw);
 const x=(co*world[0]-si*world[2])/radius;
 const z=(si*world[0]+co*world[2])/radius;
 const y=Math.max(-1,Math.min(1,world[1]/radius));
 return {lat:Math.asin(y)*180/Math.PI,
  lon:(((Math.atan2(z,x)*180/Math.PI+180)%360)+360)%360-180,
  distanceM:t};
}

/** Real-world distance of a miniature RTS actor selection target. */
export function xrRTSHitRadius(scale=.0014,worldMeters=6,minimumPhysicalMeters=.035){
 return Math.max(worldMeters,minimumPhysicalMeters/Math.max(.00001,scale));
}
