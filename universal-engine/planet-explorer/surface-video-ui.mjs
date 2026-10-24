/**
 * Opt-in streaming control surface. PRIVATE sources live in closure memory only.
 * No localStorage, world snapshot, shared event, analytics, console output or URL logging.
 */
import {ProviderAdapterRegistry} from "./video-provider-adapters.mjs";
import {PrivatePlaybackController,createOfficialEmbed} from "./private-playback-controller.mjs";
import {PublicSyncController} from "./public-sync-controller.mjs";
import {VideoTextureRenderer} from "./video-texture-renderer.mjs";
import {CSS3DEmbedRenderer} from "./css3d-embed-renderer.mjs";
import {geoLocal,geoOffset,terrainSurface} from "./geo.mjs";
const make=(tag,className="",label="")=>{
 const el=document.createElement(tag);el.className=className;if(label)el.textContent=label;return el;
};
const button=(label,fn)=>{const b=make("button","",label);b.type="button";b.addEventListener("click",fn);return b;};
export function installSurfaceVideoUI({
 getRenderer,getController,getTerrain,getOwnerWorld=()=>null,
 publicTransport=null,publicPolicy=null,authorizePublic=null,
 hlsFactory=null
}){
 const stage=document.querySelector(".view-panel"),wrap=stage.querySelector(".canvas-wrap");
 const toolbar=document.getElementById("viewport-toolbar"),quick=document.getElementById("viewport-quick-panel");
 const root=make("div","ue-stream-panel");root.id="ue-stream-panel";root.hidden=true;
 root.setAttribute("role","dialog");root.setAttribute("aria-label","3D映像配信設定");
 root.innerHTML=`<header><strong>📺 3D Surface Streaming / PRIVATE</strong><button type="button" data-close>× 閉じる</button></header>
 <section class="ue-stream-fields">
 <label>動画のURL (HTTPS)<input data-url type="url" inputmode="url" autocomplete="off" spellcheck="false" placeholder="https://...mp4 または YouTube URL"></label>
 <label class="ue-stream-check"><input data-trust type="checkbox">直接MP4/WebM/HLSの配信元ドメインを、この画面を開いている間だけ許可する</label>
 <label>表示位置<select data-anchor><option value="front">現在地の前方3m</option><option value="building">近くのオーナー建物の正面</option></select></label>
 <div class="ue-stream-controls"><label>幅(m)<input data-width type="number" min=".5" max="8" step=".1" value="2.4"></label>
 <label>縦横比<select data-aspect><option value="1.7777778">16:9</option><option value="1.333333">4:3</option><option value="1">1:1</option></select></label></div>
 <button type="button" data-add>PRIVATEモニターを設置</button>
 <small>PRIVATE動画のURL・タイトル・視聴履歴はセーブやマルチプレイに含めません。ページを閉じると登録は消えます。
  動画へのアクセスそのものは配信サイト側に通知されます。公式埋め込みは3D操作面をタップして開きます。</small>
 <p data-public>PUBLIC: 認証済みの配信サーバーが未接続です。共用放送は利用できません。</p>
 </section><section data-list class="ue-stream-list"></section>
 <output data-status role="status" aria-live="polite"></output>
 <div data-player class="ue-stream-player" hidden><header><strong>公式プレイヤー</strong><button type="button" data-player-close>× 戻る</button></header><div data-player-body></div>
 <small>公式プレイヤーはWebGLで遮蔽できないため、別の操作ウィンドウで表示します。</small></div>`;
 stage.append(root);
 const get=selector=>root.querySelector(selector);
 const toggle=button("📺 3D動画配信",()=>open());
 const quickToggle=button("📺 3Dストリーム",()=>open());
 toolbar.append(toggle);quick.insertBefore(quickToggle,document.getElementById("viewport-menu"));
 const overlay=make("div","ue-stream-world");wrap.append(overlay);
 const embeds=new CSS3DEmbedRenderer(overlay);
 const allow={directHosts:[]},adapters=new ProviderAdapterRegistry(allow);
 const mediaHost=make("div","ue-stream-video-host");wrap.append(mediaHost);
 const privatePlayback=new PrivatePlaybackController({hlsFactory,host:mediaHost});
 const entries=new Map();let count=0,activeRenderer=null,layer=null,frame=0,lastUpdate=0;
 const status=message=>{get("[data-status]").textContent=message;};
 const publicSync=new PublicSyncController({transport:publicTransport,policy:publicPolicy,
  authorize:authorizePublic,onCommand:command=>{
   // Only a known, explicitly PUBLIC screen can consume shared state.
   const target=entries.get(command.screenId);
   if(!target||target.mode!=="public")return;
   const session=privatePlayback.get(target.id);
   if(!session?.media)return;
   if(command.action==="pause"||command.action==="stop")privatePlayback.pause(target.id);
   else{
    if(Number.isFinite(command.position)&&Math.abs(session.media.currentTime-command.position)>1.5)
     session.media.currentTime=command.position;
    if(command.action==="play")privatePlayback.play(target.id).catch(()=>status("タップ再生と再同期が必要です"));
   }
  }});
 const publicOnline=publicSync.connect();
 if(publicOnline)get("[data-public]").textContent="PUBLICサーバーに接続されています（配信者権限が必要）。";
 function ensureLayer(){
  const r=getRenderer();
  if(!r||r===activeRenderer)return;
  activeRenderer=r;
  layer=new VideoTextureRenderer(r.gl,{onError:(id,message)=>{privatePlayback.pause(id);status(message);}});
  r.surfaceVideoLayer=layer;
  r.surfaceVideoEntries=()=>Array.from(entries.values()).filter(entry=>
   entry.source.kind==="video").map(entry=>{
     const pose=poseFor(entry);
     return pose?{...pose,id:entry.id,video:privatePlayback.get(entry.id)?.media||null}:null;
   }).filter(Boolean);
 }
 function poseFor(entry){
  const anchor=entry.anchor;
  if(anchor){
   const b=getOwnerWorld()?.buildings?.find(b=>b.id===anchor.buildingId);
   if(!b)return null;
   const terrain=getTerrain(),r=b.rotation||0;
   const geo=geoOffset(b.lat,b.lon,Math.sin(r)*2.4,Math.cos(r)*2.4,terrain.planet.radiusM);
   return {...geo,height:2.2,width:entry.width,aspect:entry.aspect,rotation:r*180/Math.PI};
  }
  return entry.pose;
 }
 function open(){root.hidden=false;quick.hidden=true;renderList();}
 function close(){closePlayer();root.hidden=true;}
 get("[data-close]").addEventListener("click",close);
 function closePlayer(){
  get("[data-player-body]").replaceChildren();
  get("[data-player]").hidden=true;
  for(const state of privatePlayback.sessions.values())state.iframe=null;
 }
 get("[data-player-close]").addEventListener("click",closePlayer);
 async function press(entry){
  const session=privatePlayback.get(entry.id);if(!session)return;
  if(session.source.kind==="embed"){
   closePlayer();
   const box=get("[data-player-body]");
   box.append(createOfficialEmbed(session));
   get("[data-player]").hidden=false;root.hidden=false;
   return;
  }
  try{
   if(session.media?.paused)await privatePlayback.play(entry.id);
   else privatePlayback.pause(entry.id);
   renderList();
  }catch(e){status(e.message);}
 }
 function drop(id){
  entries.delete(id);privatePlayback.close(id);embeds.remove(id);layer?.release(id);renderList();
 }
 function renderList(){
  const list=get("[data-list]");list.replaceChildren();
  if(!entries.size){list.append(make("small","", "設置された一時配信モニターはありません。"));return;}
  for(const entry of entries.values()){
   const s=privatePlayback.get(entry.id);
   const row=make("div","ue-stream-item");
   row.append(make("strong","",entry.source.provider.toUpperCase()+" / PRIVATE / "+(entry.anchor?"建物に追従":"独立設置")));
   row.append(button(entry.source.kind==="embed"?"▶ 公式プレイヤー":s?.media?.paused?"▶ 再生":"⏸ 一時停止",()=>void press(entry)));
   if(s?.media){
    row.append(button("↺ 再読み込み",()=>{
     const t=privatePlayback.get(entry.id);if(!t)return;
     try{t.media.load();status("動画を再読み込みしました。タップして再生してください。");}
     catch(_){status("再読み込みできませんでした。");}
    }));
   }
   row.append(button("× 撤去",()=>drop(entry.id)));
   list.append(row);
  }
 }
 get("[data-add]").addEventListener("click",()=>{
  try{
   const controller=getController(),terrain=getTerrain(),renderer=getRenderer();
   if(!controller?.nearGround||!renderer)throw Error("地表に降りてからモニターを設置してください");
   const raw=get("[data-url]").value.trim();
   if(!raw)throw Error("配信元のURLを入力してください");
   const parsed=new URL(raw);
   allow.directHosts=get("[data-trust]").checked&&parsed.protocol==="https:"?[parsed.hostname.toLowerCase()]:[];
   const source=adapters.resolve(raw);
   const mobile=/iPhone|iPad|iPod/i.test(navigator.userAgent);
   if(source.kind==="video"&&Array.from(entries.values()).filter(e=>e.source.kind==="video").length>=(mobile?2:4))
    throw Error("動画テクスチャの同時表示上限です。既存モニターを撤去してください。");
   const width=Number(get("[data-width]").value),aspect=Number(get("[data-aspect]").value);
   if(!Number.isFinite(width)||width<.5||width>8||![1.7777778,1.333333,1].includes(aspect))
    throw Error("モニターの寸法が不正です");
   let anchor=null,pose=null;
   if(get("[data-anchor]").value==="building"){
    const owners=getOwnerWorld()?.buildings||[];
    const nearest=owners.map(b=>{
     const p=geoLocal(controller.origin.lat,controller.origin.lon,b.lat,b.lon,terrain.planet.radiusM);
     return {b,d:Math.hypot(p.eastM-controller.x,p.northM-controller.z)};
    }).sort((a,b)=>a.d-b.d)[0];
    if(!nearest||nearest.d>15)throw Error("15m以内にオーナー建物がありません");
    anchor={buildingId:nearest.b.id};
   }else{
    const x=controller.x+Math.sin(controller.yaw)*3,z=controller.z+Math.cos(controller.yaw)*3;
    const geo=controller.locationAt(x,z);
    if(terrainSurface(terrain,geo.lat,geo.lon).water)throw Error("海面には設置できません");
    pose={...geo,height:2.2,width,aspect,rotation:controller.yaw*180/Math.PI};
   }
   const id="local-screen-"+(++count);
   const entry={id,source,mode:"private",anchor,pose,width,aspect};
   privatePlayback.open(id,source,{onStatus:message=>status(message)});
   entries.set(id,entry);
   const marker=embeds.attach(id,()=>void press(entry));
   marker.textContent=source.kind==="embed"?"▶ 公式プレイヤー":"▶ / ⏸ 画面操作";
   get("[data-url]").value="";get("[data-trust]").checked=false;allow.directHosts=[];
   status("PRIVATEスクリーンを設置しました。画面をタップして再生できます。");
   ensureLayer();renderList();close();
  }catch(e){status(e.message);}
 });
 function update(now){
  frame=requestAnimationFrame(update);
  if(now-lastUpdate<150)return;lastUpdate=now;
  ensureLayer();
  const r=getRenderer(),c=getController(),terrain=getTerrain();
  if(!r?.pickVP||!c?.nearGround||r.xrView||document.hidden){
   embeds.hideAll();for(const e of entries.values())privatePlayback.setVisible(e.id,false);return;
  }
  const rect=r.canvas.getBoundingClientRect(),bounds=wrap.getBoundingClientRect();
  const offsetX=rect.left-bounds.left,offsetY=rect.top-bounds.top;
  for(const entry of entries.values()){
   const p=poseFor(entry);
   if(!p){embeds.remove(entry.id);privatePlayback.setVisible(entry.id,false);continue;}
   const geo=geoLocal(c.origin.lat,c.origin.lon,p.lat,p.lon,terrain.planet.radiusM);
   const distance=Math.hypot(geo.eastM-c.x,geo.northM-c.z);
   const show=distance<38;
   privatePlayback.setVisible(entry.id,show);
   if(!show){embeds.nodes.get(entry.id).hidden=true;continue;}
   const x=geo.eastM-r.cx,z=geo.northM-r.cz;
   embeds.update(entry.id,r.pickVP,{x,y:terrainSurface(terrain,p.lat,p.lon).elevationM+p.height,z,
     width:p.width,aspect:p.aspect,rotation:p.rotation},rect);
   // The canvas and overlay have the same scroll-independent parent.
   const el=embeds.nodes.get(entry.id);
   if(el){el.style.left=offsetX+"px";el.style.top=offsetY+"px";}
  }
 }
 const visibility=()=>{if(document.hidden)for(const entry of entries.values())privatePlayback.setVisible(entry.id,false);};
 document.addEventListener("visibilitychange",visibility);
 function destroy(){
  cancelAnimationFrame(frame);document.removeEventListener("visibilitychange",visibility);
  closePlayer();publicSync.disconnect();privatePlayback.closeAll();embeds.destroy();
  if(activeRenderer?.surfaceVideoLayer===layer){layer.destroy();activeRenderer.surfaceVideoLayer=null;activeRenderer.surfaceVideoEntries=null;}
  entries.clear();root.remove();overlay.remove();mediaHost.remove();toggle.remove();quickToggle.remove();
 }
 ensureLayer();frame=requestAnimationFrame(update);
 return {open,close,destroy,get privateScreens(){return entries.size;},
  // No snapshot/export method by design. An online server must supply its own public screens.
  publicSync};
}
