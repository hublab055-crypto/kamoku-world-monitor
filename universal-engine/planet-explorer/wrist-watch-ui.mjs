/** Compact desktop fallback and settings for the Quest wristwatch terminal. */
export function installWristWatchUI({runtime,onAction=()=>{},notify=()=>{}}){
 const bar=document.querySelector(".viewport-compact-bar")||document.querySelector(".view-panel");
 if(!bar)return null;
 const style=document.createElement("style");
 style.textContent=`
 .ue-watch-button{margin-inline:.25rem;white-space:nowrap}
 .ue-watch-panel{position:fixed;right:12px;top:64px;z-index:12000;max-width:min(94vw,350px);
  max-height:80vh;overflow:auto;background:#142130;color:#f2f6fa;border:1px solid #7897ac;
  border-radius:14px;padding:14px;box-shadow:0 8px 26px #0009;font:14px system-ui}
 .ue-watch-panel[hidden]{display:none}
 .ue-watch-panel h3{margin:0 0 10px;font-size:17px}
 .ue-watch-panel .ue-watch-times{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:8px 0 12px}
 .ue-watch-panel .ue-watch-times div{background:#23364b;padding:9px;border-radius:8px}
 .ue-watch-panel .ue-watch-times strong{display:block;font:600 18px ui-monospace,monospace}
 .ue-watch-panel .ue-watch-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}
 .ue-watch-panel button,.ue-watch-panel select{background:#294660;border:1px solid #7790a5;border-radius:7px;
  color:#fff;padding:7px;cursor:pointer;min-width:0}
 .ue-watch-panel button:disabled{opacity:.4;cursor:not-allowed}
 .ue-watch-panel label{display:flex;align-items:center;justify-content:space-between;gap:9px;margin:8px 0}
 .ue-watch-panel small{display:block;color:#b8cbdc;margin-top:9px;line-height:1.45}
 `;
 document.head.append(style);
 const toggle=document.createElement("button");toggle.type="button";toggle.className="ue-watch-button";
 toggle.textContent="⌚ 時計";toggle.setAttribute("aria-label","腕時計メニュー");bar.append(toggle);
 const panel=document.createElement("section");panel.className="ue-watch-panel";panel.hidden=true;
 panel.setAttribute("aria-label","腕時計端末");
 panel.innerHTML=`<h3>⌚ WRIST TERMINAL <button type="button" data-close style="float:right">×</button></h3>
 <div class="ue-watch-times"><div>🌐 LOCAL <strong data-local>--:--:--</strong></div>
 <div>🕒 REAL <strong data-real>--:--:--</strong></div></div>
 <label>外観 <select data-style><option value="smart">スマートウォッチ</option>
 <option value="mechanical">機械式</option></select></label>
 <label>装着腕 <select data-hand><option value="left">左手首</option>
 <option value="right">右手首</option></select></label>
 <label>世界モード <select data-mode><option value="universe">ユニバース</option>
 <option value="creative">クリエイティブ</option></select></label>
 <div class="ue-watch-grid" data-actions></div>
 <small data-info>ゲーム時間と現実時間を別々に表示。VRでは腕時計を右手トリガーで押してメニューを開きます。</small>`;
 document.body.append(panel);
 const $=key=>panel.querySelector("[data-"+key+"]");
 const actions=$("actions");
 const buttons=[
  ["main-menu","☰ メニュー"],["settings","⚙ 設定"],["camera","👁 視点"],
  ["xr-mode","🥽 VR/MR"],["tablet","▣ タブレット"],["pause","⏸ 停止／再開"],
  ["quarter","×0.25"],["normal","×1"],["double","×2"],["fast","×5"],["rewind","⏪ 5秒"]
 ];
 function report(result){
  if(result?.message)notify("⌚ "+result.message);
  else if(result?.ok)notify("⌚ 時間速度 "+runtime.speed+"倍");
  refresh();return result;
 }
 function invoke(id){
  if(id==="time-page"){report({ok:true,message:"腕時計の時間操作メニューを開きました"});return;}
  if(id==="blocked"){report({ok:false,message:"このモードでは使えません"});return;}
  if(id==="toggle"){return;}
  if(id==="time-pause"||id==="pause")return report(runtime.command("pause"));
  if(id==="time-quarter"||id==="quarter")return report(runtime.command("speed",.25));
  if(id==="time-normal"||id==="normal")return report(runtime.command("speed",1));
  if(id==="time-double"||id==="double")return report(runtime.command("speed",2));
  if(id==="time-fast"||id==="fast")return report(runtime.command("speed",5));
  if(id==="time-rewind"||id==="rewind")return report(runtime.command("rewind",5));
  if(id==="time"){panel.hidden=false;refresh();return;}
  onAction(id);return {ok:true};
 }
 for(const [id,label] of buttons){
  const b=document.createElement("button");b.type="button";b.dataset.cmd=id;b.textContent=label;
  b.addEventListener("click",()=>invoke(id));actions.append(b);
 }
 toggle.addEventListener("click",()=>{panel.hidden=!panel.hidden;refresh();});
 panel.querySelector("[data-close]").addEventListener("click",()=>panel.hidden=true);
 $("style").addEventListener("change",e=>{runtime.setStyle(e.target.value);refresh();});
 $("hand").addEventListener("change",e=>{runtime.setHand(e.target.value);refresh();});
 $("mode").addEventListener("change",e=>{
  if(!runtime.setMode(e.target.value))notify("⌚ このモードは変更できません");
  refresh();
 });
 let cached="";
 function refresh(){
  const display=runtime.display();
  const stamp=display.local+"|"+display.real+"|"+runtime.mode+"|"+runtime.speed+"|"+runtime.style+"|"+runtime.hand+"|"+panel.hidden;
  if(cached===stamp)return;cached=stamp;
  $("local").textContent=display.local;$("real").textContent=display.real;
  $("style").value=runtime.style;$("hand").value=runtime.hand;
  $("mode").value=runtime.mode==="multiverse"?"universe":runtime.mode;
  $("mode").disabled=runtime.mode==="multiverse";
  for(const button of actions.querySelectorAll("button")){
   const cmd=button.dataset.cmd;
   const time=["pause","quarter","normal","double","fast","rewind"].includes(cmd);
   button.disabled=runtime.mode==="multiverse"&&time||
    runtime.mode==="universe"&&["quarter","double","fast","rewind"].includes(cmd);
  }
  $("info").textContent=runtime.mode==="multiverse"?
   "マルチバースでは通常メニューのみ。時間はサーバー側の管理対象です。":
   runtime.mode==="creative"?
   "時間停止・速度変更・動体と惑星時刻の試験的巻き戻し（最大30秒）に対応。自分は自由に移動できます。":
   "ユニバースでは時間停止と再開だけが可能です。停止中も自分は動けます。";
 }
 refresh();
 return {refresh,invoke,open:()=>{panel.hidden=false;refresh();},dispose:()=>{toggle.remove();panel.remove();style.remove();}};
}
