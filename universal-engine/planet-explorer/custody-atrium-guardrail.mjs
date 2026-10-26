/** Procedural waist-height safety rail for the future two-floor custody atrium.
 * Units are metres. The upper gallery floor and open atrium must be modelled
 * separately: this module never changes the existing single-room jail.
 * Geometry matches the explorer Mesh format used by railway-geometry.mjs.
 */
export const CUSTODY_ATRIUM_RAIL = Object.freeze({
  halfWidth: 5.5, halfDepth: 4.5,
  floorY: 3.8, height: 1.10,
  postSpacing: 1.20, barSpacing: 0.13,
  postHalfWidth: 0.055, picketHalfWidth: 0.018,
  collisionPadding: 0.30
});
const DARK_IRON = Object.freeze([.24,.28,.30]);
const STONE = Object.freeze([.41,.40,.37]);
const clamp = (v,min,max)=>Math.max(min,Math.min(max,v));

function positive(v, fallback) {
  return Number.isFinite(v)&&v>0?v:fallback;
}
function settings(input={}) {
  return {
    centerX:Number.isFinite(input.centerX)?input.centerX:0,
    centerZ:Number.isFinite(input.centerZ)?input.centerZ:0,
    halfWidth:positive(input.halfWidth,CUSTODY_ATRIUM_RAIL.halfWidth),
    halfDepth:positive(input.halfDepth,CUSTODY_ATRIUM_RAIL.halfDepth),
    floorY:Number.isFinite(input.floorY)?input.floorY:CUSTODY_ATRIUM_RAIL.floorY,
    height:positive(input.height,CUSTODY_ATRIUM_RAIL.height),
    collisionPadding:positive(input.collisionPadding,CUSTODY_ATRIUM_RAIL.collisionPadding)
  };
}
function mesh() { return {positions:[],normals:[],colors:[],indices:[]}; }
function triangle(out,a,b,c,color) {
  const u=b.map((x,i)=>x-a[i]),v=c.map((x,i)=>x-a[i]);
  const n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
  const len=Math.hypot(...n)||1,unit=n.map(x=>x/len),i=out.positions.length/3;
  out.positions.push(...a,...b,...c);
  out.normals.push(...unit,...unit,...unit);
  out.colors.push(...color,...color,...color);
  out.indices.push(i,i+1,i+2);
}
function quad(out,a,b,c,d,color) {
  triangle(out,a,b,c,color);triangle(out,a,c,d,color);
}
/** Box with bottom at y, and half-extents rx/rz. */
function box(out,x,y,z,rx,h,rz,color) {
  const v=[[x-rx,y,z-rz],[x+rx,y,z-rz],[x+rx,y+h,z-rz],[x-rx,y+h,z-rz],
    [x-rx,y,z+rz],[x+rx,y,z+rz],[x+rx,y+h,z+rz],[x-rx,y+h,z+rz]];
  for(const [a,b,c,d] of [[0,1,2,3],[4,7,6,5],[0,4,5,1],[3,2,6,7],
    [1,5,6,2],[4,0,3,7]])quad(out,v[a],v[b],v[c],v[d],color);
}
function side(out,axis,at,min,max,params) {
  const {floorY,height,postSpacing,barSpacing}=params;
  const length=max-min,mid=(max+min)/2,other=at;
  const isX=axis==="x",color=DARK_IRON;
  const element=(center,y,halfAlong,h,halfAcross,shade)=>
    isX?box(out,center,y,other,halfAlong,h,halfAcross,shade):
      box(out,other,y,center,halfAcross,h,halfAlong,shade);
  // Upper handrail at exactly 1.10m; middle rail and floor curb stop slips.
  element(mid,floorY+height-.085,length/2+.05,.085,.055,color);
  element(mid,floorY+.51,length/2,.050,.030,color);
  element(mid,floorY,length/2,.13,.07,STONE);
  // Bars are spaced 0.13m centre-to-centre: clear gaps approximately 0.094m.
  const bars=Math.ceil(length/barSpacing);
  for(let i=0;i<=bars;i++){
    const p=min+length*i/bars;
    element(p,floorY+.13,.018,Math.max(.01,height-.215),.018,color);
  }
  // Thicker structural posts at most 1.2 metres apart.
  const posts=Math.ceil(length/postSpacing);
  for(let i=0;i<=posts;i++){
    const p=min+length*i/posts;
    element(p,floorY,.055,height,.055,color);
    element(p,floorY+height-.065,.078,.065,.078,color);
  }
}
/** Four continuous inner-edge rail sides around a rectangular second-floor void. */
export function custodyAtriumGuardrailGeometry(input={}) {
  const p=settings(input);
  const out=mesh(),detail={...p,postSpacing:CUSTODY_ATRIUM_RAIL.postSpacing,
    barSpacing:CUSTODY_ATRIUM_RAIL.barSpacing};
  const {centerX:x,centerZ:z,halfWidth:hw,halfDepth:hd}=p;
  for(const zz of [z-hd,z+hd])side(out,"x",zz,x-hw,x+hw,detail);
  for(const xx of [x-hw,x+hw])side(out,"z",xx,z-hd,z+hd,detail);
  return out;
}
/**
 * Swept collision against the drop opening expanded by avatar shoulder radius.
 * Call ONLY for actors walking on the upper gallery; the first floor has no rail.
 * Using a sweep prevents a large locomotion step from passing through the void.
 */
export function resolveCustodyAtriumRailCollision(from,to,input={}) {
  const p=settings(input);
  if(!from||!to||![from.x,from.z,to.x,to.z].every(Number.isFinite))
    return {x:from?.x??0,z:from?.z??0,blocked:true};
  const minX=p.centerX-p.halfWidth-p.collisionPadding;
  const maxX=p.centerX+p.halfWidth+p.collisionPadding;
  const minZ=p.centerZ-p.halfDepth-p.collisionPadding;
  const maxZ=p.centerZ+p.halfDepth+p.collisionPadding;
  const inside=pos=>pos.x>minX&&pos.x<maxX&&pos.z>minZ&&pos.z<maxZ;
  if(inside(from)){
    // Legacy saves / HMD room-scale movement may start inside the forbidden area.
    const options=[
      {dist:from.x-minX,x:minX,z:from.z},
      {dist:maxX-from.x,x:maxX,z:from.z},
      {dist:from.z-minZ,x:from.x,z:minZ},
      {dist:maxZ-from.z,x:from.x,z:maxZ}
    ];
    const rescue=options.sort((a,b)=>a.dist-b.dist)[0];
    return {x:rescue.x,z:rescue.z,blocked:true,recovered:true};
  }
  const dx=to.x-from.x,dz=to.z-from.z;
  let enter=0,exit=1;
  for(const [start,delta,min,max] of [[from.x,dx,minX,maxX],[from.z,dz,minZ,maxZ]]){
    if(Math.abs(delta)<1e-9){
      if(start<=min||start>=max)return {x:to.x,z:to.z,blocked:false};
      continue;
    }
    const a=(min-start)/delta,b=(max-start)/delta;
    enter=Math.max(enter,Math.min(a,b));exit=Math.min(exit,Math.max(a,b));
    if(enter>exit)return {x:to.x,z:to.z,blocked:false};
  }
  // A movement that only grazes the border is allowed.
  if(exit-enter<1e-9||exit<=0||enter>=1)return {x:to.x,z:to.z,blocked:false};
  // Preserve a tiny safety margin against floating-point camera/physics jitter.
  const t=clamp(enter-1e-5/Math.max(1e-5,Math.hypot(dx,dz)),0,1);
  return {x:from.x+dx*t,z:from.z+dz*t,blocked:true};
}
