/** Travel desk: browse places without moving until the explicit confirmation. */
export function installSettlementTravelUI({getDestinations,onTravel,notify=()=>{}}){
 const $=id=>document.getElementById(id);
 const panel=$("settlement-travel-panel"),list=$("settlement-travel-list");
 const preview=$("settlement-travel-preview"),status=$("settlement-travel-status");
 const go=$("settlement-travel-go"),toggle=$("viewport-settlements");
 let selected="tower",visible=[];
 function refresh(){
  visible=getDestinations()||[];
  if(!visible.some(p=>p.id===selected))selected=visible[0]?.id||"";
  list.replaceChildren();
  for(const place of visible){
   const li=document.createElement("li"),button=document.createElement("button");
   button.type="button";button.dataset.destination=place.id;
   button.className="settlement-travel-choice";
   button.setAttribute("aria-pressed",String(selected===place.id));
   const title=document.createElement("strong");
   title.textContent=place.icon+" "+place.name;
   const detail=document.createElement("small");
   detail.textContent=place.region+" / "+(place.kind==="city"?"都市":place.kind==="town"?"町":"村");
   button.append(title,detail);li.append(button);list.append(li);
  }
  const place=visible.find(p=>p.id===selected);
  preview.textContent=place?(place.icon+" "+place.description+
   " 〔"+place.lat.toFixed(3)+"°, "+place.lon.toFixed(3)+"°〕"):"行き先がありません";
  go.disabled=!place;
  go.textContent=place?"✈️ "+place.name+"を訪れる":"行き先を選択";
 }
 function open(){
  panel.hidden=false;toggle.setAttribute("aria-expanded","true");
  try{refresh();status.textContent="行き先を選び「訪れる」を押してください。";}
  catch(err){visible=[];go.disabled=true;status.textContent="行き先を取得できません: "+err.message;}
 }
 function close(){panel.hidden=true;toggle.setAttribute("aria-expanded","false");}
 toggle.addEventListener("click",()=>panel.hidden?open():close());
 $("settlement-travel-close").addEventListener("click",close);
 list.addEventListener("click",e=>{
  const button=e.target.closest("button[data-destination]");
  if(!button||!list.contains(button))return;
  selected=button.dataset.destination;refresh();
 });
 go.addEventListener("click",()=>{
  const place=visible.find(p=>p.id===selected);if(!place)return;
  const result=onTravel(place);
  status.textContent=result?.message||"来訪に失敗しました";
  notify(status.textContent);
  if(result?.ok)close();
 });
 return {open,close,refresh,get selected(){return selected;}};
}
