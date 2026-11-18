/**
 * Universal Engine: player-operated world tablet (desktop/mobile first).
 * The "wall" variant is a 2D overlay, NOT a WebGL texture or XR quad layer.
 * Remote sites, including YouTube, cannot be painted onto a WebGL surface.
 */
import {installYoutubeTabletUI} from "./world-tablet-youtube-ui.mjs?v=20261119-search-register";
const VIDEO_ID=/^[A-Za-z0-9_-]{11}$/;

export function youtubeVideoId(value){
 if(typeof value!=="string")return null;
 const s=value.trim();
 if(VIDEO_ID.test(s))return s;
 let url;
 try{url=new URL(s);}catch(_){return null;}
 const host=url.hostname.toLowerCase();
 if(url.protocol!=="https:")return null;
 if(host==="youtu.be")return VIDEO_ID.test(url.pathname.slice(1))?url.pathname.slice(1):null;
 if(!["youtube.com","www.youtube.com","m.youtube.com","youtube-nocookie.com","www.youtube-nocookie.com"].includes(host))return null;
 let id=null;
 if(url.pathname==="/watch")id=url.searchParams.get("v");
 else if(/^\/(shorts|embed|live)\/[^/]+\/?$/.test(url.pathname))id=url.pathname.split("/")[2];
 return VIDEO_ID.test(id||"")?id:null;
}

