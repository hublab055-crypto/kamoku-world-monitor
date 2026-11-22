/**
 * Universal Engine wearable inventory, independent of rendering and XR sessions.
 * Units: metres (local avatar coordinate space), kilograms, litres.
 * Transform anchors through the avatar skeletal rig before testing controller reach.
 * No implicit item duplication: an item belongs to exactly one container or hand.
 */
export const BODY_SOCKETS = Object.freeze({
  leftHip: [-0.19,0.94,0.01], rightHip:[0.19,0.94,0.01],
  leftShoulder:[-0.25,1.45,-0.11], rightShoulder:[0.25,1.45,-0.11],
  chest:[0,1.28,0.16], back:[0,1.25,-0.24],
  leftPocket:[-0.17,0.91,0.12], rightPocket:[0.17,0.91,0.12],
  leftCoat:[-0.16,1.17,0.14], rightCoat:[0.16,1.17,0.14]
});
export const CONTAINER_PRESETS = Object.freeze({
 scabbard:{kind:"scabbard",capacityL:2,maxKg:6,maxItems:1,tags:["sword"],requiresOpen:false,reachM:0.23},
 quiver:{kind:"quiver",capacityL:5,maxKg:4,maxItems:30,tags:["arrow"],requiresOpen:false,reachM:0.26},
 pocket:{kind:"pocket",capacityL:0.8,maxKg:1,maxItems:8,tags:null,requiresOpen:false,reachM:0.18},
 pouch:{kind:"pouch",capacityL:2,maxKg:3,maxItems:12,tags:null,requiresOpen:true,reachM:0.18},
 backpack:{kind:"backpack",capacityL:28,maxKg:22,maxItems:60,tags:null,requiresOpen:true,reachM:0.24,requiresAccess:true},
 satchel:{kind:"satchel",capacityL:9,maxKg:8,maxItems:24,tags:null,requiresOpen:true,reachM:0.24,requiresAccess:true},
 toolbag:{kind:"toolbag",capacityL:14,maxKg:15,maxItems:30,tags:null,requiresOpen:true,reachM:0.24,requiresAccess:true}
});
// Coat/robe outfits expose a higher breast pocket; simpler outfits use trousers.
export function pocketSocketForOutfit(outfitId){
 return ["scout","merchant","priest","hunter","traveler"].includes(outfitId)?"rightCoat":"rightPocket";
}
const finiteNonnegative=(n)=>Number.isFinite(n)&&n>=0;
const copy=o=>JSON.parse(JSON.stringify(o));
export class WearableInventory {
 constructor({containers=[],items=[],hands={left:null,right:null}}={}){
  this.containers=new Map();
  this.items=new Map();
  this.hands={left:null,right:null};
  for(const item of items)this.registerItem(item);
  for(const c of containers)this.attach(c);
  for(const hand of ["left","right"]){
   const id=hands[hand];if(id!==null&&!this.putInHand(hand,id))throw Error("Invalid occupied hand in wearable snapshot");
  }
 }
 registerItem(item){
  if(!item?.id||this.items.has(item.id)||!finiteNonnegative(item.kg)||!finiteNonnegative(item.litres))throw Error("Invalid or duplicate item");
  this.items.set(item.id,copy(item));
 }
 attach({id,preset,socket,open=false,accessible=false,active=true,items=[]}){
  if(!id||this.containers.has(id)||!CONTAINER_PRESETS[preset]||!BODY_SOCKETS[socket])throw Error("Invalid wearable socket");
  const c={id,preset,socket,open:!!open,accessible:!!accessible,active:true,items:[]};
  this.containers.set(id,c);
  try{for(const itemId of items)if(!this.stow(itemId,id))throw Error("Invalid or overfilled wearable container: "+id);}
  catch(error){this.containers.delete(id);throw error;}
  c.active=active!==false; // Restore contents first, then unmount a removed garment.
  return c;
 }
 location(itemId){
  for(const [hand,id] of Object.entries(this.hands))if(id===itemId)return {type:"hand",hand};
  for(const c of this.containers.values())if(c.items.includes(itemId))return {type:"container",containerId:c.id};
  return null;
 }
 capacity(containerId){
  const c=this.containers.get(containerId);
  if(!c)throw Error("Unknown container");
  const used=c.items.reduce((a,id)=>{const item=this.items.get(id);a.kg+=item.kg;a.litres+=item.litres;return a;},{kg:0,litres:0});
  const p=CONTAINER_PRESETS[c.preset];
  return {...used,freeKg:Math.max(0,p.maxKg-used.kg),freeL:Math.max(0,p.capacityL-used.litres),freeSlots:p.maxItems-c.items.length};
 }
 canAccess(c){
  const p=CONTAINER_PRESETS[c.preset];
  return c.active!==false&&(!p.requiresOpen||c.open)&&(!p.requiresAccess||c.accessible);
 }
 canStore(itemId,containerId){
  const item=this.items.get(itemId),c=this.containers.get(containerId);
  if(!item||!c||c.active===false)return false;
  const p=CONTAINER_PRESETS[c.preset],cap=this.capacity(containerId);
  return (!p.tags||p.tags.includes(item.tag))&&cap.freeKg>=item.kg&&cap.freeL>=item.litres&&cap.freeSlots>0;
 }
 stow(itemId,containerId,{fromHand=null}={}){
  const c=this.containers.get(containerId);
  if(!this.canStore(itemId,containerId))return false;
  const source=this.location(itemId);
  if(source?.type==="container"||source?.type==="hand"&&source.hand!==fromHand)return false;
  if(fromHand!==null&&this.hands[fromHand]!==itemId)return false;
  if(fromHand!==null)this.hands[fromHand]=null;
  c.items.push(itemId);return true;
 }
 putInHand(hand,itemId){
  if(!(hand in this.hands)||this.hands[hand]!==null||!this.items.has(itemId)||this.location(itemId))return false;
  this.hands[hand]=itemId;return true;
 }
 grab(hand,containerId,itemId=null){
  if(!(hand in this.hands)||this.hands[hand]!==null)return null;
  const c=this.containers.get(containerId);
  if(!c||!this.canAccess(c))return null;
  const chosen=itemId??c.items.at(-1),index=c.items.indexOf(chosen);
  if(index<0)return null;
  c.items.splice(index,1);this.hands[hand]=chosen;
  return this.items.get(chosen);
 }
 returnToContainer(hand,containerId){
  const itemId=this.hands[hand];if(!itemId)return false;
  const c=this.containers.get(containerId);
  if(!c||!this.canAccess(c))return false;
  return this.stow(itemId,containerId,{fromHand:hand});
 }
 setAccess(id,{open,accessible,active}={}){
  const c=this.containers.get(id);if(!c)return false;
  if(open!==undefined)c.open=!!open;
  if(accessible!==undefined)c.accessible=!!accessible;
  if(active!==undefined)c.active=!!active;
  return true;
 }
 setSocket(id,socket){
  const c=this.containers.get(id);
  if(!c||!BODY_SOCKETS[socket])return false;
  c.socket=socket;return true;
 }
 /** Change the carrying garment without discarding contents on unequip. */
 setPreset(id,preset){
  const c=this.containers.get(id),next=CONTAINER_PRESETS[preset];
  if(!c||!next)return false;
  const used=this.capacity(id);
  if(used.kg>next.maxKg||used.litres>next.capacityL||c.items.length>next.maxItems||
   next.tags&&c.items.some(itemId=>!next.tags.includes(this.items.get(itemId)?.tag)))return false;
  c.preset=preset;return true;
 }
 /** Position must be rig/socket transformed into XR reference space by the caller. */
 isInReach(containerId,controllerPosition,socketWorldPosition){
  const c=this.containers.get(containerId);
  if(!c||!controllerPosition||!socketWorldPosition)return false;
  const r=CONTAINER_PRESETS[c.preset].reachM;
  const dx=controllerPosition.x-socketWorldPosition.x;
  const dy=controllerPosition.y-socketWorldPosition.y;
  const dz=controllerPosition.z-socketWorldPosition.z;
  return Number.isFinite(dx+dy+dz)&&dx*dx+dy*dy+dz*dz<=r*r;
 }
 snapshot(){return {version:1,items:[...this.items.values()].map(copy),containers:[...this.containers.values()].map(copy),hands:{...this.hands}};}
 static fromSnapshot(snapshot){if(snapshot?.version!==1)throw Error("Unsupported inventory version");return new WearableInventory(snapshot);}
}
/**
 * combatDemo=true is for isolated tests. Runtime combat ammunition and weapons
 * belong to Frontier World inventory; never create shadow copies in VR.
 */
export function starterWearables({combatDemo=true}={}){
 const arrowIds=Array.from({length:12},(_,i)=>"arrow-"+(i+1));
 const system=new WearableInventory({
  items:[
   ...(combatDemo?[
    {id:"training-sword",tag:"sword",kg:1.4,litres:1.2},
    ...arrowIds.map(id=>({id,tag:"arrow",kg:0.05,litres:0.12}))
   ]:[]),
   {id:"field-note",tag:"paper",kg:0.08,litres:0.12}
  ],
  containers:[
   {id:"hip-sheath",preset:"scabbard",socket:"leftHip",items:combatDemo?["training-sword"]:[]},
   {id:"shoulder-quiver",preset:"quiver",socket:"rightShoulder",items:combatDemo?arrowIds:[]},
   {id:"trouser-pocket",preset:"pocket",socket:"rightPocket",items:["field-note"]},
   {id:"travel-backpack",preset:"backpack",socket:"back"}
  ]
 });return system;
}
