import {AU_M,orbitalPosition,bodyById} from "./solar-system.mjs";
import {shipContactPosition,shipContactDistance} from "./space-combat.mjs?v=20261107-spatial";
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const finite=n=>typeof n==="number"&&Number.isFinite(n);
const norm=v=>{const d=Math.hypot(...v)||1;return v.map(x=>x/d);};
const sub=(a,b)=>a.map((x,i)=>x-b[i]);
const dot=(a,b)=>a.reduce((acc,x,i)=>acc+x*b[i],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
/** Inertial world point -> ship local coordinates. A nose-right turn moves
 * the fixed starfield left, a nose-up turn moves it down. */
export function inertialToShip(point,yawDeg=0,pitchDeg=0){
 const yaw=(finite(yawDeg)?yawDeg:0)*Math.PI/180;
 const pitch=(finite(pitchDeg)?pitchDeg:0)*Math.PI/180;
 const [x,y,z]=point,cp=Math.cos(pitch),sp=Math.sin(pitch);
 const yy=cp*y+sp*z,zz=-sp*y+cp*z;
 return [Math.cos(yaw)*x+Math.sin(yaw)*zz,yy,
  -Math.sin(yaw)*x+Math.cos(yaw)*zz];
}
/** Deterministic all-sky star directions; no DOM or seeded random state. */
export function starDirections(count=230){
 const output=[];
 for(let i=0;i<count;i++){
  const y=1-2*(i+.5)/count;
  const r=Math.sqrt(1-y*y),a=i*2.399963229728653;
  const c=.62+((i*73)%100)/270;
  output.push({xyz:[r*Math.cos(a),y,r*Math.sin(a)],brightness:c});
 }
 return output;
}
const empty=()=>({positions:[],normals:[],colors:[],indices:[]});
function tri(mesh,p,q,r,color){
 const o=mesh.positions.length/3;
 for(const v of [p,q,r]){
  mesh.positions.push(...v);mesh.colors.push(...color);mesh.normals.push(0,0,1);
 }
 mesh.indices.push(o,o+1,o+2);
}
/** GPU-friendly static mesh, rotated as a unit when the ship turns. */
export function starfieldGeometry(count=230,radius=1800){
 const m=empty();
 for(const {xyz,brightness} of starDirections(count)){
  const p=xyz.map(x=>x*radius);
  const scale=.9+brightness*2.2;
  const c=[brightness*.84,brightness*.92,brightness];
  tri(m,[p[0]-scale,p[1],p[2]],[p[0]+scale,p[1],p[2]],[p[0],p[1]+scale*1.9,p[2]],c);
  tri(m,[p[0]-scale,p[1],p[2]],[p[0]+scale,p[1],p[2]],[p[0],p[1]-scale*1.9,p[2]],c);
 }
 return m;
}
/** Neutral light outer flare and a bright core share one local +Z plume. */
export function exhaustGeometry(tier="cruise"){
 const mesh=empty(),colors=tier==="boost"?
  [[.25,.38,1],[.62,.31,1],[.88,.82,1]]:
  tier==="reverse"?[[1,.22,.09],[1,.67,.12],[1,.94,.67]]:
  [[.18,.67,1],[.32,.91,1],[.88,1,1]];
 const sides=12;
 for(let layer=0;layer<3;layer++){
  const radius=[1,.62,.29][layer],length=[1,.79,.58][layer],col=colors[layer];
  for(let i=0;i<sides;i++){
   const a=i*2*Math.PI/sides,b=(i+1)*2*Math.PI/sides;
   const p=[radius*Math.cos(a),radius*Math.sin(a),0];
   const q=[radius*Math.cos(b),radius*Math.sin(b),0];
   tri(mesh,p,q,[0,0,length],col);
  }
 }
 return mesh;
}
/** Screen targets draw from the exact same ship-relative coordinates as meshes.
 * NPC ships are lightweight encounter proxies (no combat AI yet).
 */
export function shipSensorContacts(v,combat=null){
 if(!v)return [];
 const status=v.status||"docked",t=finite(v.elapsedSeconds)?v.elapsedSeconds:0;
 const yaw=v.attitudeYawDeg||0,pitch=v.pitchDeg||0,contacts=[];
 const flying=!["docked","landed","preflight","touchdown"].includes(status);
 const planet=bodyById(v.destinationId||v.originId);
 if(planet){
  const along=finite(v.routeAlong)?v.routeAlong:v.progress||0,crossTrack=v.crossTrack||0;
  const offset=[-crossTrack*440,-24,-(1-along)*440];
  const d=Math.hypot(offset[0],offset[2]);
  const starPos=inertialToShip(d>1?[offset[0]/d*425,-35,offset[2]/d*425]:[0,-35,-425],yaw,pitch);
  const a=orbitalPosition(v.originId,v.launchDay||0);
  const b=orbitalPosition(planet.id,(v.launchDay||0)+(v.flightDays||0));
  const baseAU=a&&b?Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z):1;
  const distanceAU=Math.hypot(1-along,crossTrack)*baseAU;
  const km=distanceAU*AU_M/1000;
  const distance=km<200000?Math.round(km).toLocaleString("ja-JP")+" km":distanceAU.toFixed(3)+" AU";
  contacts.push({id:"planet",name:planet.name,type:"destination",icon:"◈",position:starPos,
   distance,estimate:true,color:"#7bdde8",distanceAU});
 }
 if(flying&&combat){
  // One authoritative encounter list: WebGL, scan, lock-on and HUD all read
  // the same object positions. No independent "fake pirate/trader" objects.
  for(const c of combat.allContacts||[]){
   const d=shipContactDistance(c,v);
   const category=c.faction==="friendly"?"friendly":
    c.faction==="neutral"?"neutral":c.faction==="resource"?"resource":"hostile";
   const icon={friendly:"🔹",neutral:"🟢",resource:"♦",hostile:"🔸"}[category];
   contacts.push({id:c.id,name:c.name,type:c.type||"ship",faction:category,icon,
    position:shipContactPosition(c,v),distance:d.toFixed(d<1000?0:1)+" m",
    rangeM:d,estimate:false,visual:true,
    surrendered:Boolean(c.surrendered),destroyed:Boolean(c.hp<=0)});
  }
 }
 return contacts;
}
/** Project target to camera plane, clipping offscreen markers to safe bounds.
 * Independent from WebGL so the HUD can be unit-tested and used on Safari. */
