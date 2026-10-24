/**
 * Media studio: creation, gifting, exhibition, browser-local playback and timed programs.
 * The board overlay is a lightweight 3D-projected prototype: no changes to WebGL shaders.
 */
import {MediaLibrary} from "./media-library.mjs";
import {createMediaBlobKey,storeMediaFile,readMediaFile} from "./media-storage.mjs";
import {geoLocal,terrainSurface} from "./geo.mjs";
import {projectScreen} from "./render.mjs";
const SAVE_KEY="universal-engine:explorer:media:v1";
const $=(root,selector)=>root.querySelector(selector);
const b=(label,action)=>{const x=document.createElement("button");x.type="button";x.textContent=label;x.addEventListener("click",action);return x;};
const h=(tag,cls,text)=>{const x=document.createElement(tag);if(cls)x.className=cls;if(text!==undefined)x.textContent=text;return x;};
const timeValue=days=>((Math.floor(((Number(days)||0)%1+1)%1*1440)%1440)+1440)%1440;
const mark=kind=>({letter:"✉️",painting:"🖼️",record:"💿",film:"🎞️"})[kind]||"📦";
export function installMediaUI({getController,getRenderer,getTerrain,getGameDays,notify=()=>{}}){
 let library;
 try{const raw=localStorage.getItem(SAVE_KEY);library=new MediaLibrary(raw?JSON.parse(raw):null);}
 catch(e){library=new MediaLibrary();notify("メディア台帳を読み込めませんでした: "+e.message);}
 const toolbar=document.getElementById("viewport-toolbar");
 const quick=document.getElementById("viewport-quick-panel");
 const stage=document.querySelector(".view-panel");
 const canvasWrap=stage.querySelector(".canvas-wrap");
 const toggle=b("🎞️ メディア作品",()=>open());
 toggle.id="toolbar-media";toolbar.insertBefore(toggle,document.getElementById("toolbar-life"));
 const q=b("🎞️ メディア・放送",()=>open());
 q.id="viewport-media";quick.insertBefore(q,document.getElementById("viewport-menu"));
 const panel=h("div","ue-media-panel");
 panel.id="ue-media-panel";panel.hidden=true;panel.setAttribute("role","dialog");panel.setAttribute("aria-modal","true");
 panel.setAttribute("aria-label","メディア作品・放送");
 panel.innerHTML='<header class="ue-media-header"><strong>🎞️ メディア・文化作品</strong><button type="button" data-close>× 閉じる</button></header>'+
 '<div class="ue-media-scroll"><section class="ue-media-form"><h3>新しい作品</h3>'+
 '<div class="ue-media-two"><label>種類<select data-kind><option value="letter">✉️ 手紙</option><option value="painting">🖼️ 絵画・写真・壁紙</option><option value="record">💿 レコード・録音</option><option value="film">🎞️ フィルム・映像</option></select></label>'+
 '<label>作品名<input data-title maxlength="80" placeholder="作品名"></label></div>'+
 '<label>作者<input data-author maxlength="80" value="player"></label>'+
 '<label data-text-box>手紙の本文<textarea data-text rows="4" maxlength="20000" placeholder="残したい文章を記入"></textarea></label>'+
 '<label data-file-box hidden>ファイル（画像: JPG/PNG、音声: MP3等、動画: MP4/WebM）<input data-file type="file"></label>'+
 '<label data-youtube-box hidden>YouTubeの動画URL（HTTPS）<input data-youtube type="url" inputmode="url" placeholder="https://www.youtube.com/watch?v=..."></label>'+
 '<button type="button" data-create>作品を作成・保存</button>'+
 '<small class="ue-media-help">保存はこのブラウザ内です。動画は75MB以下のMP4/WebM等を推奨。AVIは事前変換が必要。URLはYouTubeの公式埋め込み再生を使います。</small></section>'+
 '<section><h3>🎒 作品インベントリ</h3><div data-items class="ue-media-list"></div></section>'+
 '<section class="ue-media-program"><h3>📺 番組表（ゲーム内時刻）</h3><div class="ue-media-two">'+
 '<label>局名<input data-channel maxlength="40" value="王都放送局"></label><label>放送開始時刻<input data-start type="time" value="19:00"></label></div>'+
 '<label>放送するレコード・フィルム<select data-program-item></select></label>'+
 '<button type="button" data-program-add>番組を登録</button><div data-program-list></div>'+
 '<button type="button" data-watch>現在の番組を見る／聴く</button><small class="ue-media-help">番組の切り替えはゲーム内時計に連動。プレイヤー間の同期配信やアップロードサーバーは未実装です。</small></section>'+
 '<output class="ue-media-status" role="status" aria-live="polite"></output></div>'+
 '<div class="ue-media-preview" hidden><header class="ue-media-preview-head"><strong data-preview-title>再生</strong><button type="button" data-preview-close>× 戻る</button></header><div class="ue-media-preview-body"></div></div>';
 stage.append(panel);
 const world=h("div","ue-media-world");world.setAttribute("aria-label","世界に設置されたメディア");world.id="ue-media-world";canvasWrap.append(world);
 const find=s=>$ (panel,s);
 const fields={kind:find("[data-kind]"),file:find("[data-file]"),url:find("[data-youtube]"),text:find("[data-text]")};
 const surfaces=new Map();const cache=new Map();let previewUrl=null,raf=0,lastPaint=0;
 const say=message=>{find(".ue-media-status").textContent=message;notify(message);};
 const persist=()=>{try{localStorage.setItem(SAVE_KEY,JSON.stringify(library.snapshot()));}catch(e){say("メディアの保存に失敗しました: "+e.message);}};
 const commit=()=>{persist();renderList();renderProgram();refreshSurfaces();};
 function switchInput(){
  const kind=fields.kind.value;
  find("[data-text-box]").hidden=kind!=="letter";
  find("[data-file-box]").hidden=kind==="letter"||(kind==="film"&&fields.url.value.trim().length>0);
  find("[data-youtube-box]").hidden=kind!=="film";
  const accept={painting:"image/jpeg,image/png,image/webp,image/gif",record:"audio/mpeg,audio/mp4,audio/wav,audio/ogg,audio/webm",film:"video/mp4,video/webm,video/ogg"};
  fields.file.accept=accept[kind]||"";
 }
 fields.kind.addEventListener("change",switchInput);
 fields.url.addEventListener("input",switchInput);
 function open(){panel.hidden=false;quick.hidden=true;document.getElementById("viewport-quick-toggle").setAttribute("aria-expanded","false");switchInput();renderList();renderProgram();find("[data-title]").focus();}
 function close(){closePreview();panel.hidden=true;}
 find("[data-close]").addEventListener("click",close);
 panel.addEventListener("keydown",event=>{if(event.key==="Escape"){if(!find(".ue-media-preview").hidden)closePreview();else close();event.preventDefault();event.stopPropagation();}});
 find("[data-create]").addEventListener("click",async()=>{
  const btn=find("[data-create]");btn.disabled=true;let mediaKey=null;
  try{
   const kind=fields.kind.value;
   let source;
   if(kind==="letter")source={type:"text",text:fields.text.value};
   else if(kind==="film"&&fields.url.value.trim())source={type:"youtube",url:fields.url.value.trim()};
   else{
    const file=fields.file.files?.[0];if(!file)throw Error("ファイルを選択してください");
    mediaKey=createMediaBlobKey();
    const saved=await storeMediaFile(file,mediaKey);
    source={type:"blob",...saved};
   }
   const item=library.create({kind,title:find("[data-title]").value,author:find("[data-author]").value,source});
   commit();say(mark(kind)+" 「"+item.title+"」を作品として保存しました");
   fields.text.value="";fields.file.value="";fields.url.value="";find("[data-title]").value="";switchInput();
  }catch(e){say("保存できません: "+e.message);}
  finally{btn.disabled=false;}
 });
 function closePreview(){
  const area=find(".ue-media-preview-body");area.querySelectorAll("video,audio").forEach(x=>x.pause());
  area.replaceChildren();find(".ue-media-preview").hidden=true;
  if(previewUrl){URL.revokeObjectURL(previewUrl);previewUrl=null;}
 }
 find("[data-preview-close]").addEventListener("click",closePreview);
 async function preview(item){
  closePreview();
  if(!item)return;
  find(".ue-media-preview").hidden=false;
  find("[data-preview-title]").textContent=mark(item.kind)+" "+item.title+" / "+item.author;
  const area=find(".ue-media-preview-body");
  if(item.source.type==="text"){area.append(h("article","",item.source.text));return;}
  if(item.source.type==="youtube"){
   const iframe=document.createElement("iframe");
   iframe.title=item.title;iframe.referrerPolicy="strict-origin-when-cross-origin";
   iframe.allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture";
   iframe.allowFullscreen=true;
   iframe.src="https://www.youtube-nocookie.com/embed/"+item.source.videoId+"?rel=0";
   area.append(iframe);return;
  }
  try{
   const file=await readMediaFile(item.source.key);
   if(!file){area.append(h("p","","この端末に元ファイルがありません。作品情報のみ保存されています。"));return;}
   previewUrl=URL.createObjectURL(file);
   const el=document.createElement(item.kind==="painting"?"img":item.kind==="record"?"audio":"video");
   el.src=previewUrl;el.controls=item.kind!=="painting";el.playsInline=true;el.preload="metadata";
   if(el.tagName==="IMG")el.alt=item.title;
   area.append(el);
  }catch(e){area.append(h("p","","読み込みエラー: "+e.message));}
 }
 async function safeAction(fn){try{await fn();}catch(e){say(e.message);}}
 function renderList(){
  const root=find("[data-items]");root.replaceChildren();
  if(!library.items.length){root.append(h("p","ue-media-help","手紙や写真、音楽、映像を作るとここに保存されます。"));return;}
  for(const item of library.items.slice().reverse()){
   const row=h("article","ue-media-item");row.append(h("strong","",mark(item.kind)+" "+item.title));
   row.append(h("small","ue-media-help","作者: "+item.author+" ／ 所有: "+item.owner+(item.source.type==="youtube"?" ／ YouTubeリンク":"")));
   const actions=h("div","ue-media-actions");
   actions.append(b("▶ 鑑賞・再生",()=>void preview(item)));
   if(item.kind==="painting"||item.kind==="film"){
    actions.append(b(item.kind==="painting"?"🖼️ 展示する":"📺 ビジョン設置",()=>safeAction(()=>{
     const c=getController(),r=getRenderer(),terrain=getTerrain();
     if(!c?.nearGround||!r)throw Error("地表に降りてから設置してください");
     const px=c.x+Math.sin(c.yaw)*3,pz=c.z+Math.cos(c.yaw)*3;
     const p=c.locationAt(px,pz);
     if(terrainSurface(terrain,p.lat,p.lon).water)throw Error("海面には設置できません");
     library.place(item.id,item.kind==="painting"?"picture":"screen",{lat:p.lat,lon:p.lon,height:2.2,width:2.4,rotation:c.yaw*180/Math.PI});
     commit();say("現在位置の前方約3mに展示しました。近くで見ると映ります。");
    })));
   }
   actions.append(b("🎁 贈る",()=>safeAction(()=>{
    const to=window.prompt("贈る相手の名前を入力してください（ローカル所有者情報）","");
    if(to===null)return;
    library.gift(item.id,to);commit();say("「"+item.title+"」の所有者を"+to+"に変更しました");
   })));
   actions.append(b("⧉ 複製",()=>safeAction(()=>{library.duplicate(item.id);commit();say("複製しました");})));
   actions.append(b("🗑 削除",()=>safeAction(()=>{
    if(!window.confirm("「"+item.title+"」の登録を削除しますか？"))return;
    library.remove(item.id);commit();say("登録を削除しました。元ファイルはまだこの端末に残っています。");
   })));
   row.append(actions);root.append(row);
  }
  if(library.placements.length){
   const list=h("section","ue-media-item");list.append(h("strong","","🏛️ 設置済み作品"));
   for(const p of library.placements){
    const item=library.items.find(x=>x.id===p.itemId);
    const line=h("div","ue-media-actions");
    line.append(h("span","",item?.title||"?"));
    line.append(b("撤去",()=>{library.unplace(p.id);commit();}));
    list.append(line);
   }
   root.append(list);
  }
 }
 function renderProgram(){
  const select=find("[data-program-item]"),prior=select.value;select.replaceChildren();
  for(const item of library.items.filter(x=>["record","film"].includes(x.kind))){
   const opt=document.createElement("option");opt.value=String(item.id);opt.textContent=item.title;select.append(opt);
  }
  if([...select.options].some(x=>x.value===prior))select.value=prior;
  const root=find("[data-program-list]");root.replaceChildren();
  for(const c of library.channels){
   const section=h("div","ue-media-item");section.append(h("strong","",c.name));
   c.schedule.forEach(x=>{
    const m=x.start,entry=library.items.find(y=>y.id===x.itemId);
    section.append(h("small","",String(Math.floor(m/60)).padStart(2,"0")+":"+String(m%60).padStart(2,"0")+"  "+(entry?.title||"削除済")));
   });
   root.append(section);
  }
 }
 find("[data-program-add]").addEventListener("click",()=>safeAction(()=>{
  const itemId=Number(find("[data-program-item]").value);
  const t=find("[data-start]").value.split(":");
  if(t.length!==2)throw Error("開始時刻を入力してください");
  library.setProgram(find("[data-channel]").value,Number(t[0])*60+Number(t[1]),itemId);
  commit();say("番組表に登録しました");
 }));
 find("[data-watch]").addEventListener("click",()=>safeAction(()=>{
  const title=find("[data-channel]").value;
  const item=library.currentProgram(title,timeValue(getGameDays()));
  if(!item)throw Error("この局にはまだ番組が登録されていません");
  void preview(item);
 }));
 async function surfaceFor(p){
  const item=library.items.find(x=>x.id===p.itemId);
  if(!item)return;
  const el=h("div","ue-media-surface");el.title=item.title;el.dataset.id=String(p.id);
  world.append(el);surfaces.set(p.id,el);
  if(item.source.type==="youtube"){
   const thumb=h("button","","▶ "+item.title);
   thumb.addEventListener("click",()=>{open();void preview(item);});
   el.append(thumb);
  }else if(item.source.type==="blob"){
   const file=await readMediaFile(item.source.key).catch(()=>null);
   if(!file||surfaces.get(p.id)!==el)return;
   const url=URL.createObjectURL(file);cache.set(p.id,url);
   const visual=document.createElement(item.kind==="painting"?"img":"video");
   visual.src=url;
   if(visual.tagName==="IMG")visual.alt=item.title;
   else{visual.muted=true;visual.loop=true;visual.playsInline=true;visual.preload="none";visual.controls=true;}
   el.append(visual);
  }
 }
 function refreshSurfaces(){
  for(const element of surfaces.values())element.remove();
  for(const url of cache.values())URL.revokeObjectURL(url);
  surfaces.clear();cache.clear();
  for(const p of library.placements)void surfaceFor(p);
 }
 function updateWorld(now){
  raf=requestAnimationFrame(updateWorld);
  if(now-lastPaint<120)return;lastPaint=now;
  const renderer=getRenderer(),controller=getController(),terrain=getTerrain();
  if(!renderer?.pickVP||!controller?.nearGround||renderer.xrView){
   for(const el of surfaces.values())el.hidden=true;return;
  }
  const stageRect=canvasWrap.getBoundingClientRect(),canvasRect=renderer.canvas.getBoundingClientRect();
  for(const p of library.placements){
   const el=surfaces.get(p.id);if(!el)continue;
   const local=geoLocal(controller.origin.lat,controller.origin.lon,p.lat,p.lon,terrain.planet.radiusM);
   const distance=Math.hypot(local.eastM-controller.x,local.northM-controller.z);
   if(distance>65){el.hidden=true;continue;}
   const x=local.eastM-renderer.cx,z=local.northM-renderer.cz;
   const y=terrainSurface(terrain,p.lat,p.lon).elevationM+p.height;
   const center=projectScreen(renderer.pickVP,[x,y,z]);
   const left=projectScreen(renderer.pickVP,[x-p.width*.5,y,z]);
   const right=projectScreen(renderer.pickVP,[x+p.width*.5,y,z]);
   const top=projectScreen(renderer.pickVP,[x,y+p.width*.30,z]);
   const bottom=projectScreen(renderer.pickVP,[x,y-p.width*.30,z]);
   if(!center?.onScreen||!left||!right||!top||!bottom){el.hidden=true;continue;}
   const w=Math.abs(right.u-left.u)*canvasRect.width,ht=Math.abs(bottom.v-top.v)*canvasRect.height;
   if(w<7||w>canvasRect.width*3){el.hidden=true;continue;}
   el.hidden=false;
   el.style.left=(canvasRect.left-stageRect.left+center.u*canvasRect.width)+"px";
   el.style.top=(canvasRect.top-stageRect.top+center.v*canvasRect.height)+"px";
   el.style.width=Math.max(18,Math.min(w,canvasRect.width))+"px";
   el.style.height=Math.max(12,Math.min(ht,canvasRect.height))+"px";
   const video=el.querySelector("video");
   if(video){
    if(distance<24&&!document.hidden){if(video.paused)video.play().catch(()=>{});}
    else if(!video.paused)video.pause();
   }
  }
 }
 refreshSurfaces();raf=requestAnimationFrame(updateWorld);
 window.addEventListener("pagehide",persist);
 return {library,open,close,save:persist,refresh:commit,destroy(){
  cancelAnimationFrame(raf);closePreview();panel.remove();world.remove();toggle.remove();q.remove();
  for(const url of cache.values())URL.revokeObjectURL(url);
 }};
}
