/** Small touch HUD. Action callbacks use the same commands as desktop and VR. */
export function installMobilePlayUI({getState,onLook,doc=document,ownerWindow=window}){
 const canvas=doc.querySelector(".canvas-wrap");
 const actions=doc.createElement("div");
 actions.id="mobile-action-buttons";
 actions.className="mobile-action-buttons";
 actions.setAttribute("role","group");
 actions.setAttribute("aria-label","アクション");
 const buttons=Array.from({length:6},()=>{
  const button=doc.createElement("button");
  button.type="button";actions.append(button);
  return button;
 });
 const look=doc.createElement("div");
 look.id="camera-stick";look.className="camera-stick";
 look.setAttribute("role","group");look.setAttribute("aria-label","カメラスティック");
 look.innerHTML='<div class="stick-base"><div class="stick-nub"></div></div><span>CAMERA</span>';
 canvas.append(look,actions);
 let pointer=null,axis={x:0,y:0},current=[];
 const nub=look.querySelector(".stick-nub");
 function release(){
  pointer=null;axis={x:0,y:0};nub.style.transform="translate(0px,0px)";
 }
 function move(e){
  const box=look.getBoundingClientRect(),radius=Math.min(box.width,box.height)*.30;
  const x=e.clientX-box.left-box.width/2,y=e.clientY-box.top-box.height/2;
  const scale=Math.min(1,radius/Math.max(1,Math.hypot(x,y)));
  axis={x:x*scale/radius,y:y*scale/radius};
  nub.style.transform="translate("+x*scale+"px,"+y*scale+"px)";
 }
 look.addEventListener("pointerdown",e=>{
  if(pointer!==null||e.button!==0)return;
  e.preventDefault();pointer=e.pointerId;look.setPointerCapture(pointer);move(e);
 });
 look.addEventListener("pointermove",e=>{if(e.pointerId===pointer)move(e);});
 for(const type of ["pointerup","pointercancel","lostpointercapture"])
  look.addEventListener(type,e=>{if(e.pointerId===pointer)release();});
 ownerWindow.addEventListener("blur",release);
 doc.addEventListener("visibilitychange",()=>{if(doc.hidden)release();});
 buttons.forEach((button,index)=>button.addEventListener("click",()=>{
  const action=getState().actions[index];
  if(action&&!action.disabled)action.run();
 }));
 // Restrict selection and touch callouts to the play surface. Editable fields
 // retain their normal editing behavior.
 canvas.addEventListener("contextmenu",e=>{
  if(!e.target.closest("input,textarea,[contenteditable='true']"))e.preventDefault();
 });
 for(const type of ["gesturestart","gesturechange"])
  canvas.addEventListener(type,e=>e.preventDefault(),{passive:false});
 function update(dt=0){
  const state=getState(),ship=state.ship;
  doc.documentElement.dataset.mobileContext=ship?"ship":"ground";
  actions.hidden=Boolean(state.vr);
  look.hidden=Boolean(ship||state.vr);
  if(look.hidden)release();
  else if(pointer!==null)onLook(axis.x*Math.min(dt,.08)*180,axis.y*Math.min(dt,.08)*180);
  current=state.actions;
  buttons.forEach((button,index)=>{
   const action=current[index];
   button.hidden=!action;
   if(!action)return;
   if(button.textContent!==action.label)button.textContent=action.label;
   button.disabled=Boolean(action.disabled);
   button.setAttribute("aria-label",action.label);
  });
 }
 return {update};
}
