/** Assisted route controls, not a six degree of freedom flight solver. */
export const stickAxes=(x,y,rollMode=false)=>{
 const size=Math.max(1,Math.hypot(x,y));x/=size;y/=size;
 const dead=n=>Math.abs(n)<.08?0:n;
 return {yaw:rollMode?0:dead(x),pitch:dead(-y),roll:rollMode?dead(x):0};
};
export function installCockpitControls({root,get,notify}){
 const panel=document.createElement('div');panel.className='flight-actions';
 panel.innerHTML='<label>スティック <select data-mode aria-label="スティック横軸"><option value="yaw">ヨー＋ピッチ</option><option value="roll">ロール＋ピッチ</option></select></label><div data-stick role="group" aria-label="姿勢スティック" style="width:100px;height:100px;border:1px solid #8bd4d4;border-radius:50%;touch-action:none;position:relative;background:#102b3f"><span data-knob style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);pointer-events:none">●</span></div><label>ブレーキ <input data-brake aria-label="航路ブレーキ" type="range" min="0" max="100" value="0"></label><button data-gear>ギア</button><button data-hatch>ハッチ</button><button data-people>人員乗降の準備</button><button disabled title="機体武器・照準・弾薬との接続は未実装">火器管制（未接続）</button><button disabled title="積荷・地表への投下との接続は未実装">物資投下（未接続）</button><span data-state role="status"></span>';
 root.append(panel);
 const $=s=>panel.querySelector(s),stick=$('[data-stick]'),knob=$('[data-knob]'),mode=$('[data-mode]'),brake=$('[data-brake]');
 const listeners=[];const on=(target,type,fn)=>{target.addEventListener(type,fn);listeners.push(()=>target.removeEventListener(type,fn));};
 let pointer=null,owner=null,axes=stickAxes(0,0);
 const reset=()=>{pointer=null;owner=null;axes=stickAxes(0,0);knob.style.left='50%';knob.style.top='50%';};
 const pilot=()=>{const v=get();return !root.hidden&&v?.kind==='surface-to-surface'&&v.canOperateHelm?v:null;};
 function move(e){
  const b=stick.getBoundingClientRect();if(!b.width||!b.height)return;
  const x=(e.clientX-b.left-b.width/2)/(b.width/2),y=(e.clientY-b.top-b.height/2)/(b.height/2);
  axes=stickAxes(x,y,mode.value==='roll');const d=Math.max(1,Math.hypot(x,y));
  knob.style.left=(50+x/d*40)+'%';knob.style.top=(50+y/d*40)+'%';
 }
 on(stick,'pointerdown',e=>{if(pointer!==null||!pilot()||(e.button!==undefined&&e.button!==0))return;
  e.preventDefault();pointer=e.pointerId;owner=pilot();stick.setPointerCapture?.(pointer);move(e);});
 on(stick,'pointermove',e=>{if(e.pointerId===pointer)move(e);});
 for(const type of ['pointerup','pointercancel','lostpointercapture'])on(stick,type,e=>{if(e.pointerId===pointer)reset();});
 on(window,'blur',reset);on(document,'visibilitychange',reset);on(mode,'change',reset);
 on(brake,'input',()=>pilot()?.setBrake(Number(brake.value)/100));
 const action=fn=>{reset();const result=fn();if(result?.message)notify?.(result.message);};
 on($('[data-gear]'),'click',()=>action(()=>get()?.toggleGear()));
 on($('[data-hatch]'),'click',()=>action(()=>get()?.cockpitHatch()));
 on($('[data-people]'),'click',()=>action(()=>{
  const v=get();if(!v?.seated||!v.isGrounded())return {message:'人員乗降は接地後、操縦席から準備してください'};
  if(!v.hatchOpen)v.cockpitHatch();const result=v.stand();
  return {...result,message:'ハッチを開放しました。船内を歩き、ランプから地表へ降りてください'};
 }));
 return {
  reset,
  render(dt){
   const v=get();panel.hidden=v?.kind!=='surface-to-surface';panel.style.display=panel.hidden?'none':'';
   if(!pilot()||owner&&owner!==v)reset();
   if(owner)v.setAttitude(axes.yaw,axes.pitch,axes.roll,dt);
   const enabled=Boolean(pilot());mode.disabled=!enabled;brake.disabled=!enabled;
   stick.setAttribute('aria-disabled',String(!enabled));
   $('[data-gear]').disabled=!enabled||v.isGrounded()||v.status==='entry';
   $('[data-hatch]').disabled=!v?.seated||!v.isGrounded();
   $('[data-people]').disabled=!v?.seated||!v.isGrounded();
   if(document.activeElement!==brake)brake.value=String(Math.round((v?.brake||0)*100));
   $('[data-state]').textContent=v?`ギア：${v.gearDown?'展開':'格納'} ／ ハッチ：${v.hatchOpen?'開':'閉'} ／ ピッチ ${Math.round(v.pitch||0)}° ／ ロール ${Math.round(v.roll||0)}°`:'';
  },
  destroy(){reset();for(const remove of listeners)remove();panel.remove();}
 };
}
