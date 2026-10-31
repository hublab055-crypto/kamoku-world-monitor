/** Adds ship-specific navigation and proximity controls to the existing voyage HUD. */
export function installShipInteractionUI({get,getRoutes,onSit,onStand,onHatch,onExit,onTransfer,onChooseRoute,notify}){
 const parent=document.getElementById("space-flight");
 if(!parent)return {update:()=>{}};
 const style=document.createElement("style");
 style.textContent=`#seamless-ship[hidden]{display:none!important}#seamless-ship{border:1px solid #416a79;border-radius:9px;padding:8px;margin:6px 0;background:#0e283b;color:#e6f6ff;font:12px/1.4 system-ui}#seamless-ship .ship-section{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin:5px 0}#seamless-ship button,#seamless-ship select{background:#17566c;color:#efffff;border:1px solid #5d94a4;border-radius:6px;min-height:38px;padding:6px}#seamless-ship button:disabled{opacity:.5}#seamless-ship .small{color:#aecbd8;font-size:11px}`;
 document.head.append(style);
 const root=document.createElement("section");root.id="seamless-ship";root.hidden=true;
 root.innerHTML='<div id="ship-prompt"></div><div class="ship-section" id="ship-actions"></div><div class="ship-section" id="ship-navigation" hidden><label>🪐 目的地 <select id="ship-route"></select></label><button type="button" id="ship-chart">航路設定</button><button type="button" id="ship-depart">🛰️ 惑星間航行開始</button></div><div class="small" id="ship-instructions"></div>';
 const guide=parent.querySelector(".flight-guide");
 if(guide)guide.before(root);else parent.append(root);
 const $=id=>root.querySelector("#"+id),route=$("ship-route"),actions=$("ship-actions");
 const run=fn=>{const r=fn?.();if(r?.message)notify?.(r.message);update(true);return r;};
 $("ship-chart").addEventListener("click",()=>run(()=>onChooseRoute(route.value)));
 $("ship-depart").addEventListener("click",()=>run(onTransfer));
 let key="",optionKey="";
 function action(name,fn){
  const button=document.createElement("button");button.type="button";button.textContent=name;
  button.addEventListener("click",()=>run(fn));actions.append(button);
 }
 function update(force=false){
  const v=get(),show=v?.kind==="surface-to-surface";
  root.hidden=!show;if(!show){key="";return;}
  const nearbyHatch=v.isNearHatch(),nearSeat=v.isNearSeat();
  const currentKey=[v.status,v.hatchOpen,v.seated,Math.floor(v.interior.z*2),Math.floor(v.interior.x*2),v.destinationId].join("|");
  if(force||key!==currentKey){
   key=currentKey;actions.replaceChildren();
   $("ship-prompt").textContent="🚀 "+v.phase+" ／ "+(v.seated?"着席中":"船内歩行中")+" ／ ハッチ："+(v.hatchOpen?"開":"閉");
   if(v.seated)action("🚶 操縦席から立つ",onStand);
   else if(nearSeat)action("🪑 操縦席に座る",onSit);
   if(!v.seated&&nearbyHatch&&v.isGrounded()){
    action(v.hatchOpen?"🔒 ハッチを閉じる":"🚪 ハッチを開ける",onHatch);
    if(v.canDisembark())action("🚶 地表へ歩いて降りる",onExit);
   }
   const instructions={
    docked:"船内を歩き、船尾のハッチを閉じ、操縦席に座って離陸してください。",
    ascent:"ハッチを閉じたまま大気圏を上昇します。操作中も船内を歩けます。",
    "origin-orbit":"周回軌道へ到達。操縦席から次の惑星を選んでください。",
    cruise:"巡航中。スロットル・旋回・自動航行で進行方向を調整できます。",
    approach:"目的地へ接近しています。着陸するには操縦席に座ってください。",
    orbit:"目的地の周回軌道上。着陸ボタンで大気圏へ突入します。",
    entry:"着陸降下中。操縦席から目的惑星の地表を確認できます。ハッチはロックされています。",
    touchdown:"🛬 着陸脚が接地しました。エンジン停止と着陸地点の確定を確認中です。",
    landed:"着陸しました。立ち上がって船尾へ移動し、ハッチを開いて降りてください。"
   };
   $("ship-instructions").textContent=instructions[v.status]||"";
  }
  const navVisible=v.status==="origin-orbit"&&v.seated;
  $("ship-navigation").hidden=!navVisible;
  if(navVisible){
   const routes=getRoutes?.()||[];
   const next=routes.map(x=>x.id+":"+x.flightDays).join("|");
   if(next!==optionKey){
    optionKey=next;route.replaceChildren();
    for(const r of routes){const opt=document.createElement("option");opt.value=r.id;opt.textContent=r.name+"（"+r.flightDays.toFixed(1)+"ゲーム日）";route.append(opt);}
   }
   $("ship-depart").disabled=!v.destinationId;
   if(v.destinationId&&routes.some(r=>r.id===v.destinationId))route.value=v.destinationId;
  }
 }
 return {update};
}
