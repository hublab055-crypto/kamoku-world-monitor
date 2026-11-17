import {XRMotionActorRecorder,getXRMotionTextSummary,setXRMotionPlayback,getXRMotionPlayback}
 from "./xr-motion-actor.mjs?v=20261118-vr-mocap";
/** Local-only user-consented capture panel embedded in existing WebXR menu.
 * No uploads, no screenshots, no audio, no history/localStorage retention.
 */
export function installXRMotionActorUI(host){
 const recorder=new XRMotionActorRecorder();
 const box=document.createElement("details");
 box.id="xr-motion-actor";
 const heading=document.createElement("summary");
 heading.textContent="🎭 VRモーションアクター（Quest 3S・記録／再生）";
 box.append(heading);
 const note=document.createElement("p");
 note.textContent="本人の操作で記録。HMD・左右コントローラー・床座標(local-floor)を最長25秒間、約20Hzで収録します。下半身は推定であり実測ではありません。録画・音声・自動送信はありません。";
 const armedLabel=document.createElement("label");
 const armed=document.createElement("input");armed.type="checkbox";armed.id="xr-motion-actor-armed";
 armedLabel.append(armed,document.createTextNode(" 次のVR起動時に自動録画する（同時に左右スティック押込で停止）"));
 const tools=document.createElement("div");
 tools.style.cssText="display:flex;gap:6px;flex-wrap:wrap;margin:7px 0";
 const make=(label,run)=>{const b=document.createElement("button");b.type="button";b.textContent=label;b.addEventListener("click",run);tools.append(b);return b;};
 const state=document.createElement("output");state.setAttribute("role","status");state.style.display="block";
 const summary=document.createElement("pre");summary.style.cssText="max-height:130px;overflow:auto;white-space:pre-wrap;font-size:11px";
 const json=document.createElement("textarea");
 json.id="xr-motion-actor-json";json.readOnly=true;json.rows=6;
 json.setAttribute("aria-label","モーション記録のJSONテキスト");
 json.style.cssText="display:block;box-sizing:border-box;width:100%;max-height:210px;font:11px monospace";
 const refresh=()=>{
  summary.textContent=recorder.track?getXRMotionTextSummary(recorder.track):"記録なし";
  json.value=recorder.exportJSON();
  state.textContent=recorder.recording?"● 記録中（終了するとJSONを表示します）":recorder.summary();
 };
 const start=({floorTracked}={})=>{
  setXRMotionPlayback(null);
  recorder.start({floorTracked:!!floorTracked,maxSeconds:25});refresh();
  return true;
 };
 const finish=()=>{if(recorder.recording)recorder.stop();refresh();};
 make("■ 停止・確定",()=>{finish();armed.checked=false;});
 const preview=make("▶ アバターに再生",()=>{
  if(getXRMotionPlayback()){setXRMotionPlayback(null);preview.textContent="▶ アバターに再生";state.textContent="再生停止";return;}
  if(!recorder.track?.frames.length){state.textContent="再生できる記録がありません";return;}
  const ok=setXRMotionPlayback(recorder.track,performance.now());
  state.textContent=ok?"プレイヤーのV10モデルへ、頭と左右腕のIK再生中":"記録の形式が不正です";
  preview.textContent=ok?"■ 再生停止":"▶ アバターに再生";
 });
 make("JSONをコピー",async()=>{
  if(!json.value){state.textContent="記録がありません";return;}
  try{await navigator.clipboard.writeText(json.value);state.textContent="コピーしました。ChatGPTに貼り付けて送信してください。";}
  catch(_){json.focus();json.select();state.textContent="テキストを選択しました。手動でコピーしてください。";}
 });
 make("JSONファイル保存",()=>{
  if(!json.value){state.textContent="記録がありません";return;}
  const blob=new Blob([json.value],{type:"application/json"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");a.href=url;a.download="universal-engine-xr-motion.json";a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
 });
 make("記録を消去",()=>{
  recorder.clear();setXRMotionPlayback(null);armed.checked=false;preview.textContent="▶ アバターに再生";refresh();
 });
 box.append(note,armedLabel,tools,state,summary,json);
 host?.append(box);refresh();
 return {
  recorder,get armed(){return armed.checked;},
  start,finish,refresh,
  onSessionStart(floorTracked){if(armed.checked)start({floorTracked});},
  onSessionEnd(){finish();},
  onCapture(timeMs,data){
   if(!recorder.recording)return;
   const wasRecording=recorder.recording;recorder.capture(timeMs,data);
   if(wasRecording&&!recorder.recording){armed.checked=false;refresh();}
  },
  stop(){finish();armed.checked=false;},
  dispose(){setXRMotionPlayback(null);recorder.clear();box.remove();}
 };
}
