export function installSurfaceStarshipUI({get,onHatch,onBoard,notify}){
 const style=document.createElement("style");
 style.textContent=`#surface-starship[hidden]{display:none!important}#surface-starship{position:absolute;bottom:54px;left:9px;z-index:29;background:#082535ef;color:#e8f7ff;border:1px solid #689ba6;border-radius:11px;padding:10px;max-width:min(330px,calc(100% - 20px));box-shadow:0 4px 22px #02090988;font:12px/1.5 system-ui}#surface-starship button{margin:5px 4px 0 0;min-height:35px;border:1px solid #67a6b0;border-radius:6px;background:#17566a;color:#fff;padding:5px 9px}#surface-starship button:disabled{opacity:.42}#surface-starship .note{font-size:11px;color:#a9d1df}`;
 document.head.append(style);
 const root=document.createElement("section");
 root.id="surface-starship";root.hidden=true;
 const head=document.createElement("strong"),note=document.createElement("div"),hatch=document.createElement("button"),board=document.createElement("button");
 hatch.type="button";board.type="button";
 root.append(head,note,hatch,board);
 document.querySelector(".canvas-wrap")?.append(root);
 hatch.addEventListener("click",()=>{const r=onHatch();if(r?.message)notify?.(r.message);update(true);});
 board.addEventListener("click",()=>{const r=onBoard();if(r?.message)notify?.(r.message);update(true);});
 let prev="";
 function update(force=false){
  const state=get(),ship=state?.ship,planet=state?.planet,controller=state?.controller;
  const show=Boolean(ship?.present(planet?.id)&&controller?.altitudeM<=12.1&&
   !state?.inside&&!state?.xrActive&&!state?.voyage?.active);
  if(!show){root.hidden=true;prev="";return;}
  const pos=ship.offsetFromCoords(controller.origin,controller.x,controller.z,planet.radiusM);
  if(!pos||pos.distanceM>25){root.hidden=true;prev="";return;}
  const key=Math.floor(pos.distanceM*2)+":"+ship.hatchOpen;
  if(!force&&key===prev)return;prev=key;
  root.hidden=false;head.textContent="🚀 地表の宇宙船 ／ ハッチまで "+pos.distanceM.toFixed(1)+"m";
  note.className="note";note.textContent="船尾へ近づいてハッチを開くと、乗降ランプから船内へ入れます。";
  hatch.textContent=ship.hatchOpen?"🔒 ハッチを閉める":"🚪 ハッチを開ける";
  hatch.disabled=pos.distanceM>5.5;
  board.textContent="🚶 船内へ入る";
  board.disabled=pos.distanceM>4.5||!ship.hatchOpen;
 }
 return {update,hide:()=>{root.hidden=true;}};
}
