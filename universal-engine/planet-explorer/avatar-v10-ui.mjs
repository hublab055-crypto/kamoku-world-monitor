import {AVATAR_V10_DEFAULTS,AVATAR_V10_FACE,AVATAR_V10_MODELS,AVATAR_V10_OUTFITS,normalizeAvatarV10} from "./avatar-v10.mjs?v=20261117-anatomy-view";
import {AvatarV10Assets} from "./avatar-v10-assets.mjs?v=20261117-family-gestures";
import {lookAt,multiply4,perspective} from "./render.mjs?v=20261117-family-gestures";
import {requiresAvatarWardrobeUnlock,avatarWardrobeUnlocked,unlockAvatarWardrobe} from "./avatar-v10-wardrobe.mjs?v=1";
import {partControls,hairStyles,normalizeAppearance,rangeText,fromReviewStorage,reviewModelKey} from "./avatar-review-parameters.mjs?v=20261114-original";
import {AVATAR_V10_BODY,AVATAR_V10_SWIM_STYLES,AVATAR_V10_SWIM_COLORS} from "./avatar-v10-body.mjs?v=20261114-body";
import {AVATAR_DAILY_ACTIONS} from "./avatar-daily-actions.mjs?v=20261115";
import {ANATOMY_PRESETS,ANATOMY_BODY_SOURCES,ANATOMY_LAYERS,ANATOMY_SLIDERS,visibleAnatomyRegions,normalizeAvatarAnatomy} from "./avatar-anatomy-schema.mjs?v=20261117-anatomy-view";

const names={player:"自分",navigator:"副官（航法・通信）",engineer:"機関士",companion:"同行者"};
const identity=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];

