/** Shared indoor town building footprint and navigation.
 * Settlement X/Z values are always relative to the landing planet origin.
 * No rendering or global state; old save-game building IDs remain unchanged.
 */
const SMALL=Object.freeze({halfX:4.15,halfZ:3.62,height:3.7});
const LARGE=Object.freeze({halfX:6.6,halfZ:5.15,height:4.9});
export const SHARED_TOWN_ROOMS=Object.freeze({
 cabin:SMALL,lodge:LARGE,workshop:LARGE,granary:SMALL,
 stable:LARGE,barn:LARGE
});
export const sharedRoom=type=>SHARED_TOWN_ROOMS[type]||null;
export function sharedDoor(site){
 const b=sharedRoom(site?.type);
 return b?{x:site.x,z:site.z+b.halfZ+.20,front:site.z+b.halfZ,
  halfX:.92}:null;
}
export function sharedDoorNear(site,pos,{inside=false,radius=2.5}={}){
 const b=sharedRoom(site?.type),door=sharedDoor(site);
 if(!b||!pos)return false;
 return Math.hypot(inside?pos.x:pos.x-door.x,
  inside?pos.z-(b.halfZ-.60):pos.z-door.z)<=radius;
}
export function sharedExteriorStep(before,after,sites,isOpen,{radius=.28}={}){
 if(!before||!after)return {blocked:false,portal:null};
 for(const site of sites||[]){
  const b=sharedRoom(site.type),door=sharedDoor(site);
  if(!b)continue;
  const occupied=(p)=>Math.abs(p.x-site.x)<b.halfX+radius&&
    Math.abs(p.z-site.z)<b.halfZ+radius;
  if(!occupied(after)||occupied(before))continue;
  const atFront=before.z>=door.front+radius&&after.z<door.front+radius&&
   Math.abs(after.x-door.x)<door.halfX;
  if(atFront&&isOpen(site))return {blocked:false,portal:site};
  return {blocked:true,portal:null,site};
 }
 return {blocked:false,portal:null};
}
export function sharedWalkStep(type,pose,nextX,nextZ,{radius=.32}={}){
 const b=sharedRoom(type);
 if(!b)return {x:nextX,z:nextZ,blocked:false};
 const x=Math.max(-b.halfX+radius,Math.min(b.halfX-radius,nextX));
 const z=Math.max(-b.halfZ+radius,Math.min(b.halfZ-radius,nextZ));
 // Keep the entrance clear. Furniture is solid except for public lodge aisle.
 const furniture=type==="lodge"?
  [{x:-2.7,z:-1.45,w:1.0,d:.8},{x:2.65,z:-1.45,w:1.0,d:.8}]:
  type==="cabin"?
  [{x:-2.0,z:-1.8,w:1.0,d:.9},{x:1.45,z:-.6,w:.95,d:.8}]:
  type==="workshop"?
  [{x:-2.4,z:-1.5,w:1.25,d:.72},{x:2.2,z:-2,w:1.2,d:.72}]:
  type==="granary"?
  [{x:-2.4,z:-1.6,w:.75,d:.9},{x:2.4,z:-1.6,w:.75,d:.9}]:
  type==="stable"||type==="barn"?
  [{x:-3.5,z:-1.6,w:1.15,d:1.0},{x:3.5,z:-1.6,w:1.15,d:1.0}]:[];
 const blocked=furniture.some(f=>Math.abs(x-f.x)<f.w+radius&&
  Math.abs(z-f.z)<f.d+radius&&
  !(Math.abs(pose.x-f.x)<f.w+radius&&Math.abs(pose.z-f.z)<f.d+radius));
 return {x:blocked?pose.x:x,z:blocked?pose.z:z,
  blocked:blocked||(Math.abs(nextX-x)>1e-6||Math.abs(nextZ-z)>1e-6)};
}
