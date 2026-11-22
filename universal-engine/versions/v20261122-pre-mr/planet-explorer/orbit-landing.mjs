import {invert4,unproject} from "./picking.mjs";
import {RAD,clamp,wrapLon} from "./geo.mjs";

/**
 * Return the geographical point on the visible side of a rendered planet.
 * vp is the exact orbit view-projection; radius is the *rendered* globe radius.
 * The visual globe is rotated relative to native longitude by spinOffsetDeg.
 * Pure math, shared by mouse/touch/RTS and independently testable.
 */
export function pickOrbitalGeo(vp,ndcX,ndcY,radius,spinOffsetDeg=0){
 if(!Array.isArray(vp)||vp.length!==16||
   ![ndcX,ndcY,radius,spinOffsetDeg].every(Number.isFinite)||
   radius<=0||Math.abs(ndcX)>1||Math.abs(ndcY)>1)return null;
 const inv=invert4(vp);
 if(!inv)return null;
 const near=unproject(inv,ndcX,ndcY,-1),far=unproject(inv,ndcX,ndcY,1);
 if(!near||!far)return null;
 const d=far.map((v,i)=>v-near[i]);
 const len=Math.hypot(...d);
 if(!Number.isFinite(len)||len<1e-9)return null;
 const direction=d.map(v=>v/len);
 const along=near.reduce((a,v,i)=>a+v*direction[i],0);
 const c=near.reduce((a,v)=>a+v*v,0)-radius*radius;
 const discriminant=along*along-c;
 if(discriminant<0)return null; // A tap outside the planet is never a teleport.
 const root=Math.sqrt(discriminant);
 const t1=-along-root,t2=-along+root;
 const t=t1>=0?t1:t2>=0?t2:null;
 if(t===null)return null;
 const p=near.map((v,i)=>(v+direction[i]*t)/radius);
 return {lat:Math.asin(clamp(p[1],-1,1))*RAD,
  lon:wrapLon(Math.atan2(p[2],p[0])*RAD-spinOffsetDeg)};
}
