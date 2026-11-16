/** Small proximity panel: parked craft, landing plume, or optional call-to-land command. */
export function installSurfaceStarshipUI({get,onHatch,onBoard,onLand,notify}){
 const style=document.createElement("style");
 style.textContent=`#surface-starship[hidden]{display:none!important}
 #surface-starship{position:absolute;bottom:54px;left:9px;z-index:29;background:#082535ef;
 color:#e8f7ff;border:1px solid #689ba6;border-radius:11px;padding:10px;
 max-width:min(330px,calc(100% - 20px));box-shadow:0 4px 22px #02090988;font:12px/1.5 system-ui}
 #surface-starship button{margin:5px 4px 0 0;min-height:35px;border:1px solid #67a6b0;
 border-radius:6px;background:#17566a;color:#fff;padding:5px 9px}
 #surface-starship button:disabled{opacity:.42}
 #surface-starship .note{font-size:11px;color:#a9d1df}
 #surface-starship.compact{padding:6px 9px}
 #surface-starship.compact .note{display:none}`;
 document.head.append(style);
 const root=document.createElement("section");
 root.id="surface-starship";root.hidden=true;
 const head=document.createElement("strong"),note=document.createElement("div");
 const hatch=document.createElement("button"),board=document.createElement("button"),land=document.createElement("button");
 hatch.type="button";board.type="button";land.type="button";
 root.append(head,note,hatch,board,land);
 document.querySelector(".canvas-wrap")?.append(root);
 const run=(fn)=>{const r=fn?.();if(r?.message)notify?.(r.message);update(true);};
 hatch.addEventListener("click",()=>run(onHatch));
 board.addEventListener("click",()=>run(onBoard));
 land.addEventListener("click",()=>run(onLand));
 let prev="";
 function update(force=false){
  const state=get(),ship=state?.ship,planet=state?.planet,controller=state?.controller;
  const show=Boolean(ship&&planet&&controller?.altitudeM<=12.1&&
   !state?.inside&&!state?.xrActive&&!state?.voyage?.active);
  if(!show){root.hidden=true;prev="";return;}
  const own=ship.bodyId===planet.id,elsewhere=Boolean(ship.bodyId&&!own);
  if(elsewhere){root.hidden=true;prev="";return;}
  const pos=own&&ship.visible(planet.id)?
   ship.offsetFromCoords(controller.origin,controller.x,controller.z,planet.radiusM):null;
  const nearby=Boolean(pos&&pos.distanceM<=25);
  const landing=own&&["landing","recall"].includes(ship.flight);
  const mode=landing?"landing":nearby?"near":"call";
  const key=[mode,Math.round((pos?.distanceM??0)*2),ship.hatchOpen,
   Math.floor((ship.recallProgress??ship.landingProgress??0)*20)].join(":");
  if(!force&&key===prev)return;prev=key;
  root.hidden=false;root.classList.toggle("compact",mode==="call");
  if(mode==="call"){
   head.textContent="🚀 宇宙船";
   note.textContent="副官に指示して、離陸・飛行・着陸を行います。";
   hatch.hidden=true;board.hidden=true;land.hidden=false;land.disabled=false;
   land.textContent="📡 副官に宇宙船を呼ぶ";
  }else if(mode==="landing"){
   head.textContent=ship.flight==="recall"?"📡 副官が操縦中・"+ship.recallPhase+" "+Math.round(ship.recallProgress*100)+"%":"🛬 着陸中 "+Math.round(ship.landingProgress*100)+"%";
   note.textContent=ship.flight==="recall"?"機体は実際に離陸・接近飛行してから着陸します。着陸完了までハッチはロックされます。":"船体が地表へ降下中です。着地が完了するまでハッチはロックされます。";
   hatch.hidden=true;board.hidden=true;land.hidden=true;
  }else{
   head.textContent="🚀 地表の宇宙船 ／ ハッチまで "+pos.distanceM.toFixed(1)+"m";
   note.textContent="船尾に近づいてハッチを開け、乗降ランプから船内へ入れます。";
   hatch.hidden=false;board.hidden=false;land.hidden=true;
   hatch.textContent=ship.hatchOpen?"🔒 ハッチを閉める":"🚪 ハッチを開ける";
   hatch.disabled=pos.distanceM>5.5;
   board.textContent="🚶 船内へ入る";
   board.disabled=pos.distanceM>4.5||!ship.hatchOpen;
  }
 }
 return {update,hide:()=>{root.hidden=true;prev="";}};
}
