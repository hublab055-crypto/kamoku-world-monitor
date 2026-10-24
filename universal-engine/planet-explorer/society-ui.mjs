import {DESTINATIONS} from "./settlements.mjs?v=0.8y-harbor";
import {SOCIETY_OCCUPATIONS} from "./society-system.mjs?v=0.9l-society";

/** Compact town society desk; no external HTML injection or WebGL dependencies. */
export function installSocietyUI({get,save=()=>{},notify=()=>{}}){
 const $=id=>document.getElementById(id);
 const panel=$("society-panel"),toggle=$("viewport-society");
 const townField=$("society-town"),stats=$("society-stats"),jobs=$("society-jobs");
 const residents=$("society-residents"),status=$("society-status");
 const occupation=$("society-occupation"),capacity=$("society-capacity"),wage=$("society-wage");
 const sector=$("society-sector");
 let selectedTown=null;
 const el=(tag,text="",className="")=>{
  const node=document.createElement(tag);node.textContent=text;
  if(className)node.className=className;return node;
 };
 function message(text){status.textContent=text;}
 for(const t of DESTINATIONS){
  const option=el("option",t.name);option.value=t.id;townField.append(option);
 }
 for(const [id,o] of Object.entries(SOCIETY_OCCUPATIONS)){
  const option=el("option",o.name+(o.public?"（民間求人可）":""));
  option.value=id;occupation.append(option);
 }
 function close(){panel.hidden=true;toggle.setAttribute("aria-expanded","false");}
 function open(){
  const state=get();selectedTown=state.activeSettlementId==="wilderness"?"pioneer":state.activeSettlementId;
  townField.value=selectedTown;
  panel.hidden=false;toggle.setAttribute("aria-expanded","true");render();
 }
 function onChange(out){
  message(out.message);
  if(out.ok){save();notify(out.message);}
  render();
 }
 function currentTown(){return selectedTown||get().activeSettlementId||"pioneer";}
 function render(){
  if(panel.hidden)return;
  const {society}=get(),townId=currentTown(),town=society.town(townId),s=society.stats(townId);
  if(!town||!s)return;
  stats.textContent="人口 "+s.population+" / 世帯 "+s.households+
   " / 就業 "+s.employed+" / 求職 "+s.unemployed+
   " / 空き求人 "+s.vacancies+" / 住居収容 "+s.housingCapacity+
   " / 平均健康 "+s.averageHealth+"/100";
  const school=$("society-school"),clinic=$("society-clinic");
  school.textContent="🏫 学校 "+town.schools+"校 / 教師 "+s.teachers+
   "人 / 在籍 "+s.students+"/"+s.schoolCapacity+"人";
  clinic.textContent="🏥 診療所 "+town.clinics+"施設 / 医療職員 "+s.medics+
   "人 / 対応可能 "+s.clinicCapacity+"人 / 要診療 "+s.patients+"人";
  jobs.replaceChildren();
  const ruler=Boolean(get().territoryEconomy?.ruler(townId));
  for(const j of town.jobs){
   const row=el("div","","society-job-row");
   const name=el("span",SOCIETY_OCCUPATIONS[j.occupation].name+
    " / 日給 "+j.wage+"G / 残 "+society.vacancies(town,j)+"/"+j.capacity+
    " / "+(j.sector==="public"?"公務":"民間"));
   const hire=el("button","NPC採用"),apply=el("button","就職する");
   hire.type=apply.type="button";hire.dataset.action="hire";hire.dataset.job=j.id;
   apply.dataset.action="apply";apply.dataset.job=j.id;
   hire.disabled=apply.disabled=society.vacancies(town,j)===0;
   if(j.ownerId!=="player"&&!(j.sector==="public"&&ruler))hire.disabled=true;
   row.append(name,hire,apply);jobs.append(row);
  }
  const eligible=town.people.filter(p=>p.education<5&&!p.studying);
  const patientList=town.people.filter(p=>p.health<100);
  residents.replaceChildren();
  function picker(labelText,id,people){
   const box=el("label",labelText+" ");
   const field=el("select");field.id=id;
   for(const p of people){
    const opt=el("option",p.id+"（"+p.age+"歳・学力"+p.education+"・健康"+Math.round(p.health)+"）");
    opt.value=p.id;field.append(opt);
   }
   box.append(field);return box;
  }
  residents.append(picker("入学する住民","society-student",eligible),
   picker("診療する住民","society-patient",patientList));
  const buttons=el("div","","society-job-row");
  for(const [label,action,disabled] of [
   ["📖 入学","enroll",!eligible.length||s.schoolCapacity===0||s.students>=s.schoolCapacity],
   ["🩺 診療","treat",!patientList.length||s.clinicCapacity===0]]){
   const b=el("button",label);b.type="button";b.dataset.action=action;b.disabled=disabled;buttons.append(b);
  }
  residents.append(buttons);
  const player=$("society-player");
  const pj=society.playerJob,job=pj?society.job(society.town(pj.townId),pj.jobId):null;
  player.textContent=pj&&job?
   "現職："+society.town(pj.townId).name+" / "+SOCIETY_OCCUPATIONS[job.occupation].name+
    " / 未受領 "+society.playerWagesOwed+"G":
   "未就職 / 未受領 "+society.playerWagesOwed+"G";
  $("society-resign").disabled=!pj;
  $("society-pay").disabled=!society.playerWagesOwed;
  const log=$("society-events");log.replaceChildren();
  for(const entry of town.events.slice(-4).reverse())log.append(el("li",entry));
 }
 toggle.addEventListener("click",()=>panel.hidden?open():close());
 $("society-close").addEventListener("click",close);
 townField.addEventListener("change",()=>{selectedTown=townField.value;render();});
 $("society-post").addEventListener("click",()=>{
  const {society,territoryEconomy}=get();
  onChange(society.postJob(currentTown(),occupation.value,Number(capacity.value),Number(wage.value),
   {sector:sector.value,authorized:Boolean(territoryEconomy?.ruler(currentTown()))}));
 });
 jobs.addEventListener("click",event=>{
  const b=event.target.closest("button[data-action][data-job]");
  if(!b||!jobs.contains(b))return;
  const {society}=get();
  onChange(b.dataset.action==="hire"?society.hireNext(currentTown(),b.dataset.job):
   society.applyPlayer(currentTown(),b.dataset.job));
 });
 residents.addEventListener("click",event=>{
  const b=event.target.closest("button[data-action]");
  if(!b||!residents.contains(b))return;
  const {society}=get(),id=b.dataset.action==="enroll"?$("society-student")?.value:$("society-patient")?.value;
  onChange(b.dataset.action==="enroll"?society.enroll(currentTown(),id):society.treat(currentTown(),id));
 });
 $("society-resign").addEventListener("click",()=>onChange(get().society.resignPlayer()));
 $("society-pay").addEventListener("click",()=>{
  const {society,townLife}=get();
  onChange(society.collectWages(townLife));
 });
 return {open,close,refresh:render};
}
