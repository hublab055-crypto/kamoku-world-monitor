/** Browser adapter for named squad formations. Domain logic is in groups.mjs/squad.mjs. */
export function installGroupUI({get,notify,update,onSelect,onSync,onPickRally,onAutoEditor}){
 const $=id=>document.getElementById(id);
 let draftMembers=[],pickerSignature="";
 const context=()=>get(),active=()=>context().squad?.activeGroup();
 function refresh(){
  const {squad}=context();if(!squad)return;
  const groups=squad.groups.all(),picker=$("rts-group-select"),current=active();
  const signature=JSON.stringify(groups.map(g=>[g.id,g.name,g.members.length]));
  if(signature!==pickerSignature){
   picker.replaceChildren();
   const first=document.createElement("option");first.value="";first.textContent="個別選択";picker.append(first);
   for(const g of groups){
    const option=document.createElement("option");
    option.value=g.id;option.textContent=g.name+" ("+g.members.length+")";picker.append(option);
   }
   pickerSignature=signature;
  }
  if(picker.value!==(current?.id||""))picker.value=current?.id||"";
  $("rts-group-assemble").disabled=!current;
 }
 function drawRoster(){
  const {squad}=context(),root=$("group-members");root.replaceChildren();
  const ordered=[...squad.agents].sort((a,b)=>{
   const ai=draftMembers.indexOf(a.id),bi=draftMembers.indexOf(b.id);
   return (ai<0?999:ai)-(bi<0?999:bi);
  });
  for(const member of ordered){
   const row=document.createElement("div");row.className="group-member";
   const check=document.createElement("input");check.type="checkbox";
   check.checked=draftMembers.includes(member.id);check.setAttribute("aria-label",member.name+"を部隊に登録");
   check.addEventListener("change",()=>{
    if(check.checked&&!draftMembers.includes(member.id))draftMembers.push(member.id);
    if(!check.checked)draftMembers=draftMembers.filter(id=>id!==member.id);
    drawRoster();
   });
   const i=draftMembers.indexOf(member.id);
   const name=document.createElement("span");name.className="group-member-name";
   name.textContent=(i>=0?"第"+(i+1)+"位置 ":"")+member.name;
   row.append(check,name);
   for(const delta of [-1,1]){
    const btn=document.createElement("button");btn.type="button";
    btn.textContent=delta<0?"↑":"↓";btn.title="配置順の変更";
    btn.disabled=i<0||i+delta<0||i+delta>=draftMembers.length;
    btn.addEventListener("click",()=>{
     [draftMembers[i],draftMembers[i+delta]]=[draftMembers[i+delta],draftMembers[i]];
     drawRoster();
    });
    row.append(btn);
   }
   root.append(row);
  }
 }
 function loadDraft(group=active()){
  const {squad}=context();
  if(!squad)return;
  draftMembers=group?[...group.members]:[...squad.selected];
  $("group-name").value=group?.name||"";
  $("group-formation").value=group?.formation||"line";
  $("group-spacing").value=group?.spacing??2.4;
  $("group-sync").checked=group?.sync??false;
  drawRoster();
  for(const id of ["group-update","group-delete","group-rally-here","group-rally-pick","group-form","group-go"])
   $(id).disabled=!group;
  $("group-status").textContent=group?
   group.name+" / "+group.members.length+"人・"+(group.rally?"集合地点登録済み":"集合地点未設定"):
   "現在の選択人物から新規登録できます。";
 }
 function close(){
  $("group-panel").hidden=true;$("rts-group-toggle").setAttribute("aria-expanded","false");
 }
 function open(show){
  $("group-panel").hidden=!show;$("rts-group-toggle").setAttribute("aria-expanded",String(show));
  if(show){onAutoEditor();loadDraft();}
 }
 function formData(){
  return {name:$("group-name").value,members:[...draftMembers],
   formation:$("group-formation").value,spacing:Number($("group-spacing").value),
   sync:$("group-sync").checked};
 }
 function feedback(error){$("group-status").textContent=error.message||String(error);}
 function selectedGroup(group){
  if(group){
   onSelect(group.members[0]);onSync(group.sync);
   notify("👥 "+group.name+"（"+group.members.length+"人）を選択しました。");
  }
  refresh();update();
  if(!$("group-panel").hidden)loadDraft(group);
 }
 $("rts-group-select").addEventListener("change",e=>{
  const group=context().squad.selectGroup(e.target.value||null);
  selectedGroup(group);
 });
 $("rts-group-toggle").addEventListener("click",()=>open($("group-panel").hidden));
 $("group-close").addEventListener("click",close);
 $("group-new").addEventListener("click",()=>{
  try{
   const {squad}=context(),draft=formData();
   selectedGroup(squad.registerGroup(draft.name,draft.members,draft));
   notify("👥 登録しました。ゲームの保存ボタンで記録できます。");
  }catch(e){feedback(e);}
 });
 $("group-update").addEventListener("click",()=>{
  const {squad}=context(),group=active();if(!group)return;
  try{
   selectedGroup(squad.updateGroup(group.id,formData()));
   notify("👥 部隊のメンバー・隊形・シンクロ設定を更新しました。");
  }catch(e){feedback(e);}
 });
 $("group-delete").addEventListener("click",()=>{
  const {squad}=context(),g=active();if(!g)return;
  if(!window.confirm("部隊「"+g.name+"」の登録を削除しますか？"))return;
  squad.removeGroup(g.id);refresh();loadDraft(null);update();notify("👥 "+g.name+"を削除しました。");
 });
 function assemble(){
  const {squad}=context(),g=active();
  if(!g){notify("登録部隊を選択してください。");return;}
  const moved=squad.rallyGroup(g.id);
  notify(moved?"📣 "+g.name+"の"+moved+"人が登録隊形で集合します。":"集合できません。地形と集合地点を確認してください。");
 }
 $("rts-group-assemble").addEventListener("click",assemble);
 $("group-go").addEventListener("click",assemble);
 $("group-rally-here").addEventListener("click",()=>{
  const {squad,controller}=context(),g=active();if(!g)return;
  squad.setGroupRally(g.id,controller.x,controller.z);
  loadDraft(active());notify("📍 "+g.name+"の集合地点を現在地に保存しました。");
 });
 $("group-rally-pick").addEventListener("click",()=>{
  if(!active())return;
  onPickRally();close();
  notify("🎯 地面をタップして部隊の集合地点を登録してください。");
 });
 $("group-form").addEventListener("click",()=>{
  const {squad}=context(),g=active();if(!g)return;
  const people=g.members.map(id=>squad.get(id)).filter(Boolean);
  const x=people.reduce((n,a)=>n+a.control.x,0)/people.length;
  const z=people.reduce((n,a)=>n+a.control.z,0)/people.length;
  const moved=squad.orderMove(g.members,x,z,{formation:g.formation,spacing:g.spacing});
  notify("↔ "+g.name+"："+moved+"人に隊形整列を指示しました。");
 });
 return {refresh,loadDraft,close,reset(){
  pickerSignature="";draftMembers=[];close();refresh();
 }};
}
