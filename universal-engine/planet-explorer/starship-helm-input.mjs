/** Pointer/keyboard steering for the seated pilot; no world movement keys. */
export function installStarshipHelmInput({left,right,keyboard,windowTarget,get,isVisible,isEditing}){
 const held=new Map(),keys=new Set(),listeners=[];
 let owner=null;
 const listen=(target,type,fn)=>{target.addEventListener(type,fn);listeners.push(()=>target.removeEventListener(type,fn));};
 const eligible=()=>{const v=get();return isVisible()&&v?.kind==="surface-to-surface"&&v.canOperateHelm?v:null;};
 const clear=()=>{held.clear();keys.clear();owner=null;};
 const claim=()=>{const v=eligible();if(!v)return null;if(owner!==v){clear();owner=v;}return v;};
 for(const [button,direction] of [[left,-1],[right,1]]){
  listen(button,"pointerdown",e=>{
   if(e.button!==undefined&&e.button!==0||!claim())return;
   e.preventDefault();button.focus?.({preventScroll:true});held.set(e.pointerId,{button,direction,applied:false});
   button.setPointerCapture?.(e.pointerId);
  });
  listen(button,"pointerup",e=>{
   const item=held.get(e.pointerId);
   if(!item||item.button!==button)return;
   held.delete(e.pointerId);
   // A quick tap still works if no animation frame occurred while held.
   if(!item.applied&&owner===eligible())owner.steer(direction*8);
  });
  for(const type of ["pointercancel","lostpointercapture"])
   listen(button,type,e=>{if(held.get(e.pointerId)?.button===button)held.delete(e.pointerId);});
  // Native keyboard activation and assistive technologies dispatch detail=0.
  listen(button,"click",e=>{if(e.detail===0){const v=eligible();if(v)v.steer(direction*8);}});
 }
 listen(keyboard,"keydown",e=>{
  const key=e.key.toLowerCase();
  if(!["j","l"].includes(key)||e.ctrlKey||e.altKey||e.metaKey||isEditing()||!claim())return;
  e.preventDefault();keys.add(key);
 });
 listen(keyboard,"keyup",e=>keys.delete(e.key.toLowerCase()));
 listen(windowTarget,"blur",clear);
 listen(keyboard,"visibilitychange",clear);
 return {
  clear,
  advance(dt){
   const v=eligible();
   if(!v||owner!==v||isEditing()){clear();return;}
   const step=Number.isFinite(dt)?Math.max(0,Math.min(.12,dt)):0;
   if(!step)return;
   const directions=new Set([...held.values()].map(p=>p.direction));
   if(keys.has("j"))directions.add(-1);if(keys.has("l"))directions.add(1);
   const direction=Number(directions.has(1))-Number(directions.has(-1));
   if(direction)v.steer(direction*30*step);
   // Opposing inputs cancel; releasing them must not synthesize a tap.
   for(const item of held.values())item.applied=true;
  },
  destroy(){clear();for(const remove of listeners)remove();}
 };
}