export function safeWebAddress(value){
 if(typeof value!=="string")return null;
 let source=value.trim();
 if(!source||source.length>2048)return null;
 if(!/^[a-z][a-z0-9+.-]*:/i.test(source)){
  if(!/^[\w-]+(?:\.[\w-]+)+(?:[:/??#]|$)/i.test(source))return null;
  source="https://"+source;
 }
 try{
  const url=new URL(source);
  if(url.protocol!=="https:"||url.username||url.password)return null;
  return url.href;
 }catch(_){return null;}
}

export function sameOriginChatEndpoint(value,origin){
 if(typeof value!=="string"||!value.trim())return null;
 try{
  const url=new URL(value,origin);
  if(url.origin!==origin||url.protocol!=="https:"||!url.pathname.startsWith("/api/"))return null;
  return url.pathname+url.search;
 }catch(_){return null;}
}

function el(tag,className,text){
 const node=document.createElement(tag);
 if(className)node.className=className;
 if(text!==undefined)node.textContent=text;
 return node;
}
function button(text,action,className){
 const node=el("button",className,text);node.type="button";node.addEventListener("click",action);
 return node;
}

export function installWorldTablet({setCameraMode=()=>{},getCameraMode=()=>null,notify=()=>{}}={}){
 if(typeof document==="undefined")return null;
 const wrap=document.querySelector(".view-panel .canvas-wrap");
 const bar=document.querySelector(".viewport-compact-bar");
 const quick=document.getElementById("viewport-quick-panel");
 const toolbar=document.getElementById("viewport-toolbar");
 if(!wrap||!bar||!quick)return null;

 const style=document.createElement("link");
 style.rel="stylesheet";style.href="./world-tablet.css?v=20261119-search-register";
 document.head.append(style);

 const shell=el("section","ue-world-tablet");
 shell.id="ue-world-tablet";shell.hidden=true;
 shell.dataset.position="hand";
 shell.setAttribute("role","dialog");
 shell.setAttribute("aria-label","Universal Engine ワールドタブレット");
 shell.setAttribute("aria-modal","false");
 shell.innerHTML=
 '<header class="ue-tablet-head"><strong>▣ WORLD TABLET</strong>'+
 '<span data-mode>手持ち（画面上の端末）</span>'+
 '<button type="button" data-wall>🧱 壁表示</button>'+
 '<button type="button" data-close aria-label="閉じる">×</button></header>'+
 '<nav class="ue-tablet-tabs" aria-label="タブレットの機能" role="tablist">'+
 '<button type="button" data-tab="video">▶ 動画</button>'+
 '<button type="button" data-tab="web">🌐 Web</button>'+
 '<button type="button" data-tab="chat">✦ ChatGPT</button>'+
 '<button type="button" data-tab="settings">⚙ 設定</button>'+
 '<button type="button" data-tab="motion">🎭 動作</button>'+
 '<button type="button" data-tab="rts">⌖ 指揮</button></nav>'+
 '<section class="ue-tablet-pane" data-pane="video">'+
 '<form data-video-form class="ue-tablet-form"><label>YouTubeのURL / 動画ID<input name="video" autocomplete="off" placeholder="https://youtu.be/..."></label>'+
 '<button type="submit">再生</button><button type="button" data-video-stop>停止</button></form>'+
 '<div class="ue-tablet-media"><iframe data-video-frame title="YouTube公式プレーヤー" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>'+
 '<p>YouTube公式プレーヤーです。プレーヤー操作・広告・ブランド表示はそのまま利用します。動画IDを指定して視聴してください。</p></section>'+
 '<section class="ue-tablet-pane" data-pane="web" hidden>'+
 '<form data-web-form class="ue-tablet-form"><label>Webアドレス<input name="address" type="text" autocomplete="url" placeholder="https://example.org"></label>'+
 '<button type="submit">表示</button><button type="button" data-open-external>外部ブラウザ</button></form>'+
 '<div class="ue-tablet-media"><iframe data-web-frame title="Web閲覧" referrerpolicy="no-referrer" sandbox="allow-forms allow-scripts allow-popups"></iframe></div>'+
 '<p>Webサイトによっては外部埋め込みが禁止されています。表示できない場合は「外部ブラウザ」を利用してください。入力したアドレスを保存しません。</p></section>'+
 '<section class="ue-tablet-pane" data-pane="chat" hidden>'+
 '<p>ChatGPT公式サイトは外部タブで開けます。ゲーム内での会話は、サーバ側のOpenAI API連携が設定されている場合のみ利用できます。</p>'+
 '<button type="button" data-open-chat>ChatGPTを開く</button>'+
 '<div class="ue-tablet-chat-log" data-chat-log aria-live="polite"></div>'+
 '<form data-chat-form class="ue-tablet-form"><label>ゲーム内AIへのメッセージ<input name="message" maxlength="2000" placeholder="メッセージを入力"></label>'+
 '<button type="submit" data-chat-send>送信</button></form><small data-chat-state></small></section>'+
 '<section class="ue-tablet-pane" data-pane="settings" hidden>'+
 '<p>既存のゲーム設定画面を呼び出します。設定は本体の保存方式を利用します。</p>'+
 '<div class="ue-tablet-buttons"><button type="button" data-action="camera-follow">三人称</button>'+
 '<button type="button" data-action="camera-tactical">俯瞰カメラ</button>'+
 '<button type="button" data-action="display">HUDの表示設定</button>'+
 '<button type="button" data-action="game-settings">詳細設定</button>'+
 '<button type="button" data-action="avatar">アバター編集</button></div>'+
 '<output data-camera-state></output></section>'+
 '<section class="ue-tablet-pane" data-pane="motion" hidden>'+
 '<p>Quest 3SのHMDと左右コントローラーのモーション記録機能に接続します。足の実測には別途トラッカーが必要です。</p>'+
 '<div class="ue-tablet-buttons"><button type="button" data-action="motion-settings">録画・再生パネル</button>'+
 '<button type="button" data-action="motion-arm">次のVR開始時に録画</button>'+
 '<button type="button" data-action="motion-copy">記録JSONをコピー</button></div>'+
 '<output data-motion-state></output></section>'+
 '<section class="ue-tablet-pane" data-pane="rts" hidden>'+
 '<p>ゲーム本体のRTSカメラ・部隊選択・命令を利用します。操作後もタブレットを開いたままにできます。</p>'+
 '<div class="ue-tablet-buttons"><button type="button" data-action="rts-enter">俯瞰視点</button>'+
 '<button type="button" data-action="rts-all">全員選択</button>'+
 '<button type="button" data-action="rts-groups">部隊管理</button>'+
 '<button type="button" data-action="rts-assemble">集合</button>'+
 '<button type="button" data-action="rts-stop">停止</button></div>'+
 '<output data-rts-state></output></section>'+
 '<footer class="ue-tablet-foot"><output data-status role="status">端末待機中</output><small>壁表示は2D配置の試作です。実際の3D壁面・VR投影は未対応。</small></footer>';
 wrap.append(shell);

 const $=sel=>shell.querySelector(sel);
 const state=(text)=>{$("[data-status]").textContent=text;};
 // Opt-in. Only a low-poly terminal is drawn in Quest WebXR; it never
 // pretends to reproduce the cross-origin video/browser framebuffer.
 const xrKey="universal-engine:tablet:vr-enabled:v1";
 let xrEnabled=false;
 try{xrEnabled=localStorage.getItem(xrKey)==="true";}catch(_){}
 shell.dataset.xrEnabled=String(xrEnabled);
 const xrButton=button("🥽 3D端末 "+(xrEnabled?"ON":"OFF"),()=>{
  xrEnabled=!xrEnabled;
  shell.dataset.xrEnabled=String(xrEnabled);
  xrButton.textContent="🥽 3D端末 "+(xrEnabled?"ON":"OFF");
  try{localStorage.setItem(xrKey,String(xrEnabled));}catch(_){}
  state(xrEnabled?
   "VR立体端末を有効にしました。Questで左コントローラーに追従し、右トリガーで9ボタンを操作します。":
   "VR立体端末を無効にしました。");
 });
 xrButton.setAttribute("aria-label","Quest VRの3Dタブレット表示を切り替える");
 shell.querySelector(".ue-tablet-head").insertBefore(xrButton,$("[data-close]"));

 const youtubeEndpoint=sameOriginChatEndpoint(document.querySelector('meta[name="universal-engine-youtube-search-endpoint"]')?.content||"",location.origin);
 const youtubeUI=installYoutubeTabletUI({root:shell,state,extractVideoId:youtubeVideoId,searchEndpoint:youtubeEndpoint});
 const showTab=(tab)=>{
  for(const item of shell.querySelectorAll("[data-tab]")){
   const active=item.dataset.tab===tab;
   item.setAttribute("aria-selected",String(active));
   item.tabIndex=active?0:-1;
  }
  for(const item of shell.querySelectorAll("[data-pane]"))item.hidden=item.dataset.pane!==tab;
  $("[data-camera-state]").textContent="現在の視点: "+(getCameraMode()||"未取得");
  const armed=document.getElementById("xr-motion-actor-armed");
  $("[data-motion-state]").textContent=armed?.checked?"次回VR起動で録画予定":"録画は未予約";
 };
 const open=(tab="video")=>{shell.hidden=false;showTab(tab);state("タブレットを開きました");};
 const close=()=>{shell.hidden=true;};
 const toggle=()=>shell.hidden?open():close();
 const opener=button("▣",toggle,"ue-tablet-launch");
 opener.id="viewport-tablet";opener.setAttribute("aria-label","ワールドタブレットを開く");
 opener.setAttribute("title","ワールドタブレット");
 bar.append(opener);
 const quickButton=button("▣ タブレット",toggle);quickButton.id="viewport-tablet-menu";
 quick.insertBefore(quickButton,quick.querySelector("#viewport-menu"));
 if(toolbar){
  const b=button("▣ タブレット",toggle);b.id="toolbar-tablet";toolbar.append(b);
 }
 $("[data-close]").addEventListener("click",close);
 for(const tab of shell.querySelectorAll("[data-tab]"))tab.addEventListener("click",()=>showTab(tab.dataset.tab));
 $("[data-wall]").addEventListener("click",()=>{
  const wall=shell.dataset.position!=="wall";
  shell.dataset.position=wall?"wall":"hand";
  shell.dataset.x="0";shell.dataset.y="0";
  shell.style.setProperty("--ue-x","0px");shell.style.setProperty("--ue-y","0px");
  $("[data-wall]").textContent=wall?"✋ 手持ち表示":"🧱 壁表示";
  $("[data-mode]").textContent=wall?"壁スクリーン（2D仮配置）":"手持ち（画面上の端末）";
 });

 // Let the user reposition the 2D projected display without fighting video playback.
 let drag=null;
 const head=$(".ue-tablet-head");
 head.addEventListener("pointerdown",event=>{
  if(event.target.closest("button")||event.button!==0)return;
  drag={x:event.clientX,y:event.clientY,dx:Number(shell.dataset.x)||0,dy:Number(shell.dataset.y)||0};
  head.setPointerCapture?.(event.pointerId);
 });
 head.addEventListener("pointermove",event=>{
  if(!drag)return;
  const x=Math.max(-300,Math.min(300,drag.dx+event.clientX-drag.x));
  const y=Math.max(-300,Math.min(300,drag.dy+event.clientY-drag.y));
  shell.dataset.x=String(x);shell.dataset.y=String(y);
  shell.style.setProperty("--ue-x",x+"px");shell.style.setProperty("--ue-y",y+"px");
 });
 const endDrag=()=>{drag=null;};
 head.addEventListener("pointerup",endDrag);head.addEventListener("pointercancel",endDrag);
 shell.addEventListener("keydown",e=>e.stopPropagation());
 shell.addEventListener("pointerdown",e=>e.stopPropagation());

 let webUrl=null;
 $("[data-web-form]").addEventListener("submit",event=>{
  event.preventDefault();
  const url=safeWebAddress($('[name="address"]').value);
  if(!url){state("https://で始まる安全なWebアドレスを入力してください");return;}
  webUrl=url;$("[data-web-frame]").src=url;
  state("サイト表示を試行しました。制限される場合は外部ブラウザを利用してください");
 });
 $("[data-open-external]").addEventListener("click",()=>{
  const url=webUrl||safeWebAddress($('[name="address"]').value);
  if(!url){state("先にWebアドレスを入力してください");return;}
  window.open(url,"_blank","noopener,noreferrer");
 });
 $("[data-open-chat]").addEventListener("click",()=>window.open("https://chatgpt.com/","_blank","noopener,noreferrer"));

 const endpoint=sameOriginChatEndpoint(document.querySelector('meta[name="universal-engine-chat-endpoint"]')?.content||"",location.origin);
 const send=$("[data-chat-send]"),chatState=$("[data-chat-state]");
 chatState.textContent=endpoint?"サーバ連携あり。送信内容はAIサービスに渡されます。":"ゲーム内AIはサーバ未設定です。公式サイトを開いてください。";
 send.disabled=!endpoint;
 const history=[];
 $("[data-chat-form]").addEventListener("submit",async event=>{
  event.preventDefault();
  const input=$('[name="message"]'),content=input.value.trim();
  if(!endpoint||!content||send.disabled)return;
  history.push({role:"user",content});history.splice(0,Math.max(0,history.length-12));
  $("[data-chat-log]").append(el("p","ue-tablet-chat-user","あなた: "+content));
  input.value="";send.disabled=true;chatState.textContent="送信中";
  try{
   const response=await fetch(endpoint,{
    method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({messages:history})
   });
   if(!response.ok)throw Error("HTTP "+response.status);
   const data=await response.json();
   if(typeof data.reply!=="string"||!data.reply.trim())throw Error("応答形式が不正です");
   history.push({role:"assistant",content:data.reply});
   $("[data-chat-log]").append(el("p","ue-tablet-chat-assistant","AI: "+data.reply.slice(0,8000)));
   chatState.textContent="受信しました";
  }catch(error){
   history.pop();chatState.textContent="接続に失敗しました: "+error.message;
  }finally{send.disabled=false;}
 });
 const clickExisting=id=>{
  const target=document.getElementById(id);
  if(!target){state(id+"の画面は現在利用できません");return false;}
  target.click();return true;
 };
 for(const b of shell.querySelectorAll("[data-action]"))b.addEventListener("click",async()=>{
  const action=b.dataset.action;
  if(action==="camera-follow"||action==="camera-tactical"){
   setCameraMode(action==="camera-follow"?"follow":"tactical");
   $("[data-camera-state]").textContent="現在の視点: "+getCameraMode();return;
  }
  if(action==="display"){clickExisting("ui-display-access");return;}
  if(action==="game-settings"){clickExisting("viewport-settings-toggle");return;}
  if(action==="avatar"){clickExisting("viewport-avatar-v10");return;}
  if(action==="motion-settings"){
   const body=document.getElementById("xr-settings-body");if(body)body.hidden=false;
   const details=document.getElementById("xr-motion-actor");if(details)details.open=true;
   document.getElementById("xr-controls")?.scrollIntoView({behavior:"smooth",block:"center"});
   state("VRモーションの既存設定画面を開きました");return;
  }
  if(action==="motion-arm"){
   const input=document.getElementById("xr-motion-actor-armed");
   if(!input){state("VRモーション記録機能は未起動です");return;}
   input.checked=!input.checked;
   $("[data-motion-state]").textContent=input.checked?"次回VR起動で録画予定":"録画予約なし";
   state("VR録画予約を変更しました");return;
  }
  if(action==="motion-copy"){
   const source=document.getElementById("xr-motion-actor-json")?.value;
   if(!source){state("コピー可能な記録はありません");return;}
   try{await navigator.clipboard.writeText(source);state("記録JSONをコピーしました");}
   catch(_){state("コピー不可。VRモーション設定画面からコピーしてください");}
   return;
  }
  if(action==="rts-enter"){
   if(getCameraMode()!=="tactical")clickExisting("toolbar-rts");
   $("[data-rts-state]").textContent="RTS俯瞰視点を有効化しました";return;
  }
  const ids={"rts-all":"rts-all","rts-groups":"rts-group-toggle",
   "rts-assemble":"rts-group-assemble","rts-stop":"rts-stop"};
  if(ids[action])clickExisting(ids[action]);
 });
 const keyboard=event=>{
  if(event.key.toLowerCase()!=="t"||!event.altKey||event.ctrlKey||event.metaKey||event.repeat)return;
  if(event.target.closest?.("input,textarea,select,[contenteditable]"))return;
  toggle();
 };
 document.addEventListener("keydown",keyboard);
 return {open,close,showTab,get visible(){return !shell.hidden;},dispose(){
  document.removeEventListener("keydown",keyboard);
  opener.remove();quickButton.remove();document.getElementById("toolbar-tablet")?.remove();
  youtubeUI?.dispose();xrButton.remove();shell.remove();style.remove();
 }};
}
