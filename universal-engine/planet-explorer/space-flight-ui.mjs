import {bodyById} from "./solar-system.mjs";
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
function disk(ctx,x,y,r,color){
 const gradient=ctx.createRadialGradient(x-r*.27,y-r*.32,1,x,y,r);
 gradient.addColorStop(0,"#e7f3ff");gradient.addColorStop(.16,color);
 gradient.addColorStop(.72,color);gradient.addColorStop(1,"#0a1228");
 ctx.fillStyle=gradient;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();
 ctx.strokeStyle="#b3c8e08a";ctx.lineWidth=1;ctx.stroke();
}
export function installSpaceFlightUI({get,onLaunch,onLand,onCancel,onSave,notify}){
 const style=document.createElement("style");
 style.textContent=`
 #space-flight[hidden]{display:none!important}
 #space-flight{position:fixed;inset:0;z-index:3500;background:#071320f7;color:#d9ecfa;display:flex;flex-direction:column;padding:max(8px,env(safe-area-inset-top)) 8px max(8px,env(safe-area-inset-bottom));font:13px/1.45 system-ui;box-sizing:border-box;overscroll-behavior:contain}
 #space-flight .flight-head{display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:space-between;padding:5px 7px}
 #space-flight .flight-head strong{font-size:16px}
 #space-flight .flight-head button{min-height:34px}
 #space-flight .flight-display{position:relative;flex:1;min-height:190px;max-height:68vh;border:1px solid #5a8297;border-radius:12px;overflow:hidden;background:#020915}
 #space-flight canvas{width:100%;height:100%;display:block}
 #space-flight .flight-hud{position:absolute;top:12px;left:12px;color:#cde7f7;font:12px/1.5 ui-monospace,monospace;text-shadow:0 1px 4px #000}
 #space-flight .flight-readout{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;margin:8px 0}
 #space-flight .flight-stat{background:#122d3f;padding:5px;border-radius:6px;text-align:center}
 #space-flight .flight-actions{display:flex;gap:7px;flex-wrap:wrap;align-items:center;justify-content:center;padding:3px}
 #space-flight .flight-actions button{min-height:42px;min-width:68px;padding:5px 10px;border:1px solid #6595b1;border-radius:8px;background:#183b55;color:#effaff;font-size:13px}
 #space-flight .flight-actions button:disabled{opacity:.43}
 #space-flight .flight-actions .primary{background:#226b68;border-color:#79bcae}
 #space-flight input[type=range]{width:min(220px,45vw);accent-color:#77dbd4}
 #space-flight .flight-guide{font-size:11px;color:#abcbdc;text-align:center;margin:3px}
 @media(max-width:560px){#space-flight .flight-readout{font-size:11px}#space-flight .flight-head strong{font-size:13px}#space-flight .flight-actions button{min-width:55px}}
 `;
 document.head.append(style);
 const root=document.createElement("section");root.id="space-flight";root.hidden=true;root.setAttribute("role","region");root.setAttribute("aria-label","惑星間宇宙船の操縦席");
 root.innerHTML='<div class="flight-head"><strong id="flight-route">🚀 宇宙船 / 航行準備</strong><div><button id="flight-save" type="button">💾 航行保存</button> <button id="flight-cancel" type="button">↶ 出発取消</button></div></div>'+
  '<div class="flight-display"><canvas id="flight-canvas" width="960" height="540" aria-label="宇宙船の操縦席から見える星空と目的惑星"></canvas><div class="flight-hud" id="flight-hud"></div></div>'+
  '<div class="flight-readout"><div class="flight-stat" id="flight-phase"></div><div class="flight-stat" id="flight-fuel"></div><div class="flight-stat" id="flight-heading"></div></div>'+
  '<div class="flight-actions"><label>スロットル <input id="flight-throttle" type="range" min="0" max="100" step="5" value="70"></label><button type="button" id="flight-left">◀ 左旋回</button><button type="button" id="flight-right">右旋回 ▶</button><button type="button" id="flight-auto">自動航行</button><button type="button" id="flight-main" class="primary">🚀 離陸</button></div>'+
  '<div class="flight-guide">操作：スロットル／左右旋回／自動航行。目的地到着後に「着陸」で地表へ切り替わります。航行は簡易ゲームモデルです。</div>';
 document.body.append(root);
 const $=id=>root.querySelector("#"+id);
 const screen=$("flight-canvas"),ctx=screen.getContext("2d");
 const throttle=$("flight-throttle"),main=$("flight-main");
 const run=(fn)=>{const result=fn();if(result?.message)notify?.(result.message);return result;};
 throttle.addEventListener("input",()=>get()?.setThrottle(Number(throttle.value)/100));
 $("flight-left").addEventListener("click",()=>get()?.steer(-8));
 $("flight-right").addEventListener("click",()=>get()?.steer(8));
 $("flight-auto").addEventListener("click",()=>{const v=get();if(v)v.setAutopilot(!v.autopilot);});
 $("flight-save").addEventListener("click",()=>run(onSave));
 $("flight-cancel").addEventListener("click",()=>run(onCancel));
 main.addEventListener("click",()=>{const v=get();if(!v)return;run(v.status==="preflight"?onLaunch:onLand);});
 function render(){
  const v=get();root.hidden=!v?.active;if(root.hidden)return;
  const target=bodyById(v.destinationId),origin=bodyById(v.originId);
  $("flight-route").textContent="🚀 "+origin.name+" → "+target.name;
  $("flight-phase").textContent="段階："+v.phase;
  $("flight-fuel").textContent="燃料："+Math.round(v.fuel)+"%";
  $("flight-heading").textContent="進路偏差："+Math.round(v.heading)+"°";
  $("flight-auto").textContent=v.autopilot?"🧭 自動ON":"🧭 自動OFF";
  $("flight-auto").setAttribute("aria-pressed",String(v.autopilot));
  if(document.activeElement!==throttle)throttle.value=String(Math.round(v.throttle*100));
  $("flight-cancel").hidden=v.status!=="preflight";
  main.textContent=v.status==="preflight"?"🚀 離陸":v.status==="orbit"?"↓ 着陸":"🛰️ 巡航中";
  main.disabled=v.status!=="preflight"&&!v.readyToLand;
  const w=screen.width,h=screen.height,p=v.progress,elapsed=v.elapsedSeconds;
  const bg=ctx.createLinearGradient(0,0,0,h);
  bg.addColorStop(0,"#030a18");bg.addColorStop(.63,"#0c2038");bg.addColorStop(1,"#0a1526");
  ctx.fillStyle=bg;ctx.fillRect(0,0,w,h);
  for(let i=0;i<175;i++){
   const a=(i*1664525+1013904223)>>>0,b=(i*22695477+1)>>>0;
   const x=((a%10000)/10000*w+(elapsed*(v.throttle+.15)*(i%3+1))%w)%w,y=(b%10000)/10000*h*.78;
   ctx.fillStyle=i%6===0?"#dcecff":"#7097b4";ctx.globalAlpha=.28+(i%8)/12;
   ctx.fillRect(x,y,i%7===0?2:1,i%7===0?2:1);
  }
  ctx.globalAlpha=1;
  const shift=v.heading*3.2;
  const destinationSize=clamp(13+Math.pow(p,2.6)*245,13,280);
  const sourceSize=clamp(155*(1-p)* (1-p)+4,4,155);
  const tx=w*.62-shift,ty=h*.35,ox=w*.2-shift*.3,oy=h*.37;
  disk(ctx,ox,oy,sourceSize,origin.color);
  disk(ctx,tx,ty,destinationSize,target.color);
  if(p<.12){
   ctx.strokeStyle="#addef588";ctx.lineWidth=3;
   ctx.beginPath();ctx.arc(ox,oy,sourceSize*1.12,0,Math.PI*2);ctx.stroke();
  }
  // Stylized cockpit and flight attitude indicators; never blocks the current game world state.
  ctx.fillStyle="#071421de";ctx.beginPath();ctx.moveTo(0,h);ctx.lineTo(0,h*.82);
  ctx.lineTo(w*.21,h*.88);ctx.lineTo(w*.32,h*.79);ctx.lineTo(w*.68,h*.79);
  ctx.lineTo(w*.79,h*.88);ctx.lineTo(w,h*.82);ctx.lineTo(w,h);ctx.fill();
  ctx.strokeStyle="#629fb3";ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(0,h*.82);ctx.lineTo(w*.21,h*.88);
  ctx.lineTo(w*.32,h*.79);ctx.lineTo(w*.68,h*.79);ctx.lineTo(w*.79,h*.88);ctx.lineTo(w,h*.82);ctx.stroke();
  ctx.strokeStyle="#9ce5d2";ctx.lineWidth=2;ctx.beginPath();
  ctx.moveTo(w/2-29,h*.47);ctx.lineTo(w/2-8,h*.47);ctx.moveTo(w/2+8,h*.47);ctx.lineTo(w/2+29,h*.47);
  ctx.moveTo(w/2,h*.47-25);ctx.lineTo(w/2,h*.47-7);ctx.moveTo(w/2,h*.47+7);ctx.lineTo(w/2,h*.47+25);ctx.stroke();
  ctx.fillStyle="#0d3348";ctx.fillRect(w*.15,h*.92,w*.7,12);
  ctx.fillStyle=v.status==="orbit"?"#76e0af":"#79c3e5";
  ctx.fillRect(w*.15,h*.92,w*.7*p,12);
  ctx.fillStyle="#d9eefb";ctx.font="18px ui-monospace, monospace";
  ctx.fillText(Math.round(p*100)+"% / "+v.flightDays.toFixed(1)+" ゲーム日",w*.32,h*.90);
  $("flight-hud").textContent="HELIO NAV · "+v.status.toUpperCase()+"\n"+target.name+"  接近"+Math.round(p*100)+"%";
 }
 return {render,close:()=>{root.hidden=true;},show:()=>{root.hidden=false;render();}};
}
