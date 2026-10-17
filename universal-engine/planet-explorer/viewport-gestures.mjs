/** Unified pointer gestures for the 3D viewport (TPV / RTS).
 * One finger drags the camera, two fingers pinch to zoom, and a double
 * tap emits a separate movement command. No DOM dependency for tests. */
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const noop=()=>{};
export class ViewportGestures {
  constructor({onTap=noop,onDoubleTap=noop,onDrag=noop,onPinch=noop,now=()=>Date.now()}={}){
    this.onTap=onTap;this.onDoubleTap=onDoubleTap;
    this.onDrag=onDrag;this.onPinch=onPinch;this.now=now;
    this.points=new Map();this.lastTap=null;this.pinchDistance=0;
    this.blockUntilClear=false;
  }
  down(e){
    if(this.points.has(e.pointerId))return;
    this.points.set(e.pointerId,{x:e.clientX,y:e.clientY,
      startX:e.clientX,startY:e.clientY,moved:false});
    if(this.points.size>1){
      this.blockUntilClear=true;this.lastTap=null;
      for(const p of this.points.values())p.moved=true;
      this.pinchDistance=this.span();
    }
  }
  span(){
    const [a,b]=[...this.points.values()];
    return a&&b?distance(a,b):0;
  }
  move(e){
    const p=this.points.get(e.pointerId);
    if(!p)return;
    const dx=e.clientX-p.x,dy=e.clientY-p.y;
    p.x=e.clientX;p.y=e.clientY;
    if(this.points.size>1){
      const next=this.span();
      if(this.points.size===2&&next>2&&this.pinchDistance>2){
        const factor=Math.max(.5,Math.min(2,this.pinchDistance/next));
        if(Math.abs(factor-1)>.002)this.onPinch(factor);
      }
      this.pinchDistance=next;
      return;
    }
    if(this.blockUntilClear)return;
    if(distance(p,{x:p.startX,y:p.startY})>10)p.moved=true;
    if(p.moved)this.onDrag(dx,dy);
  }
  up(e){
    const p=this.points.get(e.pointerId);
    if(!p)return;
    const grouped=this.points.size>1||this.blockUntilClear;
    this.points.delete(e.pointerId);
    if(!this.points.size){
      this.pinchDistance=0;this.blockUntilClear=false;
    }
    if(grouped||p.moved)return;
    const point={x:e.clientX,y:e.clientY,shiftKey:!!e.shiftKey};
    const now=this.now();
    const last=this.lastTap;
    if(last&&now-last.time<=320&&
       distance(point,last)<=28&&last.pointerType===(e.pointerType||"mouse")){
      this.lastTap=null;this.onDoubleTap(point);
    }else{
      this.lastTap={...point,time:now,pointerType:e.pointerType||"mouse"};
      this.onTap(point);
    }
  }
  cancel(id=null){
    if(id===null){this.points.clear();this.lastTap=null;this.blockUntilClear=false;this.pinchDistance=0;return;}
    this.points.delete(id);this.lastTap=null;
    if(!this.points.size){this.blockUntilClear=false;this.pinchDistance=0;}
  }
}
export function bindViewportGestures(canvas,callbacks){
  const gesture=new ViewportGestures(callbacks);
  canvas.addEventListener("pointerdown",e=>{
    gesture.down(e);
    try{canvas.setPointerCapture?.(e.pointerId);}catch(_){}
  });
  canvas.addEventListener("pointermove",e=>gesture.move(e));
  canvas.addEventListener("pointerup",e=>gesture.up(e));
  canvas.addEventListener("pointercancel",e=>gesture.cancel(e.pointerId));
  // Safari emits this after pointerup: do not discard the previous tap,
  // otherwise the second tap can never be recognised.
  canvas.addEventListener("lostpointercapture",e=>{
    if(gesture.points.has(e.pointerId))gesture.cancel(e.pointerId);
  });
  return gesture;
}
