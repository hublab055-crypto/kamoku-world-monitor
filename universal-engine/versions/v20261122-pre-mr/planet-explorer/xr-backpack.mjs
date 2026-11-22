/** VR ground pickups and encumbrance, in metres and kilograms.
 * No browser/WebXR dependency. The game owns all inventory transactions.
 */
export const VR_BACKPACK_CAPACITY_KG=55;
export const VR_BACKPACK_SLOW_START_KG=12;
export const VR_PICKUP_REACH_M=.43;
const finite=Number.isFinite;
export const distance3=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
export function vrLoadSpeedFactor(kg){
 const mass=finite(kg)?Math.max(0,kg):0;
 if(mass<=VR_BACKPACK_SLOW_START_KG)return 1;
 // At 18 kg: 88%, 30 kg: 64%, 42+ kg: 40%.
 return Math.max(.4,1-(mass-VR_BACKPACK_SLOW_START_KG)*.02);
}
export function vrCanCarry(loadKg,itemKg,{capacity=VR_BACKPACK_CAPACITY_KG}={}){
 return finite(loadKg)&&finite(itemKg)&&itemKg>=0&&loadKg>=0&&
  loadKg+itemKg<=capacity+.0001;
}
export function vrWorldToHeadset(item,actor,stage){
 if(!item||!actor||!stage||![item.x,item.z,actor.x,actor.z].every(finite))return null;
 const x=item.x-actor.x,z=item.z-actor.z;
 // The scene's terrain is flattened to the XR player's local floor. Pickups
 // are presented above ground, within physical reach on Quest.
 const y=finite(item.pickupHeightM)?item.pickupHeightM:.43;
 return [
  stage[0]*x+stage[4]*y+stage[8]*z+stage[12],
  stage[1]*x+stage[5]*y+stage[9]*z+stage[13],
  stage[2]*x+stage[6]*y+stage[10]*z+stage[14]
 ];
}
export function vrNearestPickup(handMatrix,stage,actor,items,{reach=VR_PICKUP_REACH_M}={}){
 if(!handMatrix||!Array.isArray(items))return null;
 const point=[handMatrix[12],handMatrix[13],handMatrix[14]];
 let winner=null,distance=reach;
 for(const item of items){
  if(!item||!(item.quantity>0))continue;
  if(Math.hypot(item.x-actor.x,item.z-actor.z)>3)continue;
  const p=vrWorldToHeadset(item,actor,stage);
  if(!p)continue;
  const d=distance3(point,p);
  if(d<distance){winner=item;distance=d;}
 }
 return winner?{item:winner,physicalDistanceM:distance}:null;
}
export function vrBagMouths(anchors){
 if(!anchors)return [];
 const p=anchors.chest,f=anchors.forward,shoulder=anchors.shoulderRight;
 if(!p||!f||!shoulder)return [];
 // Main pouch behind the right shoulder; front strap permits seated users.
 return [
  [shoulder[0]-f[0]*.25,shoulder[1]-.08,shoulder[2]-f[2]*.25],
  [p[0]+f[0]*.16,p[1]-.03,p[2]+f[2]*.16]
 ];
}
export function vrHandAtBag(handMatrix,anchors,reach=.26){
 if(!handMatrix)return false;
 const point=[handMatrix[12],handMatrix[13],handMatrix[14]];
 return vrBagMouths(anchors).some(m=>distance3(point,m)<=reach);
}
