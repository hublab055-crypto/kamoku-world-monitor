/** One-tap local construction, RTS drag-to-line, touch safe.
 * Uses the same pickGround and terrain validation as character movement.
 */
export class ConstructionPlacement {
 constructor({canvas,system,kindSelect,toggle,cancel,status,rts,pick,surface,resources,existing,commit,log}){
  Object.assign(this,{canvas,system,kindSelect,toggle,cancel,status,rts,pick,surface,resources,existing,commit,log});
  this.kind=null;this.start=null;this.pointer=null;
  toggle.addEventListener("click",()=>this.setKind(kindSelect.value));
  cancel.addEventListener("click",()=>this.setKind(null));
  kindSelect.addEventListener("change",()=>{if(this.kind)this.setKind(kindSelect.value)});
  canvas.addEventListener("pointerdown",e=>{
   this.pointer=this.kind==="stone-wall"&&rts()?{id:e.pointerId,x:e.clientX,y:e.clientY}:null;
  });
  canvas.addEventListener("pointerup",e=>{
   const p=this.pointer;this.pointer=null;
   if(!p||p.id!==e.pointerId||!this.kind||!rts())return;
   if(Math.hypot(p.x-e.clientX,p.y-e.clientY)<12)return;
   const start=pick(p.x,p.y),end=pick(e.clientX,e.clientY);
   if(!start||!end){this.show("地面の始点と終点を選択してください");return;}
   this.start=null;this.placeLine(start,end);
  });
  canvas.addEventListener("pointercancel",()=>{this.pointer=null});
 }
 setKind(kind){
  this.kind=kind||null;this.start=null;
  this.cancel.hidden=!kind;
  this.toggle.setAttribute("aria-pressed",String(Boolean(kind)));
  this.show(!kind?"配置終了":this.rts()&&kind==="stone-wall"?
    "RTS：地面をドラッグして石壁を敷設":"地面をタップして設置");
 }
 show(message){this.status.textContent=message;this.log(message);}
 dragging(){return !!this.pointer&&this.rts()&&this.kind==="stone-wall";}
 tap(x,y){
  if(!this.kind)return false;
  const end=this.pick(x,y);
  if(!end){this.show("地面を指定してください");return true;}
  if(this.kind==="stone-wall"){
   if(this.rts()){
    if(!this.start){this.start=end;this.show("始点を指定しました。終点をタップ（またはドラッグ）");return true;}
    const from=this.start;this.start=null;this.placeLine(from,end);
   }else this.placeLine({x:end.x-1,z:end.z},{x:end.x+1,z:end.z});
  }else this.finish(this.system.place(this.kind,end.x,end.z,this.surface,this.resources(),this.existing()));
  return true;
 }
 placeLine(a,b){
  this.finish(this.system.placeLine(a,b,this.surface,this.resources(),this.existing()));
 }
 finish(result){
  this.show(result.message);
  if(result.ok)this.commit(result);
 }
}
