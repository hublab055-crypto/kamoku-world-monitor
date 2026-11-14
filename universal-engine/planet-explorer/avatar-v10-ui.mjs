import {AVATAR_V10_DEFAULTS,AVATAR_V10_FACE,AVATAR_V10_MODELS,AVATAR_V10_OUTFITS,normalizeAvatarV10} from "./avatar-v10.mjs?v=20261114-full-body";
import {AvatarV10Assets} from "./avatar-v10-assets.mjs?v=20261114-full-body";
import {lookAt,multiply4,perspective} from "./render.mjs?v=20261114-v10-crew";
import {requiresAvatarWardrobeUnlock,avatarWardrobeUnlocked,unlockAvatarWardrobe} from "./avatar-v10-wardrobe.mjs?v=1";
import {partControls,hairStyles,normalizeAppearance,rangeText,fromReviewStorage,reviewModelKey} from "./avatar-review-parameters.mjs?v=20261114-original";
import {AVATAR_V10_BODY,AVATAR_V10_SWIM_STYLES,AVATAR_V10_SWIM_COLORS} from "./avatar-v10-body.mjs?v=20261114-body";

const names={player:"自分",navigator:"副官（航法・通信）",engineer:"機関士",companion:"同行者"};
const identity=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];

export function installAvatarV10Editor({getRoster,apply,save}) {
 const dialog=document.getElementById("avatar-v10-dialog");
 const form=dialog.querySelector("form"),canvas=dialog.querySelector("canvas");
 const select=form.elements.person,model=form.elements.model,outfit=form.elements.outfit;
 const fields=form.querySelector("#avatar-v10-features");
 const status=form.querySelector("output");
 let asset=null,fit=null,token=0,raf=0,preview=null,rotation=0,faceView=true;
 const drafts=new Map();
 const reviewInputs=new Map();
 function option(value,label){return new Option(label,value);}
 for(const [id,name] of Object.entries(names))select.add(option(id,name));
 for(const [id,name] of Object.entries(AVATAR_V10_MODELS))model.add(option(id,name));
 for(const [id,name] of Object.entries(AVATAR_V10_OUTFITS))outfit.add(option(id,name));
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
   const next={...fit,appearance:{...parsed,outfit:selected},outfit:selected};
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
  raf=requestAnimationFrame(()=>{
   raf=0;
   if(!dialog.open||!preview)return;
   const {gl}=preview;
   const dpr=Math.min(1.5,window.devicePixelRatio||1);
   const w=Math.max(1,Math.round(canvas.clientWidth*dpr)),h=Math.max(1,Math.round(canvas.clientHeight*dpr));
   if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
   gl.viewport(0,0,w,h);gl.enable(gl.DEPTH_TEST);
   gl.clearColor(.065,.119,.17,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
   if(!asset)return;
   const near=faceView&&fit.outfit!=="space",distance=near?.82:3.25;
   const y=near?1.57:.91;
   const eye=[distance*Math.sin(rotation),y+.03,distance*Math.cos(rotation)];
   const vp=multiply4(perspective(.66,w/h,.035,20),lookAt(eye,[0,y,0]));
   asset.draw(vp,identity,[-.38,.9,.72],"editor",0,{time:0,fit});
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
    asset=result;status.value="";invalidate();
   }).catch(error=>{if(request===token)status.value="プレビューを表示できませんでした。 "+error.message;});
  }catch(error){status.value=error.message;}
 }
 function controls(next){
  fit=requiresAvatarWardrobeUnlock(next.outfit)&&!unlocked()?
   {...next,outfit:"work",appearance:{...normalizeAppearance(next.appearance),outfit:"work"}}:
   {...next,appearance:normalizeAppearance(next.appearance)};
  pendingOutfit=null;gate.hidden=true;gateCode.value="";
  model.value=fit.model;outfit.value=fit.outfit;
  swimFields.hidden=fit.outfit!=="swim";
  swimStyle.value=fit.swim.style;swimColor.value=fit.swim.color;
  const disabled=fit.model==="classic";
  outfit.disabled=disabled;swimStyle.disabled=disabled;swimColor.disabled=disabled;
  hairSelect.value=fit.appearance.hairStyle;hairSelect.disabled=disabled;
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
  controls({...fit,model:model.value});
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
   for(const item of form.querySelectorAll("[data-avatar-view]"))
    item.setAttribute("aria-pressed",String(item===button));
   invalidate();
  });
 }
 let pointer=null,startX=0;
 canvas.addEventListener("pointerdown",event=>{
  pointer=event.pointerId;startX=event.clientX;
  canvas.setPointerCapture(pointer);
 });
 canvas.addEventListener("pointermove",event=>{
  if(pointer!==event.pointerId)return;
  rotation+=(event.clientX-startX)*.015;startX=event.clientX;invalidate();
 });
 for(const event of ["pointerup","pointercancel","lostpointercapture"])
  canvas.addEventListener(event,()=>{pointer=null;});
 canvas.addEventListener("keydown",event=>{
  if(event.key!=="ArrowLeft"&&event.key!=="ArrowRight")return;
  event.preventDefault();rotation+=(event.key==="ArrowLeft"?-.24:.24);invalidate();
 });
 form.addEventListener("submit",event=>{
  event.preventDefault();
  if(event.submitter?.value==="cancel"){dialog.close();return;}
  if(pendingOutfit!==null){status.value="確認コードを入力するか取り消してください。";return;}
  if(requiresAvatarWardrobeUnlock(fit.outfit)&&!unlocked()){
   status.value="この衣装には確認コードが必要です。";return;
  }
  const roster={...getRoster(),...Object.fromEntries(drafts)};
  if(!save(roster)){
   status.value="このブラウザに保存できませんでした。ゲーム内には反映しました。";
   apply(roster);return;
  }
  apply(roster);dialog.close();
 });
 dialog.addEventListener("close",()=>{
  drafts.clear();token++;asset=null;
  pendingOutfit=null;gate.hidden=true;gateCode.value="";
  preview?.assets.destroy();preview=null;
  if(raf)cancelAnimationFrame(raf);
  raf=0;
 });
 window.addEventListener("resize",()=>{if(dialog.open)invalidate();});
 return {open(id="player"){
  if(dialog.open)return;
  rotation=0;
  dialog.showModal();
  choosePerson(Object.hasOwn(AVATAR_V10_DEFAULTS,id)?id:"player");
 }};
}