export function projectShipHudTarget(position,camera,width,height,{margin=.12}={}){
 if(!Array.isArray(position)||!camera||!finite(width)||!finite(height)||width<=0||height<=0)return null;
 const forward=norm(sub(camera.target,camera.eye)),right=norm(cross(forward,[0,1,0]));
 const up=cross(right,forward),v=sub(position,camera.eye);
 const depth=dot(v,forward),x=dot(v,right),y=dot(v,up);
 const tan=Math.tan((camera.fovDeg||80)*Math.PI/360),aspect=width/height;
 const ax=x/(Math.max(.001,Math.abs(depth))*tan*aspect);
 const ay=y/(Math.max(.001,Math.abs(depth))*tan);
 const visible=depth>0&&Math.abs(ax)<1-margin&&Math.abs(ay)<1-margin;
 let nx=ax,ny=ay;
 if(!visible){
  // Targets behind the observer are still shown with an edge arrow.
  if(depth<0){nx=-nx;ny=-ny;}
  if(Math.abs(nx)+Math.abs(ny)<.02){nx=0;ny=-1;}
  const factor=Math.max(Math.abs(nx)/(1-margin),Math.abs(ny)/(1-margin),1);
  nx/=factor;ny/=factor;
 }
 return {x:clamp((nx+1)*width/2,margin*width/2,width*(1-margin/2)),
  y:clamp((1-ny)*height/2,margin*height/2,height*(1-margin/2)),
  visible,angleDeg:Math.atan2(nx,ny)*180/Math.PI,behind:depth<=0};
}
