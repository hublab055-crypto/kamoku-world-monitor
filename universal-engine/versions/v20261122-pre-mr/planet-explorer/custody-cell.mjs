/** Shared confined-space locomotion for both city guard cells and station jails.
 * Coordinates match railwayJailGeometry in railway-geometry.mjs (world metres).
 * The real planetary explorer coordinates are never changed while detained.
 */
export const CELL_SPAWN=Object.freeze({x:0.3,z:-0.4,yaw:0});
export const CELL_BOUNDS=Object.freeze({minX:-3.75,maxX:3.75,minZ:-3.78,maxZ:3.78});
// Furniture footprints, expanded by the actor's shoulder radius (~0.3 m).
const obstacles=[
 {minX:0.2,maxX:3.15,minZ:-4.0,maxZ:-0.9}, // bed
 {minX:-3.65,maxX:-1.65,minZ:-4.0,maxZ:-2.22}, // stone seat
 {minX:-2.72,maxX:-0.58,minZ:0.75,maxZ:2.65} // locked table
];
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
export function newCustodyCell(){return {...CELL_SPAWN,blocked:false,moving:false};}
export function custodyPositionAllowed(x,z){
 if(!Number.isFinite(x)||!Number.isFinite(z)||x<CELL_BOUNDS.minX||
  x>CELL_BOUNDS.maxX||z<CELL_BOUNDS.minZ||z>CELL_BOUNDS.maxZ)return false;
 return !obstacles.some(o=>x>=o.minX&&x<=o.maxX&&z>=o.minZ&&z<=o.maxZ);
}
export function walkCustodyCell(state,{forward=0,strafe=0,turn=0}={},dt=0){
 const current=state&&custodyPositionAllowed(state.x,state.z)?state:newCustodyCell();
 const t=clamp(Number.isFinite(dt)?dt:0,0,.1);
 const yaw=(Number.isFinite(current.yaw)?current.yaw:0)+clamp(turn,-1,1)*t*1.7;
 let f=clamp(forward,-1,1),s=clamp(strafe,-1,1);
 const length=Math.hypot(f,s);
 if(length>1){f/=length;s/=length;}
 const distance=t*2.8;
 const dx=distance*(Math.sin(yaw)*f+Math.cos(yaw)*s);
 const dz=distance*(Math.cos(yaw)*f-Math.sin(yaw)*s);
 // Slide along a barred wall instead of halting all movement on contact.
 const nextX=custodyPositionAllowed(current.x+dx,current.z)?current.x+dx:current.x;
 const nextZ=custodyPositionAllowed(nextX,current.z+dz)?current.z+dz:current.z;
 const movedM=Math.hypot(nextX-current.x,nextZ-current.z);
 const blocked=Math.hypot(dx,dz)>0.00001&&movedM+0.00001<Math.hypot(dx,dz);
 return {x:nextX,z:nextZ,yaw,blocked,moving:movedM>0.00001,movedM};
}
