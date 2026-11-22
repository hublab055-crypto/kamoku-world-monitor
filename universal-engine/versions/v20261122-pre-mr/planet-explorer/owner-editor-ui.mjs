/** Touch-first local owner editor. Taps are routed ahead of gameplay picking. */
import {terrainSurface} from "./geo.mjs?v=0.8y-harbor";
import {OWNER_BUILDING_KINDS,OWNER_FACILITIES} from "./owner-world.mjs?v=0.9c-asset-v2";
import {FACILITIES} from "./construction-system.mjs";
export function installOwnerEditor({getWorld,getTerrain,getController,getRenderer,onEnter,onCommit,log}){
 const $=id=>document.getElementById(id);
 const panel=$("owner-panel"),toggle=$("viewport-owner"),toolbar=$("toolbar-owner"),collapse=$("owner-collapse");
 const tool=$("owner-tool"),building=$("owner-building"),radius=$("owner-radius"),width=$("owner-road-width");
 const status=$("owner-status"),selected=$("owner-selected");
 const shape=$("owner-shape"),width3=$("owner-size-x"),height3=$("owner-size-y"),
  depth3=$("owner-size-z"),offset3=$("owner-elevation"),color3=$("owner-color"),group3=$("owner-group");
 const prefabGroup=$("owner-prefab-group"),prefabName=$("owner-prefab-name"),prefabList=$("owner-prefab-list");
 const rgb=()=>[1,3,5].map(n=>parseInt(color3.value.slice(n,n+2),16)/255);
 const hex=color=>"#"+color.map(c=>Math.round(c*255).toString(16).padStart(2,"0")).join("");
 const primitiveParams=()=>({width:Number(width3.value),height:Number(height3.value),
  depth:Number(depth3.value),offsetY:Number(offset3.value),color:rgb(),group:group3.value});
 const selectedPart=()=>getWorld()?.primitives.find(p=>p.id===selectedId)||null;
 const populate=part=>{
  shape.value=part.shape;width3.value=part.width;height3.value=part.height;
  depth3.value=part.depth;offset3.value=part.offsetY;color3.value=hex(part.color);group3.value=part.group;
  if(part.group){prefabGroup.value=part.group;if(!prefabName.value)prefabName.value=part.group;}
 };
 let active=false,collapsed=false,selectedId=null,roadStart=null,moveAwaiting=false;
 const notice=message=>{status.textContent=message;log(message);};
 function refreshPrefabs(preferred=""){
  const previous=preferred||prefabList.value,items=getWorld()?.prefabs||[];
  const options=items.map(prefab=>{const option=document.createElement("option");option.value=prefab.name;
   option.textContent=prefab.name+"（"+prefab.parts.length+"パーツ）";return option;});
  if(!options.length){const empty=document.createElement("option");empty.value="";empty.textContent="未保存";options.push(empty);}
  prefabList.replaceChildren(...options);
  if(items.some(prefab=>prefab.name===previous))prefabList.value=previous;
 }
 const sync=()=>{
  panel.hidden=!active;toggle.setAttribute("aria-pressed",String(active));
  toolbar.setAttribute("aria-pressed",String(active));toggle.textContent=active?"✏️ 編集中":"🏗️ オーナー";
  panel.classList.toggle("is-collapsed",collapsed);
  collapse.textContent=collapsed?"◀︎":"▶︎";
  collapse.setAttribute("aria-expanded",String(!collapsed));
  collapse.setAttribute("aria-label",collapsed?"オーナーウィンドウを展開する":"オーナーウィンドウを折り畳む");
  collapse.title=collapsed?"展開する":"折り畳む";
  selected.textContent=selectedId?"選択中: #"+selectedId:"建物未選択";
 };
 const endWork=()=>{selectedId=null;roadStart=null;moveAwaiting=false;const renderer=getRenderer();if(renderer)renderer.ownerSelectedId=null;};
 const enable=flag=>{
  active=Boolean(flag);endWork();
  if(active){collapsed=false;onEnter?.();notice("✏️ オーナーモード：地面をタップして編集。資材は消費しません");}
  sync();
 };
 const finish=result=>{
  notice(result.message);
  if(result.ok){refreshPrefabs(result.name);onCommit();const renderer=getRenderer();if(renderer)renderer.ownerSelectedId=selectedId;}
  return true;
 };
 const ground=(x,y)=>{
  const renderer=getRenderer(),controller=getController(),terrain=getTerrain();
  if(!renderer||!controller?.nearGround)return null;
  const p=renderer.pickGround(x,y);
  if(!p)return null;
  const geo=controller.locationAt(p.x,p.z);
  const surface=terrainSurface(terrain,geo.lat,geo.lon);
  return {...geo,surface};
 };
 function tap(x,y){
  if(!active)return false;
  const world=getWorld();if(!world)return true;
  const p=ground(x,y);
  if(!p){notice("地上の地面をタップしてください");return true;}
  const name=tool.value;
  if(name==="select"||name==="move"||name==="delete"){
   const buildingHit=world.nearest(p,16),partHit=world.nearestPrimitive(p,16);
   const dx=value=>value?Math.hypot((value.lat-p.lat)*111195,
     (value.lon-p.lon)*111195*Math.cos(p.lat*Math.PI/180)):Infinity;
   const hit=dx(partHit)<dx(buildingHit)?partHit:buildingHit;
   if(name==="move"&&selectedId){
    if(p.surface.water||p.surface.river){notice("水上へは建物を移動できません");return true;}
    const result=selectedPart()?world.movePrimitive(selectedId,p):world.move(selectedId,p);
    moveAwaiting=false;return finish(result);
   }
   if(!hit){notice("近くにオーナー配置の建物がありません");return true;}
   selectedId=hit.id;getRenderer().ownerSelectedId=hit.id;sync();
   if(name==="delete"){const r=selectedPart()?world.removePrimitive(hit.id):world.remove(hit.id);selectedId=null;getRenderer().ownerSelectedId=null;sync();return finish(r);}
   moveAwaiting=name==="move";
   if(hit.shape)populate(hit);
   const title=hit.shape?"🧱 "+hit.shape:(OWNER_FACILITIES[hit.kind]||FACILITIES[hit.kind])?.name||hit.kind;
   notice(moveAwaiting?"📍 "+title+"を選択。移動先の地面をタップ":"🏠 "+title+" #"+hit.id+" を選択。回転・移動・削除できます");
   return true;
  }
  if(p.surface.water||p.surface.river){notice("水面・河川ではこの編集はできません");return true;}
  if(name==="primitive"){
   const result=world.placePrimitive(shape.value,p,primitiveParams());
   if(result.ok){selectedId=result.id;getRenderer().ownerSelectedId=selectedId;sync();}
   return finish(result);
  }
  if(name==="prefab"){
   const result=world.placePrefab(prefabList.value,p);
   if(result.ok){selectedId=result.ids[0]||null;getRenderer().ownerSelectedId=selectedId;sync();}
   return finish(result);
  }
  if(name==="building"){
   const result=world.place(building.value,p);
   if(result.ok){selectedId=result.id;getRenderer().ownerSelectedId=selectedId;sync();}
   return finish(result);
  }
  if(name==="road"){
   if(!roadStart){roadStart=p;notice("🛣️ 道の始点を指定。終点をタップしてください");return true;}
   const start=roadStart;roadStart=null;
   const result=world.road(start,p,Number(width.value));
   if(result.ok)roadStart=p; // Join next segment continuously.
   return finish(result);
  }
  if(["raise","lower","flatten"].includes(name)){
   return finish(world.sculpt(p,name,Number(radius.value),name==="flatten"?.85:3,p.surface.elevationM));
  }
  return true;
 }
 [toggle,toolbar].forEach(b=>b.addEventListener("click",()=>enable(!active)));
 collapse.addEventListener("click",()=>{collapsed=!collapsed;sync();});
 $("owner-close").addEventListener("click",()=>enable(false));
 tool.addEventListener("change",()=>{roadStart=null;moveAwaiting=false;
  if(tool.value==="road")notice("道路：始点 → 終点をタップ。次の区間も続けて敷設できます");
  else if(tool.value==="move")notice("移動：まず建物を選択し、続けて移動先をタップ");
  else if(tool.value==="prefab")notice(prefabList.value?"保存建築物「"+prefabList.value+"」の配置地点をタップ":"先に保存建築物を選んでください");
  else notice("ツールを変更しました。地面をタップしてください");
 });
 $("owner-rotate").addEventListener("click",()=>{
  if(!selectedId){notice("先に選択ツールで建物をタップしてください");return;}
  finish(selectedPart()?getWorld().rotatePrimitive(selectedId):getWorld().rotate(selectedId));
 });
 $("owner-primitive-apply").addEventListener("click",()=>{
  if(!selectedPart()){notice("先に建築パーツを選択してください");return;}
  finish(getWorld().changePrimitive(selectedId,{...primitiveParams(),shape:shape.value}));
 });
 group3.addEventListener("input",()=>{prefabGroup.value=group3.value;if(!prefabName.value)prefabName.value=group3.value;});
 $("owner-prefab-save").addEventListener("click",()=>{
  const world=getWorld(),name=prefabName.value.trim(),exists=world.prefabs.some(prefab=>prefab.name===name);
  if(exists&&!window.confirm("保存建築物「"+name+"」を現在のグループ内容で上書きしますか？"))return;
  finish(world.savePrefab(prefabGroup.value,name,{replace:exists}));
 });
 $("owner-prefab-use").addEventListener("click",()=>{
  if(!prefabList.value){notice("先に建築物を保存してください");return;}
  tool.value="prefab";roadStart=null;moveAwaiting=false;
  notice("📦 「"+prefabList.value+"」を配置する地面をタップしてください");
 });
 $("owner-prefab-delete").addEventListener("click",()=>{
  const name=prefabList.value;if(!name){notice("削除する保存建築物がありません");return;}
  if(!window.confirm("保存建築物「"+name+"」を一覧から削除しますか？\nすでに配置した建物は残ります。"))return;
  finish(getWorld().deletePrefab(name));
 });
 $("owner-undo").addEventListener("click",()=>{endWork();sync();finish(getWorld().undo());});
 $("owner-redo").addEventListener("click",()=>{endWork();sync();finish(getWorld().redo());});
 $("owner-cancel").addEventListener("click",()=>{endWork();sync();notice("選択を解除しました");});
 $("owner-erase").addEventListener("click",()=>{
  if(!window.confirm("このセーブのオーナー編集（建物・道路・地形）をすべて消去しますか？\n通常の建築や旧セーブは変更しません。"))return;
  endWork();sync();finish(getWorld().clear());
 });
 const options=OWNER_BUILDING_KINDS.map(kind=>{
  const opt=document.createElement("option");opt.value=kind;opt.textContent=(OWNER_FACILITIES[kind]||FACILITIES[kind]).name;
  return opt;
 });
 building.replaceChildren(...options);
 refreshPrefabs();sync();
 return {get active(){return active;},tap,reset(){endWork();refreshPrefabs();sync();},setActive:enable};
}
