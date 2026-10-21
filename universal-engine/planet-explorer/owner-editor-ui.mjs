/** Touch-first local owner editor. Taps are routed ahead of gameplay picking. */
import {terrainSurface} from "./geo.mjs";
import {OWNER_BUILDING_KINDS,OWNER_FACILITIES} from "./owner-world.mjs";
import {FACILITIES} from "./construction-system.mjs";
export function installOwnerEditor({getWorld,getTerrain,getController,getRenderer,onEnter,onCommit,log}){
 const $=id=>document.getElementById(id);
 const panel=$("owner-panel"),toggle=$("viewport-owner"),toolbar=$("toolbar-owner");
 const tool=$("owner-tool"),building=$("owner-building"),radius=$("owner-radius"),width=$("owner-road-width");
 const status=$("owner-status"),selected=$("owner-selected");
 let active=false,selectedId=null,roadStart=null,moveAwaiting=false;
 const notice=message=>{status.textContent=message;log(message);};
 const sync=()=>{
  panel.hidden=!active;toggle.setAttribute("aria-pressed",String(active));
  toolbar.setAttribute("aria-pressed",String(active));toggle.textContent=active?"✏️ 編集中":"🏗️ オーナー";
  selected.textContent=selectedId?"選択中: #"+selectedId:"建物未選択";
 };
 const endWork=()=>{selectedId=null;roadStart=null;moveAwaiting=false;const renderer=getRenderer();if(renderer)renderer.ownerSelectedId=null;};
 const enable=flag=>{
  active=Boolean(flag);endWork();
  if(active){onEnter?.();notice("✏️ オーナーモード：地面をタップして編集。資材は消費しません");}
  sync();
 };
 const finish=result=>{
  notice(result.message);
  if(result.ok){onCommit();const renderer=getRenderer();if(renderer)renderer.ownerSelectedId=selectedId;}
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
   const hit=world.nearest(p,16);
   if(name==="move"&&selectedId){
    if(p.surface.water||p.surface.river){notice("水上へは建物を移動できません");return true;}
    const result=world.move(selectedId,p);moveAwaiting=false;return finish(result);
   }
   if(!hit){notice("近くにオーナー配置の建物がありません");return true;}
   selectedId=hit.id;getRenderer().ownerSelectedId=hit.id;sync();
   if(name==="delete"){const r=world.remove(hit.id);selectedId=null;getRenderer().ownerSelectedId=null;sync();return finish(r);}
   moveAwaiting=name==="move";
   const title=(OWNER_FACILITIES[hit.kind]||FACILITIES[hit.kind])?.name||hit.kind;
   notice(moveAwaiting?"📍 "+title+"を選択。移動先の地面をタップ":"🏠 "+title+" #"+hit.id+" を選択。回転・移動・削除できます");
   return true;
  }
  if(p.surface.water||p.surface.river){notice("水面・河川ではこの編集はできません");return true;}
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
 $("owner-close").addEventListener("click",()=>enable(false));
 tool.addEventListener("change",()=>{roadStart=null;moveAwaiting=false;
  if(tool.value==="road")notice("道路：始点 → 終点をタップ。次の区間も続けて敷設できます");
  else if(tool.value==="move")notice("移動：まず建物を選択し、続けて移動先をタップ");
  else notice("ツールを変更しました。地面をタップしてください");
 });
 $("owner-rotate").addEventListener("click",()=>{
  if(!selectedId){notice("先に選択ツールで建物をタップしてください");return;}
  finish(getWorld().rotate(selectedId));
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
 sync();
 return {get active(){return active;},tap,reset(){endWork();sync();},setActive:enable};
}
