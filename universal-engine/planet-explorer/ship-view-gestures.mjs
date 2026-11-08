/** One gesture owner decides between a target tap and camera orbit. */
export function pickShipContact(projected,rect,x,y,radius=52){
 if(!rect?.width||!rect?.height)return null;
 return (projected||[]).filter(p=>p.onScreen&&Number.isFinite(p.u)&&Number.isFinite(p.v))
  .map(p=>({...p,tapDistance:Math.hypot(rect.left+p.u*rect.width-x,rect.top+p.v*rect.height-y)}))
  .filter(p=>p.tapDistance<radius).sort((a,b)=>a.tapDistance-b.tapDistance)[0]||null;
}
export function installShipViewGestures(target,{isActive,isRoaming,getInterior,onOrbit,onZoom,onTap,ownerWindow=globalThis.window}){
 let drag=null;
 const consume=e=>{e.preventDefault();e.stopImmediatePropagation();};
 target.addEventListener('pointerdown',e=>{
  if(!isActive()||e.isPrimary===false||e.button!==0||drag)return;
  const roaming=isRoaming();if(!roaming&&!getInterior())return;
  drag={id:e.pointerId,startX:e.clientX,startY:e.clientY,x:e.clientX,y:e.clientY,time:e.timeStamp,roaming,moved:false};
  target.setPointerCapture?.(e.pointerId);
  consume(e);
 },true);
 target.addEventListener('pointermove',e=>{
  if(!drag||e.pointerId!==drag.id)return;
  const dx=e.clientX-drag.x,dy=e.clientY-drag.y;
  if(Math.hypot(e.clientX-drag.startX,e.clientY-drag.startY)>8)drag.moved=true;
  if(drag.roaming){if(drag.moved)onOrbit(dx,dy);consume(e);}
  else{if(drag.moved)getInterior()?.turn(dx*.006,-dy*.004);consume(e);}
  drag.x=e.clientX;drag.y=e.clientY;
 },true);
 const finish=e=>{
  if(!drag||e.pointerId!==drag.id)return;
  const d=drag;drag=null;
  {
   consume(e);
   if(e.type==='pointerup'&&isActive()&&!d.moved&&Math.hypot(e.clientX-d.startX,e.clientY-d.startY)<=8&&e.timeStamp-d.time<650)
    onTap(e.clientX,e.clientY);
  }
 };
 for(const name of ['pointerup','pointercancel','lostpointercapture'])target.addEventListener(name,finish,true);
 target.addEventListener('wheel',e=>{if(isActive()&&isRoaming()){consume(e);onZoom(e.deltaY);}},{capture:true,passive:false});
 ownerWindow?.addEventListener('blur',()=>{drag=null;});
}