export function installAvatarV10Editor({getRoster,apply,save}) {
 const dialog=document.getElementById("avatar-v10-dialog");
 const form=dialog.querySelector("form"),canvas=dialog.querySelector("canvas");
 const select=form.elements.person,model=form.elements.model,outfit=form.elements.outfit;
 const fields=form.querySelector("#avatar-v10-features");
 const status=form.querySelector("output");
 let asset=null,fit=null,token=0,raf=0,preview=null,rotation=0,faceView=true,previewZoom=1,expanded=false,focusPart="body";
 let previewAction="idle",previewTime=0,previewLast=0,previewHand="right";
 const drafts=new Map();
 const motionRow=document.createElement("div");
 motionRow.className="avatar-v10-motion";
 motionRow.style.cssText="display:flex;align-items:center;gap:6px;flex-wrap:wrap;font-size:12px";
 const motionLabel=document.createElement("label");
 motionLabel.textContent="モーション試験 ";
 const motionChoice=document.createElement("select");motionChoice.setAttribute("aria-label","アバターのモーション");
 motionChoice.add(new Option("直立・待機","idle"));
 for(const [id,spec] of Object.entries(AVATAR_DAILY_ACTIONS))
  motionChoice.add(new Option(spec.label,id));
 motionLabel.append(motionChoice);
 const handLabel=document.createElement("label");handLabel.textContent="手 ";
 const handChoice=document.createElement("select");handChoice.setAttribute("aria-label","拾い上げる手");
 handChoice.add(new Option("右手","right"));handChoice.add(new Option("左手","left"));
 handLabel.append(handChoice);
 const restart=document.createElement("button");restart.type="button";restart.textContent="▶ 再生";
 motionRow.append(motionLabel,handLabel,restart);
 canvas.parentElement?.append(motionRow);
 const zoomRow=document.createElement("div");zoomRow.className="avatar-v10-zoom";
 const zoomLabel=document.createElement("label");zoomLabel.textContent="🔍 拡大率 ";
 const zoomInput=document.createElement("input");zoomInput.type="range";zoomInput.min="0.7";zoomInput.max="2.6";zoomInput.step="0.05";zoomInput.value="1";zoomInput.setAttribute("aria-label","アバター拡大率");
 const zoomValue=document.createElement("output");zoomValue.textContent="100%";
 const magnify=document.createElement("button");magnify.type="button";magnify.textContent="⛶ 大きく表示";magnify.setAttribute("aria-pressed","false");
 zoomLabel.append(zoomInput,zoomValue);zoomRow.append(zoomLabel,magnify);motionRow.before(zoomRow);
 function setZoom(value){
  previewZoom=Math.max(.7,Math.min(2.6,Number(value)||1));
  zoomInput.value=String(previewZoom);zoomValue.textContent=Math.round(previewZoom*100)+"%";invalidate();
 }
 const focusRow=document.createElement("div");
 focusRow.className="avatar-v10-focus";
 focusRow.style.cssText="display:flex;flex-wrap:wrap;gap:5px;align-items:center;margin:4px 0 8px";
 const focusButtons=new Map();
 for(const [id,label] of [["body","全身を表示"],["torso","胸・腹を確認"],["feet","足首・かかと・つま先"]]){
  const button=document.createElement("button");button.type="button";
  button.textContent=label;button.dataset.avatarFocus=id;
  button.addEventListener("click",()=>{
   focusPart=id;faceView=false;
   for(const b of form.querySelectorAll("[data-avatar-view]"))
    b.setAttribute("aria-pressed",String(b.dataset.avatarView==="body"));
   for(const [part,option] of focusButtons)
    option.setAttribute("aria-pressed",String(part===id));
   setZoom(1);
  });
  focusButtons.set(id,button);focusRow.append(button);
 }
 focusButtons.get("body").setAttribute("aria-pressed","true");
 zoomRow.after(focusRow);
 zoomInput.addEventListener("input",()=>setZoom(zoomInput.value));
 magnify.addEventListener("click",()=>{
  expanded=!expanded;dialog.classList.toggle("avatar-v10-large",expanded);
  magnify.textContent=expanded?"⛶ 通常表示":"⛶ 大きく表示";
  magnify.setAttribute("aria-pressed",String(expanded));invalidate();
 });
 canvas.addEventListener("wheel",event=>{event.preventDefault();setZoom(previewZoom*(event.deltaY<0?1.08:.92));},{passive:false});
 const anatomyNote=document.createElement("small");
 anatomyNote.textContent="素体には成人の授乳用の乳頭・乳輪の位置目印があります。衣服・水着には表示しません。乳児・授乳機能の実装は別段階です。";
 anatomyNote.style.cssText="display:block;font-size:11px;color:#9ab6c4";
 motionRow.after(anatomyNote);
 motionChoice.addEventListener("change",()=>{
  previewAction=motionChoice.value;previewTime=0;previewLast=0;
  if(previewAction!=="idle"){
   faceView=false;
   for(const button of form.querySelectorAll("[data-avatar-view]"))
    button.setAttribute("aria-pressed",String(button.dataset.avatarView==="body"));
  }
  invalidate();
 });
 handChoice.addEventListener("change",()=>{previewHand=handChoice.value;previewTime=0;invalidate();});
 restart.addEventListener("click",()=>{previewTime=0;previewLast=0;invalidate();});
 const reviewInputs=new Map(),anatomyInputs=new Map();
 function option(value,label){return new Option(label,value);}
 for(const [id,name] of Object.entries(names))select.add(option(id,name));
 for(const [id,name] of Object.entries(AVATAR_V10_MODELS))model.add(option(id,name));
 for(const [id,name] of Object.entries(AVATAR_V10_OUTFITS))outfit.add(option(id,name));
 // The shipped Lyra GLB is available unchanged, alongside editable Review mode.
 const officerModeLabel=document.createElement("label");
 officerModeLabel.textContent="副官の外観 ";
 const officerMode=document.createElement("select");
 officerMode.setAttribute("aria-label","副官の外観");
 officerMode.add(option("original","元の副官モデル（V10ライラ）"));
 officerMode.add(option("modified","モディファイ版"));
 officerModeLabel.append(officerMode);
 const officerModeHint=document.createElement("small");
 officerModeHint.textContent="元モデルは変更前のGLB形状を保持します。モディファイ版では顔・体型・衣装を編集できます。";
 model.closest("label").after(officerModeLabel,officerModeHint);
 officerMode.addEventListener("change",()=>{
  const original=officerMode.value==="original";
  controls(original?{...fit,model:"lyra",outfit:"work",preserveOriginal:true}:
   {...fit,preserveOriginal:false});
  drafts.set(select.value,fit);loadPreview();
 });
 // Restricted study outfits require a one-time per-device confirmation.
 let sessionUnlocked=false,pendingOutfit=null;
 const store=()=>typeof localStorage==="undefined"?null:localStorage;
 const unlocked=()=>sessionUnlocked||avatarWardrobeUnlocked(store());
 const gate=document.createElement("div");gate.hidden=true;
 gate.style.cssText="padding:8px;margin:6px 0;border:1px solid #7aa;border-radius:8px;";
 const gateLabel=document.createElement("label");gateLabel.textContent="初回確認コード（4桁） ";
 const gateCode=document.createElement("input");
 gateCode.type="password";gateCode.inputMode="numeric";gateCode.autocomplete="off";
 gateCode.maxLength=4;gateCode.pattern="[0-9]{4}";gateCode.placeholder="4桁";gateCode.style.width="6em";
 gateLabel.append(gateCode);
 const confirm=document.createElement("button");confirm.type="button";confirm.textContent="確認";
 const cancel=document.createElement("button");cancel.type="button";cancel.textContent="取り消す";
 const note=document.createElement("small");
 note.textContent="水着・素体は初回のみ確認します。ブラウザ内の簡易制限で、保護者認証や暗号化ではありません。";
 gate.append(gateLabel,confirm,cancel,note);outfit.closest("label").after(gate);
 const reviewLink=document.createElement("a");
 reviewLink.href="https://universal-engine-avatar-review.papatomfoundation.chatgpt.site";
 reviewLink.target="_blank";reviewLink.rel="noopener noreferrer";
 reviewLink.textContent="🔗 元のAvatar Reviewサイトを開く（別タブ）";
 reviewLink.style.cssText="display:block;margin:9px 0;color:#8de9f1;text-decoration:underline;font-size:13px;";
 const reviewNote=document.createElement("small");
 reviewNote.textContent="レビューサイトとは保存領域が異なるため、設定はまだ自動同期されません。移行には下のJSON読み込み・書き出しを使用してください。";
 gate.after(reviewLink,reviewNote);
 const swimFields=document.createElement("section");swimFields.className="avatar-v10-swim";
 const swimStyleLabel=document.createElement("label");swimStyleLabel.textContent="水着の形 ";
 const swimStyle=document.createElement("select");swimStyle.setAttribute("aria-label","水着の形");
 for(const [id,name] of Object.entries(AVATAR_V10_SWIM_STYLES))swimStyle.add(option(id,name));
 swimStyleLabel.append(swimStyle);
 const swimColorLabel=document.createElement("label");swimColorLabel.textContent="水着の色 ";
 const swimColor=document.createElement("select");swimColor.setAttribute("aria-label","水着の色");
 for(const [id,entry] of Object.entries(AVATAR_V10_SWIM_COLORS))swimColor.add(option(id,entry.label));
 swimColorLabel.append(swimColor);swimFields.append(swimStyleLabel,swimColorLabel);gate.after(swimFields);
 const updateSwim=()=>{
  fit={...fit,swim:{style:swimStyle.value,color:swimColor.value}};
  drafts.set(select.value,fit);invalidate();
 };
 swimStyle.addEventListener("change",updateSwim);
 swimColor.addEventListener("change",updateSwim);
 function setOutfit(value){
  fit={...fit,outfit:value,appearance:{...fit.appearance,outfit:value}};outfit.value=value;swimFields.hidden=value!=="swim";
  drafts.set(select.value,fit);invalidate();
 }
 confirm.addEventListener("click",()=>{
  if(pendingOutfit===null)return;
  if(!unlockAvatarWardrobe(store(),gateCode.value)){
   if(gateCode.value.trim()!=="9876"){
    status.value="確認コードが違います。";gateCode.select();return;
   }
   sessionUnlocked=true;
  }
  const selected=pendingOutfit;pendingOutfit=null;gate.hidden=true;gateCode.value="";
  status.value=selected==="swim"?"全身の水着モードに切り替えました。形と色を変更できます。":"素体：全身のベースメッシュを表示します。";
  faceView=false;
  for(const button of form.querySelectorAll("[data-avatar-view]"))
   button.setAttribute("aria-pressed",String(button.dataset.avatarView==="body"));
  setOutfit(selected);
  if(["swim","base"].includes(selected)){
   faceView=false;
   for(const button of form.querySelectorAll("[data-avatar-view]"))
    button.setAttribute("aria-pressed",String(button.dataset.avatarView==="body"));
   invalidate();
  }
 });
 cancel.addEventListener("click",()=>{pendingOutfit=null;gate.hidden=true;gateCode.value="";outfit.value=fit.outfit;});
 gateCode.addEventListener("keydown",event=>{
  if(event.key==="Enter"){event.preventDefault();confirm.click();}
 });


 // The ZIP editor is authoritative: preserve every original control,
 // its percentage range, neutral value and Japanese label.
 const reviewHeader=document.createElement("div");
 reviewHeader.className="avatar-review-header";
 reviewHeader.textContent="アバターレビュー版｜部位別モディファイ";
 fields.append(reviewHeader);
 const reviewHint=document.createElement("small");
 reviewHint.textContent="元のAvatar Reviewと同じ数値・保存形式です。骨格・顔・衣装の描画はUniversal EngineのGLBに合わせて変換されます。";
 fields.append(reviewHint);
 // Optional non-clinical anatomy controls. All original Review inputs and
 // outfit unlock requirements remain untouched.
 const anatomySection=document.createElement("details");
 anatomySection.className="avatar-review-group";
 const anatomySummary=document.createElement("summary");anatomySummary.textContent="🩺 人体構造・軟部組織（追加モード）";
 anatomySection.append(anatomySummary);
 const anatomyIntro=document.createElement("small");
 anatomyIntro.textContent="素体で皮膚を透明化し、骨格・筋肉・臓器の簡易3Dモデルを重ねて観察できます。教材用の概形であり、人体の医療・手術判断には利用できません。";
 anatomySection.append(anatomyIntro);
 const sourceLabel=document.createElement("label");sourceLabel.textContent="素体の形状 ";
 const anatomySource=document.createElement("select");anatomySource.setAttribute("aria-label","素体の形状方式");
 for(const [key,label] of Object.entries(ANATOMY_BODY_SOURCES))anatomySource.add(new Option(label,key));
 sourceLabel.append(anatomySource);anatomySection.append(sourceLabel);
 const sourceHint=document.createElement("small");
 sourceHint.textContent="標準は服の形を使わず骨格から一体の人体表面を生成します。従来の肌色衣服方式も比較用に残します。";
 anatomySection.append(sourceHint);
 const anatomyLayerLabel=document.createElement("label");anatomyLayerLabel.textContent="観察する層 ";
 const anatomyLayer=document.createElement("select");anatomyLayer.setAttribute("aria-label","人体構造の層");
 for(const [key,label] of Object.entries(ANATOMY_LAYERS))anatomyLayer.add(new Option(label,key));
 anatomyLayerLabel.append(anatomyLayer);anatomySection.append(anatomyLayerLabel);
 const opacityRow=document.createElement("label");opacityRow.className="avatar-review-control";
 const opacityLabel=document.createElement("span");opacityLabel.textContent="皮膚の透明度（透視用）";
 const opacityRange=document.createElement("input");opacityRange.type="range";opacityRange.min="10";opacityRange.max="90";opacityRange.step="5";
 opacityRange.setAttribute("aria-label","素体の皮膚透明度");
 const opacityOutput=document.createElement("output");opacityOutput.textContent="70%";
 opacityRow.append(opacityLabel,opacityRange,opacityOutput);anatomySection.append(opacityRow);
 opacityRange.addEventListener("input",()=>{
  opacityOutput.textContent=String(100-opacityRange.valueAsNumber)+"%";
  updateAnatomy("opacity",opacityRange.valueAsNumber);
 });
 const anatomyPresetLabel=document.createElement("label");anatomyPresetLabel.textContent="骨盤内の解剖学的モデル ";
 const anatomyPreset=document.createElement("select");anatomyPreset.setAttribute("aria-label","骨盤内の解剖学的モデル");
 for(const [key,label] of Object.entries(ANATOMY_PRESETS))anatomyPreset.add(new Option(label,key));
 anatomyPresetLabel.append(anatomyPreset);anatomySection.append(anatomyPresetLabel);
 const regionList=document.createElement("div");
 regionList.style.cssText="max-height:120px;overflow:auto;padding:3px 5px;border-left:2px solid #75a6b5;margin:5px 0;color:#a8cfe3;font:11px/1.45 system-ui";
 anatomySection.append(regionList);
 function renderAnatomyList(){
  const current=normalizeAvatarAnatomy(fit?.anatomy);
  const items=visibleAnatomyRegions(current);
  regionList.replaceChildren();
  for(const part of items){
   const row=document.createElement("div");
   row.textContent=part.name+"："+part.detail;
   regionList.append(row);
  }
  if(["xray","bones","muscle","organs"].includes(current.layer)){
   const note=document.createElement("small");
   note.textContent="※ 3Dは骨格に追従する教育用の概形です。組織の精密形状、切開・手術シミュレーションではありません。";
   regionList.prepend(note);
  }
 }
 function updateAnatomy(key,value){
  const next={...normalizeAvatarAnatomy(fit.anatomy),[key]:value};
  if(key==="layer"&&value!=="skin"&&next.source==="legacy"){
   next.source="procedural";anatomySource.value="procedural";
  }
  fit={...fit,anatomy:next};
  opacityRow.hidden=next.layer==="skin";
  drafts.set(select.value,fit);renderAnatomyList();invalidate();
 }
 anatomySource.addEventListener("change",()=>updateAnatomy("source",anatomySource.value));
 anatomyLayer.addEventListener("change",()=>updateAnatomy("layer",anatomyLayer.value));
 anatomyPreset.addEventListener("change",()=>updateAnatomy("preset",anatomyPreset.value));
 const sliders=document.createElement("div");
 sliders.style.cssText="display:grid;gap:3px;margin:5px 0";
 for(const [key,label] of ANATOMY_SLIDERS){
  const row=document.createElement("label");row.className="avatar-review-control";
  const name=document.createElement("span");name.textContent=label;
  const input=document.createElement("input");
  input.type="range";input.min="-100";input.max="100";input.step="1";
  input.setAttribute("aria-label","人体構造｜"+label);
  const value=document.createElement("output");
  input.addEventListener("input",()=>{value.value=input.value;updateAnatomy(key,input.valueAsNumber);});
  row.append(name,input,value);sliders.append(row);anatomyInputs.set(key,{input,value});
 }
 anatomySection.append(sliders);
 fields.append(anatomySection);
 const hairLabel=document.createElement("label");hairLabel.textContent="髪型 ";
 const hairSelect=document.createElement("select");hairSelect.setAttribute("aria-label","髪型");
 for(const [id,name] of Object.entries(hairStyles))hairSelect.add(option(id,name));
 hairLabel.append(hairSelect);fields.append(hairLabel);
 hairSelect.addEventListener("change",()=>{
  fit={...fit,appearance:{...fit.appearance,hairStyle:hairSelect.value}};
  drafts.set(select.value,fit);invalidate();
 });
 for(const [part,{label:group,controls}] of Object.entries(partControls)){
  const section=document.createElement("details");
  section.className="avatar-review-group";section.open=["face","chest","torso"].includes(part);
  const summary=document.createElement("summary");summary.textContent=group;
  section.append(summary);
  for(const {key,label,min,max} of controls){
   const row=document.createElement("label");row.className="avatar-review-control";
   const name=document.createElement("span");name.textContent=label;
   const input=document.createElement("input");
   input.type="range";input.min=min;input.max=max;input.step=1;
   input.setAttribute("aria-label",group+"｜"+label);
   const value=document.createElement("output");
   input.addEventListener("input",()=>{
    const n=input.valueAsNumber;
    fit={...fit,appearance:{...fit.appearance,[key]:n}};
    value.value=rangeText(key,n);
    input.setAttribute("aria-valuetext",value.value);
    drafts.set(select.value,fit);invalidate();
   });
   row.append(name,input,value);section.append(row);
   reviewInputs.set(key,{input,value});
  }
  fields.append(section);
 }
 const transfer=document.createElement("div");transfer.className="avatar-review-transfer";
 const importFile=document.createElement("input");
 importFile.type="file";importFile.accept=".json,application/json";importFile.hidden=true;
 const load=document.createElement("button");load.type="button";
 load.textContent="📂 レビュー設定JSONを読み込む";
 load.addEventListener("click",()=>importFile.click());
 importFile.addEventListener("change",async()=>{
  const file=importFile.files?.[0];if(!file)return;
  try{
   if(file.size>250000)throw Error("設定ファイルは250KB以内にしてください");
   const raw=await file.text(),data=JSON.parse(raw);
   const parsed=fromReviewStorage(data,fit.model);
   if(!parsed)throw Error("選択中モデルのキー "+reviewModelKey(fit.model)+" が見つかりません");
   const selected=requiresAvatarWardrobeUnlock(parsed.outfit)&&!unlocked()?"work":parsed.outfit;
   const next={...fit,appearance:{...parsed,outfit:selected},outfit:selected,preserveOriginal:false};
   controls(next);drafts.set(select.value,fit);invalidate();
   status.value=selected!==parsed.outfit?
    "設定を読み込みました。素体・水着の表示には初回コード9876が必要です。":
    "レビュー設定を読み込みました。保存して反映してください。";
  }catch(error){status.value="レビュー設定を読み込めません: "+error.message;}
  finally{importFile.value="";}
 });
 const saveJson=document.createElement("button");saveJson.type="button";
 saveJson.textContent="💾 レビュー設定JSONを書き出す";
 saveJson.addEventListener("click",()=>{
  if(fit.model==="classic"){status.value="V10モデルを選んでください";return;}
  const data=JSON.stringify({[reviewModelKey(fit.model)]:normalizeAppearance(fit.appearance)},null,2);
  const url=URL.createObjectURL(new Blob([data],{type:"application/json"}));
  const link=document.createElement("a");link.href=url;
  link.download="avatar-review-"+fit.model+".json";
  link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 });
 transfer.append(load,saveJson,importFile);fields.append(transfer);
 function renderer(){
  if(preview)return preview;
  const gl=canvas.getContext("webgl2",{antialias:true,alpha:false});
  if(!gl)throw Error("3DプレビューにWebGL 2が必要です");
  preview={gl,assets:new AvatarV10Assets(gl)};
  return preview;
 }
 function invalidate(){
  if(raf)return;
  raf=requestAnimationFrame(now=>{
   raf=0;
   const duration=AVATAR_DAILY_ACTIONS[previewAction]?.seconds||0;
   const step=previewLast?Math.min(.05,Math.max(0,(now-previewLast)/1000)):0;
   previewLast=now;
   if(previewAction!=="idle")previewTime+=step;
   if(!dialog.open||!preview)return;
   const {gl}=preview;
   const dpr=Math.min(1.5,window.devicePixelRatio||1);
   const w=Math.max(1,Math.round(canvas.clientWidth*dpr)),h=Math.max(1,Math.round(canvas.clientHeight*dpr));
   if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
   gl.viewport(0,0,w,h);gl.enable(gl.DEPTH_TEST);
   gl.clearColor(.065,.119,.17,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
   if(!asset)return;
   const near=faceView&&fit.outfit!=="space";
   // Explicit foot and torso cameras keep the heel / toe and navel inspectable.
   const baseDistance=near?.92:focusPart==="feet"?1.13:focusPart==="torso"?1.60:3.85;
   const distance=baseDistance/previewZoom;
   const y=near?1.57:focusPart==="feet"?.20:focusPart==="torso"?1.10:.98;
   const eye=[distance*Math.sin(rotation),y+.03,distance*Math.cos(rotation)];
   const vp=multiply4(perspective(.66,w/h,.035,20),lookAt(eye,[0,y,0]));
   asset.draw(vp,identity,[-.38,.9,.72],"editor",step,{time:previewTime,fit,motion:previewAction,
    motionProgress:duration?Math.min(1,previewTime/duration):0,hand:previewHand});
   if(fit.outfit==="base"&&fit.anatomy?.source!=="legacy"&&asset.proceduralAttempted&&!asset.proceduralBody)
    status.value="このモデルの骨格が不足し、人体専用の素体を生成できません。旧方式で表示しています。";
   if(previewAction!=="idle"&&(!duration||AVATAR_DAILY_ACTIONS[previewAction]?.loop||previewTime<duration))invalidate();
  });
 }
 function loadPreview(){
  const request=++token;
  asset=null;invalidate();
  if(fit.model==="classic"){status.value="従来モデルはゲーム画面で確認できます。";return;}
  status.value="3Dモデルを読み込んでいます。";
  try{
   renderer().assets.load(fit.model).then(result=>{
    if(!dialog.open||request!==token)return;
    asset=result;status.value=fit.preserveOriginal?"元の副官モデルをそのまま表示しています。":"";invalidate();
   }).catch(error=>{if(request===token)status.value="プレビューを表示できませんでした。 "+error.message;});
  }catch(error){status.value=error.message;}
 }
 function controls(next){
  fit=requiresAvatarWardrobeUnlock(next.outfit)&&!unlocked()?
   {...next,outfit:"work",appearance:{...normalizeAppearance(next.appearance),outfit:"work"}}:
   {...next,appearance:normalizeAppearance(next.appearance)};
  pendingOutfit=null;gate.hidden=true;gateCode.value="";
  const original=select.value==="navigator"&&fit.preserveOriginal;
  officerModeLabel.hidden=select.value!=="navigator";officerModeHint.hidden=select.value!=="navigator";
  officerMode.value=original?"original":"modified";
  model.value=fit.model;model.disabled=original;outfit.value=fit.outfit;
  swimFields.hidden=fit.outfit!=="swim";
  swimStyle.value=fit.swim.style;swimColor.value=fit.swim.color;
  const disabled=fit.model==="classic"||original;
  load.disabled=original;saveJson.disabled=original;
  outfit.disabled=disabled;swimStyle.disabled=disabled;swimColor.disabled=disabled;
  hairSelect.value=fit.appearance.hairStyle;hairSelect.disabled=disabled;
  anatomySource.value=fit.anatomy?.source||"procedural";
  anatomySource.disabled=disabled;
  anatomyLayer.value=fit.anatomy?.layer||"skin";
  opacityRange.value=fit.anatomy?.opacity??30;
  opacityOutput.textContent=String(100-Number(opacityRange.value))+"%";
  opacityRow.hidden=anatomyLayer.value==="skin";
  opacityRange.disabled=disabled;
  anatomyPreset.value=fit.anatomy?.preset||"neutral";
  anatomyLayer.disabled=disabled;anatomyPreset.disabled=disabled;
  for(const [key,{input,value}] of anatomyInputs){
   const setting=fit.anatomy?.[key]??0;
   input.value=setting;value.value=String(setting);input.disabled=disabled;
  }
  renderAnatomyList();
  for(const [key,{input,value}] of reviewInputs){
   input.value=fit.appearance[key];
   input.disabled=disabled||(key.startsWith("hair")&&fit.appearance.hairStyle==="bald");
   value.value=rangeText(key,fit.appearance[key]);
   input.setAttribute("aria-valuetext",value.value);
  }
 }
 function choosePerson(id){
  select.value=id;
  const classic=model.querySelector('option[value="classic"]');
  if(id==="player"&&!classic)model.add(option("classic","従来のプレイヤーモデル"));
  else if(id!=="player")classic?.remove();
  controls(drafts.get(id)||normalizeAvatarV10(id,getRoster()[id]));
  loadPreview();
 }
 select.addEventListener("change",()=>choosePerson(select.value));
 model.addEventListener("change",()=>{
  controls({...fit,model:model.value,preserveOriginal:false});
  drafts.set(select.value,fit);loadPreview();
 });
 outfit.addEventListener("change",()=>{
  const selected=outfit.value;
  if(requiresAvatarWardrobeUnlock(selected)&&!unlocked()){
   pendingOutfit=selected;outfit.value=fit.outfit;gate.hidden=false;
   status.value="水着・素体の初回表示には確認コードが必要です。";gateCode.focus();
   return;
  }
  setOutfit(selected);
  if(["base","swim"].includes(selected)){
   faceView=false;
   for(const button of form.querySelectorAll("[data-avatar-view]"))
    button.setAttribute("aria-pressed",String(button.dataset.avatarView==="body"));
   invalidate();
  }
 });
 form.querySelector("#avatar-v10-reset").addEventListener("click",()=>{
  controls(normalizeAvatarV10(select.value));
  drafts.set(select.value,fit);loadPreview();
 });
 for(const button of form.querySelectorAll("[data-avatar-view]")){
  button.addEventListener("click",()=>{
   faceView=button.dataset.avatarView==="face";
   if(!faceView)focusPart="body";
   for(const item of form.querySelectorAll("[data-avatar-view]"))
    item.setAttribute("aria-pressed",String(item===button));
   invalidate();
  });
 }
 const pointers=new Map();let pinchDistance=null;
 canvas.addEventListener("pointerdown",event=>{
  pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
  canvas.setPointerCapture(event.pointerId);
  if(pointers.size!==2)pinchDistance=null;
 });
 canvas.addEventListener("pointermove",event=>{
  const previous=pointers.get(event.pointerId);if(!previous)return;
  pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
  if(pointers.size===2){
   const [a,b]=[...pointers.values()],distance=Math.hypot(a.x-b.x,a.y-b.y);
   if(pinchDistance)setZoom(previewZoom*distance/pinchDistance);
   pinchDistance=distance;
  }else{rotation+=(event.clientX-previous.x)*.015;invalidate();}
 });
 for(const type of ["pointerup","pointercancel","lostpointercapture"])
  canvas.addEventListener(type,event=>{pointers.delete(event.pointerId);pinchDistance=null;});
 canvas.addEventListener("keydown",event=>{
  if(event.key!=="ArrowLeft"&&event.key!=="ArrowRight")return;
  event.preventDefault();rotation+=(event.key==="ArrowLeft"?-.24:.24);invalidate();
 });
 const applyCurrent=document.createElement("button");applyCurrent.type="button";
 applyCurrent.id="avatar-v10-apply-current";applyCurrent.textContent="現在の設定をクルーに反映";
 const footer=form.querySelector(".avatar-v10-footer");
 if(footer)footer.prepend(applyCurrent);
 else (form.querySelector('button[type="submit"]')?.parentElement||form).append(applyCurrent);
 function commit(closeOnSuccess){
  if(pendingOutfit!==null){status.value="確認コードを入力するか取り消してください。";return;}
  if(requiresAvatarWardrobeUnlock(fit.outfit)&&!unlocked()){
   status.value="この衣装には確認コードが必要です。";return;
  }
  const roster={...getRoster(),...Object.fromEntries(drafts),[select.value]:fit};
  const stored=save(roster);
  apply(roster);
  if(!stored){status.value="ゲーム内には反映しましたが、この端末への保存に失敗しました。";return;}
  status.value="現在の設定を保存し、船内の乗員アバターに反映しました。";
  if(closeOnSuccess)dialog.close();
 }
 applyCurrent.addEventListener("click",()=>commit(false));
 form.addEventListener("submit",event=>{
  event.preventDefault();
  if(event.submitter?.value==="cancel"){dialog.close();return;}
  commit(true);
 });
 dialog.addEventListener("close",()=>{
  drafts.clear();token++;asset=null;
  pendingOutfit=null;gate.hidden=true;gateCode.value="";
  preview?.assets.destroy();preview=null;previewAction="idle";previewTime=0;previewLast=0;motionChoice.value="idle";
  if(raf)cancelAnimationFrame(raf);
  raf=0;
 });
 window.addEventListener("resize",()=>{if(dialog.open)invalidate();});
 return {open(id="player"){
  if(dialog.open)return;
  rotation=0;focusPart="body";setZoom(1);expanded=false;dialog.classList.remove("avatar-v10-large");
  for(const [part,option] of focusButtons)
   option.setAttribute("aria-pressed",String(part==="body"));
  magnify.textContent="⛶ 大きく表示";magnify.setAttribute("aria-pressed","false");
  dialog.showModal();
  choosePerson(Object.hasOwn(AVATAR_V10_DEFAULTS,id)?id:"player");
 }};
}
