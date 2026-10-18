import {MAP_CATEGORIES,mapDirectoryEntries,metres} from "./map-directory.mjs?v=0.8j-map-index";

/** Compact, accessible catalogue of nearby map objects. No click on the map is needed. */
export function installMapDirectoryUI({get,onOpen,onMove,notify=()=>{}}){
 const $=id=>document.getElementById(id);
 const panel=$("map-directory-panel"),root=$("map-directory-list");
 const tabs=$("map-directory-tabs"),filter=$("map-directory-filter");
 const range=$("map-directory-radius"),status=$("map-directory-status");
 let category="animals",visible=[];
 const tabButtons=[...tabs.querySelectorAll("button[data-map-category]")];
 function refresh(){
  if(panel.hidden)return;
  const context=get();
  const {items,total}=mapDirectoryEntries(context,{
   category,radiusM:Number(range.value)||450,search:filter.value,limit:60
  });
  visible=items;
  for(const button of tabButtons)
   button.setAttribute("aria-pressed",String(button.dataset.mapCategory===category));
  const selected=MAP_CATEGORIES.find(c=>c.id===category);
  status.textContent=(selected?.title||"対象")+" "+total+"件"+
   (total>items.length?"（近い順に"+items.length+"件表示）":"")+
   " ／ 各項目の「操作」または「向かう」を選択";
  root.replaceChildren();
  const fragment=document.createDocumentFragment();
  for(let i=0;i<items.length;i++){
   const e=items[i],li=document.createElement("li");
   li.className="map-directory-item";
   const description=document.createElement("div");description.className="map-directory-description";
   const heading=document.createElement("strong");
   heading.textContent=e.icon+" "+e.title;
   const sub=document.createElement("small");
   sub.textContent=e.subtitle+"・"+metres(e.distanceM);
   description.append(heading,sub);
   const controls=document.createElement("div");controls.className="map-directory-item-actions";
   for(const [kind,label]of [["open",e.category==="animals"?"操作":e.category==="people"?"選択":e.category==="resources"?"採集":"詳細"],["move","向かう"]]){
    const button=document.createElement("button");
    button.type="button";button.dataset.action=kind;button.dataset.index=String(i);
    button.textContent=label;
    button.setAttribute("aria-label",e.title+"："+label);
    controls.append(button);
   }
   li.append(description,controls);fragment.append(li);
  }
  if(!items.length){
   const empty=document.createElement("li");empty.className="map-directory-empty";
   empty.textContent=filter.value?"検索条件に一致する対象がありません":"この範囲に対象がありません";
   fragment.append(empty);
  }
  root.append(fragment);
 }
 function open(nextCategory){
  if(MAP_CATEGORIES.some(c=>c.id===nextCategory))category=nextCategory;
  panel.hidden=false;$("viewport-directory").setAttribute("aria-expanded","true");
  refresh();
 }
 function close(){
  panel.hidden=true;visible=[];
  $("viewport-directory").setAttribute("aria-expanded","false");
 }
 $("viewport-directory").addEventListener("click",()=>panel.hidden?open():close());
 $("map-directory-close").addEventListener("click",close);
 $("map-directory-refresh").addEventListener("click",refresh);
 tabs.addEventListener("click",e=>{
  const target=e.target.closest("button[data-map-category]");
  if(!target||!tabs.contains(target))return;
  category=target.dataset.mapCategory;filter.value="";refresh();
 });
 for(const element of [filter,range])
  element.addEventListener(element===filter?"input":"change",refresh);
 root.addEventListener("click",e=>{
  const target=e.target.closest("button[data-action][data-index]");
  if(!target||!root.contains(target))return;
  const entry=visible[Number(target.dataset.index)];
  if(!entry)return;
  const result=target.dataset.action==="move"?onMove(entry):onOpen(entry);
  if(result?.message){notify(result.message);status.textContent=result.message;}
  if(target.dataset.action==="move"&&result?.ok)close();
 });
 return {open,close,refresh,get openCategory(){return category;}};
}
