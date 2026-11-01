/**
 * Civic music UI. Works in 2D/VR browser layers without locking player input.
 * All money mutations are delegated to MusicCulture's atomic model methods.
 */
import {MUSIC_VENUES,musicNow} from "./music-culture.mjs?v=0.9ao";
import {MUSIC_BAND_ROLES,musicianCandidates,MUSIC_CONTRACT_DAYS} from "./music-band.mjs?v=0.9ao";
const $=(id)=>document.getElementById(id);
const hour=h=>String(h).padStart(2,"0")+":00";
export function installMusicCultureUI({getCulture,getTownLife,getTownId,getActor,
 getPlanet,onPlayNPC=()=>{},onPerform=()=>{},hasInstrument=()=>false,
 onChange=()=>{},notify=()=>{},canJoin=()=>true}={}){
 const toolbar=$("toolbar"),quick=$("viewport-quick-menu");
 const openBtn=document.createElement("button");openBtn.textContent="🎭 音楽文化";
 openBtn.type="button";openBtn.id="toolbar-music-culture";toolbar?.append(openBtn);
 const quickBtn=document.createElement("button");quickBtn.textContent="🎭 街の音楽";
 quickBtn.type="button";quickBtn.id="viewport-music-culture";quick?.append(quickBtn);
 const panel=document.createElement("section");panel.className="ue-music-panel ue-culture-panel";
 panel.hidden=true;panel.setAttribute("role","dialog");panel.setAttribute("aria-label","街の音楽・職業・教育");
 panel.innerHTML=`
 <div class="ue-music-body"><header class="ue-music-header"><strong>🎭 街の音楽文化</strong>
 <button type="button" data-close>× 閉じる</button></header>
 <p>酒場・広場・教室で演奏、音楽を学習。街の住人と話し、3日間の契約で楽団を結成できます。</p>
 <p data-summary></p>
 <label class="ue-music-check"><input type="checkbox" data-auto checked>
 公演時間に近づいたらNPCの演奏を一度再生</label>
 <div data-venues class="ue-culture-venues"></div>
 <details><summary>📜 音楽活動の記録</summary><div data-journal></div></details>
 <output data-status role="status" aria-live="polite"></output></div>`;
 document.body.append(panel);
 const el=q=>panel.querySelector(q),list=el("[data-venues]");
 let lastAutoAttempt="",lastFrame=-1,lastUiRefresh=-1;
 const coins=()=>getTownLife()?.coins??0;
 const nearby=(venue)=>{
  const actor=getActor();if(!actor||actor.altitudeM>12.01||actor.travelMode!=="walk")return false;
  return Math.hypot(actor.x-venue.site.x,actor.z-venue.site.z)<=11;
 };
 function say(message){el("[data-status]").textContent=message;notify(message);}
 function action(venue,kind){
  const culture=getCulture(),townId=getTownId(),day=getPlanet()?.timeDays??0;
  if(!culture||!canJoin())return say("現在は音楽活動に参加できません");
  const near=nearby(venue),wallet=getTownLife();
  let result;
  if(kind==="attend")result=culture.attend(townId,venue.id,day,wallet,{near});
  else if(kind==="talk")result=culture.talkArtist(townId,venue.id,day,wallet,{near});
  else if(kind==="perform")result=culture.perform(townId,venue.id,day,wallet,
   {near,hasInstrument:hasInstrument()});
  else if(kind==="lesson")result=culture.lesson(townId,day,wallet,{near});
  else if(kind==="npc"){if(!near)return say("演奏会場の近くへ移動してください");
   onPlayNPC(venue);say("🎶 "+venue.musicianLabel+"のオリジナル曲を再生します");return;}
  else if(kind==="own"){if(!near)return say("会場の近くへ移動してください");
   onPerform(venue);return;}
  if(!result)return;
  if(result.ok){if(kind==="perform")onPerform(venue);
   try{onChange();}catch(e){notify(e.message);}}
  say(result.message);refresh();
 }
 function makeButton(label,fn){const b=document.createElement("button");b.type="button";b.textContent=label;b.addEventListener("click",fn);return b;}
 function bandControls(venue,days){
  const culture=getCulture(),townId=getTownId(),area=document.createElement("details");
  area.className="ue-culture-band";
  const heading=document.createElement("summary");
  heading.textContent="🎼 楽団の結成・雇用契約（"+MUSIC_CONTRACT_DAYS+"惑星日）";
  area.append(heading);
  const label=document.createElement("p");label.textContent=
   "NPC住民を演奏者として雇用します。契約金は所持金から一括払い。途中解約しても返金されません。";
  area.append(label);
  const available=musicianCandidates(townId,venue.id);
  const people=document.createElement("select");people.setAttribute("aria-label","雇う住人");
  for(const a of available)people.add(new Option(a.name,a.id));
  const roles=document.createElement("select");roles.setAttribute("aria-label","担当楽器");
  for(const role of MUSIC_BAND_ROLES)roles.add(new Option(role.name+" / 契約金 "+role.fee+"G",role.id));
  const row=document.createElement("div");row.className="ue-music-row";row.append(people,roles,
   makeButton("🤝 この住人を雇う",()=>{
    if(!canJoin())return say("現在は契約できません");
    const outcome=culture.hireArtist(townId,venue.id,people.value,roles.value,days,getTownLife(),{near:nearby(venue)});
    if(outcome.ok)onChange();
    say(outcome.message);refresh();
   }));
  area.append(row);
  const members=culture.activeBand(townId,days);
  if(!members.length){const empty=document.createElement("small");empty.textContent="この街の契約中の楽団員はまだいません";area.append(empty);}
  for(const member of members){
   const contracted=document.createElement("div");contracted.className="ue-music-row";
   const detail=document.createElement("span");const role=MUSIC_BAND_ROLES.find(r=>r.id===member.role);
   detail.textContent=member.residentId+" / "+(role?.name||member.role)+
    " / 契約終了日 "+member.endsDay;
   contracted.append(detail,makeButton("契約終了",()=>{
    if(!canJoin()||!nearby(venue))return say("会場の近くで契約を変更してください");
    const outcome=culture.releaseArtist(townId,member.residentId,days);
    if(outcome.ok)onChange();
    say(outcome.message);refresh();
   }));
   area.append(contracted);
  }
  return area;
 }
 function refresh(){
  const culture=getCulture(),townId=getTownId(),days=getPlanet()?.timeDays??0;
  if(!culture)return;list.replaceChildren();
  el("[data-summary]").textContent="所持金 "+coins()+"G ／ 演奏技能 "+culture.skill+
   " ／ 評判 "+culture.reputation+" ／ 惑星標準時 "+hour(Math.floor(((days%1)+1)%1*24));
  if(!culture.venue(townId,"tavern")){
   const p=document.createElement("p");p.textContent="音楽文化施設は都市・村で利用できます。街を訪れてください。";list.append(p);
  }else{
   for(const def of MUSIC_VENUES){
    const venue=culture.venue(townId,def.id),now=musicNow(venue,days);
    if(!venue)continue;
    const card=document.createElement("article");card.className="ue-culture-venue";
    const title=document.createElement("strong");title.textContent=venue.name;
    const status=document.createElement("p");
    status.textContent=(now.performing?"🎶 NPC演奏中":now.open?"営業中":"営業時間外")+
     " ／ 公演 "+venue.shows.map(hour).join("・")+
     " ／ 音楽担当 "+venue.musicianLabel+
     " ／ 観客 約"+venue.audienceCount+"人"+
     " ／ 会場資金 "+culture.balance(townId,venue.id)+"G"+
     " ／ 演奏家の累計収入 "+(culture.npcEarnings[townId+":"+venue.musicianId]||0)+"G"+
     " ／ 経験 "+(culture.npcExperience[townId+":"+venue.musicianId]||0);
    const where=document.createElement("small");
    where.textContent="街の座標 東 "+venue.site.x+"m / 北 "+venue.site.z+"m"+
      (nearby(venue)?" ／ 会場にいます":" ／ 参加には11m以内に移動");
    const row=document.createElement("div");row.className="ue-music-row";
    row.append(makeButton("▶ NPC演奏を聴く",()=>action(venue,"npc")));
    row.append(makeButton("💬 演奏家と話す",()=>action(venue,"talk")));
    if(venue.id==="school")row.append(makeButton("🎓 授業を受ける (12G)",()=>action(venue,"lesson")));
    else{
     row.append(makeButton("🎟 鑑賞 ("+venue.ticket+"G)",()=>action(venue,"attend")));
     row.append(makeButton("🎸 出演して報酬を得る",()=>action(venue,"perform")));
     row.append(makeButton("🎼 自作曲を披露",()=>action(venue,"own")));
    }
    card.append(title,status,where,row);
    if(venue.id!=="school")card.append(bandControls(venue,days));
    list.append(card);
   }
  }
  el("[data-journal]").textContent=culture.journal.slice(-15).reverse().join(" ／ ")||"まだ活動記録はありません";
 }
 function open(){panel.hidden=false;quick&&(quick.hidden=true);
  $("viewport-quick-toggle")?.setAttribute("aria-expanded","false");refresh();}
 function close(){panel.hidden=true;}
 openBtn.addEventListener("click",()=>panel.hidden?open():close());
 quickBtn.addEventListener("click",()=>panel.hidden?open():close());
 el("[data-close]").addEventListener("click",close);
 panel.addEventListener("keydown",e=>{if(e.key==="Escape"){e.stopPropagation();close();}});
 function tick(now){
  if(!Number.isFinite(now)||!getCulture()||!getActor()||!canJoin())return;
  const nowMs=performance.now();if(nowMs-lastFrame<900)return;lastFrame=nowMs;
  const town=getTownId(),culture=getCulture();
  for(const def of MUSIC_VENUES){
   const venue=culture.venue(town,def.id);
   if(venue&&musicNow(venue,now)?.performing&&culture.payNPC(town,venue.id,now).ok)
    onChange(); // At most one salary transaction per venue / planetary day
  }
  if(!panel.hidden&&nowMs-lastUiRefresh>5000){lastUiRefresh=nowMs;refresh();}
  const current=MUSIC_VENUES.map(v=>culture.venue(town,v.id)).filter(Boolean)
   .find(v=>musicNow(v,now)?.performing&&nearby(v));
  const show=current?musicNow(current,now).showId:"";
  if(!current||!el("[data-auto]").checked)return;
  if(show===lastAutoAttempt)return;
  lastAutoAttempt=show;
  // Best effort. If browser autoplay restrictions reject audio, the listener
  // can press the explicit "▶ NPC演奏を聴く" button instead.
  try{onPlayNPC(current,{auto:true});}catch(_){}
 }
 return {open,close,refresh,tick};
}
