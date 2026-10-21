/** Globe-specific city directory. Purely additive to existing free-landing interactions. */
export function installOrbitalCitiesUI({getDestinations,onSelect,onFree,notify=()=>{}}){
 const $=id=>document.getElementById(id);
 const controls=$("orbit-city-controls"),toggle=$("orbit-city-toggle");
 const menu=$("orbit-city-menu"),list=$("orbit-city-list"),pins=$("orbit-city-pins");
 const free=$("orbit-city-free"),hint=$("orbit-city-hint");
 let enabled=false,locations=[],selectedId=null;
 const listButtons=new Map(),pinButtons=new Map();
 function ensureLocations(){
  if(locations.length)return;
  locations=getDestinations()||[];
  list.replaceChildren();pins.replaceChildren();
  for(const place of locations){
   const entry=document.createElement("li"),button=document.createElement("button");
   button.type="button";button.className="orbit-city-choice";button.dataset.cityId=place.id;
   const heading=document.createElement("strong");heading.textContent=place.icon+" "+place.name;
   const caption=document.createElement("small");caption.textContent=place.region;
   button.append(heading,caption);entry.append(button);list.append(entry);
   listButtons.set(place.id,button);
   const pin=document.createElement("button");pin.type="button";
   pin.className="orbit-city-pin";pin.dataset.cityId=place.id;pin.hidden=true;
   pin.title=place.name;pin.setAttribute("aria-label",place.name+"を選択");
   const emoji=document.createElement("span");emoji.className="orbit-city-pin-emoji";
   emoji.textContent=place.icon;const text=document.createElement("span");
   text.className="orbit-city-pin-label";text.textContent=place.name;
   pin.append(emoji,text);pins.append(pin);pinButtons.set(place.id,pin);
  }
  syncSelected();
 }
 function syncSelected(){
  for(const [id,button]of [...listButtons,...pinButtons])
   button.setAttribute("aria-pressed",String(selectedId===id));
 }
 function choose(id){
  if(!enabled)return;
  ensureLocations();
  const place=locations.find(p=>p.id===id);if(!place)return;
  const result=onSelect(place);
  if(result?.ok===false){notify(result.message);return;}
  selectedId=id;syncSelected();hint.textContent="📍 "+place.name+"：下の「この都市へ降下」で確定";
  menu.hidden=true;toggle.setAttribute("aria-expanded","false");
 }
 function clearChoice(){selectedId=null;syncSelected();hint.textContent="🌐 地表をタップして自由降下もできます";}
 function goFree(){
  if(!enabled)return;
  clearChoice();onFree();menu.hidden=true;
  toggle.setAttribute("aria-expanded","false");
  hint.textContent="🌐 惑星の好きな地点をタップして降下できます";
 }
 function handleClick(e){
  const button=e.target.closest("button[data-city-id]");
  if(button)choose(button.dataset.cityId);
 }
 list.addEventListener("click",handleClick);
 pins.addEventListener("click",handleClick);
 toggle.addEventListener("click",()=>{
  if(!enabled)return;
  try{ensureLocations();menu.hidden=!menu.hidden;
   toggle.setAttribute("aria-expanded",String(!menu.hidden));}
  catch(err){notify("都市一覧を読み込めません: "+err.message);}
 });
 free.addEventListener("click",goFree);
 function setActive(active){
  enabled=Boolean(active);
  controls.hidden=!enabled;pins.hidden=!enabled;
  if(!enabled){menu.hidden=true;toggle.setAttribute("aria-expanded","false");
   for(const button of pinButtons.values())button.hidden=true;
   return;}
  try{ensureLocations();}catch(err){notify("都市マーカーを読み込めません: "+err.message);}
 }
 function frame(projected){
  if(!enabled)return;
  const byId=new Map((projected||[]).map(p=>[p.id,p]));
  for(const [id,button]of pinButtons){
   const point=byId.get(id);
   button.hidden=!point?.onScreen;
   if(!button.hidden){
    button.style.left=(point.u*100).toFixed(3)+"%";
    button.style.top=(point.v*100).toFixed(3)+"%";
   }
  }
 }
 function reset(){
  locations=[];selectedId=null;listButtons.clear();pinButtons.clear();
  list.replaceChildren();pins.replaceChildren();
  menu.hidden=true;toggle.setAttribute("aria-expanded","false");
  hint.textContent="🌐 地表をタップして自由降下もできます";
 }
 return {setActive,frame,reset,clearChoice,selectCity:choose,
  get selectedId(){return selectedId;},get destinations(){return locations;}};
}
