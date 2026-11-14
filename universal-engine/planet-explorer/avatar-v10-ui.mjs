import {AVATAR_V10_DEFAULTS,AVATAR_V10_FACE,AVATAR_V10_MODELS,AVATAR_V10_OUTFITS,normalizeAvatarV10} from "./avatar-v10.mjs?v=20261114-base-swim";
import {AvatarV10Assets} from "./avatar-v10-assets.mjs?v=20261114-base-swim";
import {lookAt,multiply4,perspective} from "./render.mjs?v=20261114-v10-crew";
import {requiresAvatarWardrobeUnlock,avatarWardrobeUnlocked,unlockAvatarWardrobe} from "./avatar-v10-wardrobe.mjs?v=1";

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
 function setOutfit(value){
  fit={...fit,outfit:value};outfit.value=value;
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
  status.value=selected==="swim"?"水着専用メッシュがないモデルでは普段着の代替表示です。":"素体：着脱衣装を除いたデッサン用表示です。";
  setOutfit(selected);
 });
 cancel.addEventListener("click",()=>{pendingOutfit=null;gate.hidden=true;gateCode.value="";outfit.value=fit.outfit;});
 gateCode.addEventListener("keydown",event=>{
  if(event.key==="Enter"){event.preventDefault();confirm.click();}
 });


 for(const [group,parts] of AVATAR_V10_FACE){
  const section=document.createElement("details");
  const summary=document.createElement("summary");
  summary.textContent=group;
  section.append(summary);
  for(const [key,title] of parts){
   const label=document.createElement("label");
   const input=document.createElement("input");
   const value=document.createElement("span");
   input.type="range";input.name=key;input.min=-100;input.max=100;
   input.setAttribute("aria-label",group+"の"+title);
   input.addEventListener("input",()=>{
    value.textContent=input.value;
    fit={...fit,face:{...fit.face,[key]:Number(input.value)}};
    drafts.set(select.value,fit);
    invalidate();
   });
   label.append(title,input,value);section.append(label);
  }
  fields.append(section);
 }
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
  fit=requiresAvatarWardrobeUnlock(next.outfit)&&!unlocked()?{...next,outfit:"work"}:next;
  pendingOutfit=null;gate.hidden=true;gateCode.value="";
  model.value=fit.model;outfit.value=fit.outfit;
  const disabled=fit.model==="classic";
  outfit.disabled=disabled;
  for(const [key,value] of Object.entries(fit.face)){
   const input=form.elements[key];
   input.value=value;input.disabled=disabled;input.nextElementSibling.textContent=String(value);
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
