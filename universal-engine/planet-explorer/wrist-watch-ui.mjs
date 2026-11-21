/**
 * Wrist watch companion settings on ordinary screens.
 * In WebXR the wrist/watch/buttons are mesh-native; the HTML panel provides
 * precise creative controls and is not assumed to appear inside a headset.
 */
import {watchClocks,WATCH_SPEEDS} from "./wrist-watch.mjs";
const STORE_STYLE="universal-engine:wrist:style:v1";
const STORE_MODE="universal-engine:wrist:mode:v1";
export function loadWristPreference(key,fallback){
 try{return localStorage.getItem(key)||fallback;}catch(_){return fallback;}
}
export function installWristWatchUI({watch,getGameDays=()=>0,notify=()=>{}}={}){
 if(!watch||typeof document==="undefined")return null;
 const wrap=document.querySelector(".view-panel .canvas-wrap")||document.body;
 const bar=document.querySelector(".viewport-compact-bar")||wrap;
 const css=document.createElement("link");css.rel="stylesheet";
 css.href="./wrist-watch.css?v=20261121";document.head.append(css);
 const panel=document.createElement("section");panel.id="ue-wrist-panel";
 panel.className="ue-wrist-panel";panel.hidden=true;panel.setAttribute("role","dialog");
 panel.setAttribute("aria-label","腕時計端末設定");panel.setAttribute("aria-modal","false");
 panel.innerHTML='<header><strong>⌚ WRIST TERMINAL</strong><button type="button" data-close aria-label="閉じる">×</button></header>'+
  '<div class="ue-wrist-clocks"><div><small>REAL · 現在地の端末時刻</small><strong data-real>--:--:--</strong><small data-date>----</small></div>'+
  '<div><small>UNIVERSE · 現地時間</small><strong data-world>--:--:--</strong><small data-day>DAY --</small></div></div>'+
  '<div class="ue-wrist-settings"><label>時計の外観<select data-style><option value="smart">⌚ スマートウォッチ</option><option value="mechanical">⚙️ 機械式腕時計</option></select></label>'+
  '<label>プレイモード<select data-mode><option value="universe">ユニバース（シングル）</option><option value="creative">クリエイティブ</option><option value="multiverse" disabled>マルチバース（オンライン未接続）</option></select></label></div>'+
  '<nav class="ue-wrist-actions"><button data-command="menu">☰ メニュー</button><button data-command="settings">⚙️ 設定</button>'+
  '<button data-command="view">👁️ 視点</button><button data-command="xr">🥽 XR</button><button data-command="tablet">▣ タブレット</button><button data-command="time">⏱️ 時間</button></nav>'+
  '<section class="ue-wrist-time"><header><strong>⏱️ 時間操作</strong><output data-state></output></header>'+
  '<div class="ue-wrist-controls"><button data-pause>⏸ 自分以外を停止</button>'+
  '<label>時間倍率<select data-speed>'+WATCH_SPEEDS.map(scale=>'<option value="'+scale+'">×'+scale+'</option>').join("")+'</select></label>'+
  '<button data-back="5">↶ 5秒戻す</button><button data-back="15">↶ 15秒戻す</button></div>'+
  '<small>巻き戻しはクリエイティブ専用・直近30秒の記録に限定。現段階では惑星時計と仲間・敵の位置/HPのみを復元し、建築・資源・戦闘履歴すべてを復元するものではありません。自分の位置と操作は保持します。</small></section>'+
  '<footer><output data-notice aria-live="polite">左手の腕時計を右トリガーで選択できます。</output></footer>';
 wrap.append(panel);
 const launch=document.createElement("button");launch.type="button";launch.id="viewport-wrist-watch";
 launch.textContent="⌚";launch.title="腕時計端末";launch.setAttribute("aria-label","腕時計端末を開く");bar.append(launch);
 const $=s=>panel.querySelector(s);
 const notifyUI=message=>{$("[data-notice]").textContent=message;notify("⌚ "+message);};
 const render=()=>{
  const t=watchClocks(getGameDays(),new Date());
  $("[data-real]").textContent=t.real;$("[data-date]").textContent=t.realDate;
  $("[data-world]").textContent=t.world;$("[data-day]").textContent="DAY "+t.worldDay;
  $("[data-style]").value=watch.style;$("[data-mode]").value=watch.mode;
  $("[data-speed]").value=String(watch.speed);
  $("[data-pause]").textContent=watch.paused?"▶ 時間を再開":"⏸ 自分以外を停止";
  $("[data-pause]").disabled=watch.mode==="multiverse";
  $("[data-speed]").disabled=watch.mode!=="creative";
  panel.querySelectorAll("[data-back]").forEach(b=>b.disabled=watch.mode!=="creative");
  $("[data-state]").textContent=watch.mode==="multiverse"?"閲覧のみ":watch.paused?"時間停止中":watch.mode==="creative"?"時間編集可能":"通常進行";
 };
 const open=()=>{panel.hidden=false;render();};
 const close=()=>panel.hidden=true;
 const toggle=()=>panel.hidden?open():close();
 launch.addEventListener("click",toggle);
 $("[data-close]").addEventListener("click",close);
 $("[data-style]").addEventListener("change",e=>{
  watch.setStyle(e.target.value);
  try{localStorage.setItem(STORE_STYLE,watch.style);}catch(_){}
  render();
 });
 $("[data-mode]").addEventListener("change",e=>{
  watch.setMode(e.target.value);
  try{localStorage.setItem(STORE_MODE,watch.mode);}catch(_){}
  notifyUI(watch.mode==="creative"?"クリエイティブ時間制御を有効化":"ユニバースへ戻りました");
  render();
 });
 const pause=()=>{if(!watch.setPause(!watch.paused))notifyUI("マルチプレイでは時間を操作できません");render();};
 const speed=()=>{
  if(!watch.setSpeed(Number($("[data-speed]").value)))notifyUI("倍速はクリエイティブ専用です");
  else notifyUI("世界時計の倍率を×"+watch.speed+"に設定");
  render();
 };
 const rewind=seconds=>{
  const ok=watch.rewind(performance.now(),seconds);
  notifyUI(ok?seconds+"秒前の記録へ巻き戻しました（自分の位置は保持）":
   "復元できる記録がありません。同じシーンでクリエイティブを実行してください");
  render();return ok;
 };
 $("[data-pause]").addEventListener("click",pause);
 $("[data-speed]").addEventListener("change",speed);
 panel.querySelectorAll("[data-back]").forEach(b=>b.addEventListener("click",()=>rewind(Number(b.dataset.back))));
 panel.querySelectorAll("[data-command]").forEach(b=>b.addEventListener("click",()=>action(b.dataset.command)));
 const action=name=>{
  if(name==="time"){open();panel.querySelector(".ue-wrist-time").scrollIntoView({block:"nearest"});return "時間操作";}
  if(name==="menu"){document.getElementById("viewport-menu")?.click();return "メニュー";}
  if(name==="settings"){document.getElementById("viewport-settings-toggle")?.click();return "詳細設定";}
  if(name==="view"){document.getElementById("viewport-camera")?.click();return "視点切替";}
  if(name==="xr"){
   const body=document.getElementById("xr-settings-body");if(body)body.hidden=false;
   document.getElementById("xr-controls")?.scrollIntoView({block:"nearest"});
   return "VR/MR設定";
  }
  if(name==="tablet"){document.getElementById("viewport-tablet")?.click();return "ワールドタブレット";}
  if(name==="pause"){pause();return watch.paused?"時間停止":"時間再開";}
  if(name==="speed"){
   const scales=WATCH_SPEEDS,now=scales.indexOf(watch.speed);
   const next=scales[(now+1)%scales.length];
   return watch.setSpeed(next)?(render(),"倍率 ×"+next):"倍速はクリエイティブ専用";
  }
  if(name==="rewind"){return rewind(5)?"5秒巻き戻し完了":"巻き戻し記録なし";}
  return "";
 };
 const timer=setInterval(()=>{if(!panel.hidden)render();},1000);
 render();
 return {open,close,toggle,action,render,get visible(){return !panel.hidden;},
  dispose(){clearInterval(timer);panel.remove();launch.remove();css.remove();}};
}
