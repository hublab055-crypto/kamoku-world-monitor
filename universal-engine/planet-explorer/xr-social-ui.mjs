import {SocialLink,SocialStage} from "./xr-social.mjs";

export function installSocialUI($){
 const panel=$("xr-social"),status=$("xr-social-status"),code=$("xr-social-code");
 const signal=$("xr-social-signal"),view=$("xr-social-view"),calibrate=$("xr-social-calibrate");
 const link=new SocialLink(message=>{status.textContent=message;});
 const stage=new SocialStage(link);
 const button=$("xr-mr-social");
 const controls=Array.from(signal.querySelectorAll("button"));
 for(const control of controls)control.disabled=typeof RTCPeerConnection!=="function";
 let busy=false;
 const run=operation=>async()=>{
  if(busy)return;
  busy=true;
  for(const control of controls)control.disabled=true;
  try{await operation();}
  catch(error){status.textContent=error.message;}
  finally{for(const control of controls)control.disabled=false;busy=false;}
 };
 $("xr-social-offer").onclick=run(async()=>{
  code.value=await link.offer();
  status.textContent="招待を相手に渡し、受け取った応答をここに貼り付けてください。";
 });
 $("xr-social-answer").onclick=run(async()=>{
  code.value=await link.answer(code.value);
  status.textContent="この応答を招待した側に返してください。";
 });
 $("xr-social-accept").onclick=run(async()=>{await link.accept(code.value);});
 $("xr-social-copy").onclick=run(async()=>{
  if(!code.value)throw Error("コピーする接続情報がありません");
  try{await navigator.clipboard.writeText(code.value);status.textContent="接続情報をコピーしました。";}
  catch{code.focus();code.select();status.textContent="選択した接続情報をコピーしてください。";}
 });
 $("xr-social-disconnect").onclick=()=>{link.disconnect();code.value="";};
 let pending=false,lastHead=null;
 const prompt="同じ床の目印に立ち、同じ方向を見て登録してください。";
 function register(head){
  if(head&&stage.calibrate(head)){
   view.setAttribute("aria-pressed","false");
   status.textContent="基準を登録しました。右トリガーで再登録、左で視点切替。";
  }else status.textContent="正面を見て登録してください。";
 }
 function toggle(){
  if(!stage.origin){status.textContent=prompt;return;}
  if(!stage.toggleView(lastHead))return;
  view.setAttribute("aria-pressed",String(Boolean(stage.miniature)));
  status.textContent=stage.miniature?"第三者視点を表示中":"実寸で相手を表示中";
 }
 calibrate.onclick=()=>{pending=true;};
 view.onclick=toggle;
 panel.addEventListener("beforexrselect",event=>event.preventDefault());
 return {button,link,stage,
  activate(active){
   signal.hidden=active;
   view.hidden=calibrate.hidden=!active;
   pending=false;lastHead=null;stage.reset();link.remote=null;
   view.setAttribute("aria-pressed","false");
   if(active){panel.open=true;status.textContent=prompt;}
   else status.textContent=link.connected?"接続済み（姿勢の送信は停止中）":"未接続";
  },
  select(side){
   if(side==="left"&&stage.origin)toggle();
   else register(lastHead);
  },
  track(head){
   lastHead=head;
   if(pending){pending=false;register(head);}
  }};
}
