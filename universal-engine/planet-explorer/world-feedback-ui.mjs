import {WorldFeedback,GameConsole} from "./world-feedback.mjs";
/** Browser adapter. World-space messages are anchored to projected actors/enemies. */
export function installWorldFeedbackUI({getRenderer,getController,onCommand=()=>""}){
 const $=id=>document.getElementById(id);
 const feedback=new WorldFeedback(),history=new GameConsole(240);
 const overlay=$("world-fx-layer"),panel=$("game-console"),rows=$("game-console-lines");
 let open=false,visibleIds="",lastConsoleVersion=0,version=0;
 const classifier=s=>/ダメージ|攻撃|撃破|HP|ガード/.test(s)?"combat":
   /木材|石材|採掘|伐採|繊維|資源/.test(s)?"resource":
   /会話|話し|プレゼント|親密度|💬/.test(s)?"social":"info";
 function append(text,category){
  history.append(text,category||classifier(String(text)));version++;
  if(open)drawConsole();
 }
 function drawConsole(){
  if(!open)return;
  const selected=$("game-console-filter").value,search=$("game-console-search").value;
  const atBottom=rows.scrollTop+rows.clientHeight>=rows.scrollHeight-28;
  rows.replaceChildren();
  const fragment=document.createDocumentFragment();
  for(const line of history.filter(selected,search)){
   const el=document.createElement("div");el.className="game-console-entry console-"+line.category;
   const stamp=new Date(line.time);
   const time=document.createElement("time");time.textContent=stamp.toLocaleTimeString("ja-JP",{hour12:false});
   const txt=document.createElement("span");txt.textContent=line.message;
   el.append(time,txt);fragment.append(el);
  }
  rows.append(fragment);
  if(atBottom)rows.scrollTop=rows.scrollHeight;
  lastConsoleVersion=version;
 }
 function toggle(force=!open){
  open=!!force;panel.hidden=!open;
  $("viewport-console-toggle").setAttribute("aria-expanded",String(open));
  $("viewport-console-toggle").textContent=open?"× ログ":"▤ ログ";
  if(open)drawConsole();
 }
 $("viewport-console-toggle").addEventListener("click",()=>toggle());
 $("game-console-close").addEventListener("click",()=>toggle(false));
 $("game-console-clear").addEventListener("click",()=>{history.clear();version++;drawConsole();});
 $("game-console-filter").addEventListener("change",drawConsole);
 $("game-console-search").addEventListener("input",drawConsole);
 $("game-console-command-form").addEventListener("submit",e=>{
  e.preventDefault();
  const field=$("game-console-command"),input=field.value.trim();
  if(!input)return;
  field.value="";
  append("› "+input,"system");
  if(input==="/clear"){history.clear();version++;drawConsole();return;}
  if(input==="/help"){append("利用可能: /help /clear /status /spawn slime|goblin|bandit|skeleton|orc|lizardman|demon","system");return;}
  const match=input.match(/^\/spawn\s+(slime|goblin|bandit|skeleton|orc|lizardman|demon)$/i);
  if(match){
   append(onCommand("spawn",match[1].toLowerCase())||"敵の出現に失敗しました。","system");
  }else if(input==="/status"){
   append(onCommand("status")||"状態を取得できませんでした。","system");
  }else append("不明なコマンドです。/help を確認してください。","system");
 });
 // Drag only the titlebar; normal logs and input controls keep their browser gestures.
 const head=$("game-console-head");
 let moving=null;
 head.addEventListener("pointerdown",e=>{
  if(e.button!==0||e.target.closest("button"))return;
  const rect=panel.getBoundingClientRect(),bounds=panel.parentElement.getBoundingClientRect();
  moving={id:e.pointerId,dx:e.clientX-rect.left,dy:e.clientY-rect.top,
   parentLeft:bounds.left,parentTop:bounds.top};
  head.setPointerCapture?.(e.pointerId);
  e.preventDefault();
 });
 head.addEventListener("pointermove",e=>{
  if(!moving||e.pointerId!==moving.id)return;
  const bounds=panel.parentElement.getBoundingClientRect();
  const x=Math.max(0,Math.min(bounds.width-panel.offsetWidth,e.clientX-bounds.left-moving.dx));
  const y=Math.max(0,Math.min(bounds.height-panel.offsetHeight,e.clientY-bounds.top-moving.dy));
  panel.style.left=x+"px";panel.style.top=y+"px";panel.style.right="auto";
 });
 for(const name of ["pointerup","pointercancel","lostpointercapture"])
  head.addEventListener(name,e=>{if(moving?.id===e.pointerId)moving=null;});
 function float(e){
  const r=getRenderer();if(!r)return;
  feedback.emit(e);
 }
 function speak(actorId,text,duration=3.4){feedback.speech(actorId,text,duration);}
 function frame(dt){
  feedback.advance(dt);
  const renderer=getRenderer(),controller=getController();
  if(!renderer||!controller)return;
  const width=renderer.canvas?.clientWidth||1,height=renderer.canvas?.clientHeight||1;
  const layout=feedback.layout({actors:[...renderer.screenActors,...(renderer.screenGuards||[])],enemies:[...renderer.screenEnemies,...(renderer.screenGuards||[])],width,height});
  // 32 small nodes maximum, reusable across frames. Plain text only.
  const ids=layout.map(e=>e.id).join(",");
  if(ids!==visibleIds){
   overlay.replaceChildren();
   for(const e of layout){
    const el=document.createElement("div");el.className="world-fx fx-"+e.kind;
    el.dataset.effectId=String(e.id);
    el.textContent=e.text;overlay.append(el);
   }
   visibleIds=ids;
  }
  for(let i=0;i<layout.length;i++){
   const ev=layout[i],el=overlay.children[i];if(!el)continue;
   el.style.left=ev.screenX+"px";el.style.top=ev.screenY+"px";
   el.style.opacity=String(ev.opacity);
  }
  if(open&&version!==lastConsoleVersion)drawConsole();
 }
 function clear(){feedback.clear();overlay.replaceChildren();visibleIds="";}
 return {append,float,speak,frame,clear,toggle,feedback,history};
}
