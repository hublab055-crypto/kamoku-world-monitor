/** Browser adapter for named squad formations. Domain logic is in groups.mjs/squad.mjs. */
export function installGroupUI({get,notify,update,onSelect,onSync,onPickRally,onAutoEditor}){
 const $=id=>document.getElementById(id);
 let draftMembers=[],pickerSignature="";
 const context=()=>get(),active=()=>context().squad?.activeGroup();
 function refresh(){
  const {squad}=context();if(!squad)return;
  const groups=squad.groups.all(),picker=$("rts-group-select"),current=active();
  const selected=squad.selectedGroups(),multiple=selected.length>1;
  const signature=JSON.stringify(groups.map(g=>[g.id,g.name,g.members.length]));
  if(signature!==pickerSignature){
   picker.replaceChildren();
   const first=document.createElement("option");first.value="";first.textContent="個別選択";picker.append(first);
   const many=document.createElement("option");many.value="__multi__";many.textContent="☑ 複数部隊";picker.append(many);
   for(const g of groups){
    const option=document.createElement("option");
    option.value=g.id;option.textContent=g.name+" ("+g.members.length+")";picker.append(option);
   }
   const multiRoot=$("rts-group-multi-list");multiRoot.replaceChildren();
   for(const g of groups){
    const row=document.createElement("label");row.className="multi-group-item";
    const checkbox=document.createElement("input");checkbox.type="checkbox";checkbox.value=g.id;
    checkbox.setAttribute("aria-label",g.name+"を同時指揮に追加");
    checkbox.addEventListener("change",()=>{
     const chosen=[...squad.groups.activeIds];
     if(checkbox.checked&&!chosen.includes(g.id))chosen.push(g.id);
     if(!checkbox.checked&&chosen.includes(g.id))chosen.splice(chosen.indexOf(g.id),1);
     const activeGroups=squad.selectGroups(chosen);
     if(activeGroups.length){onSelect(activeGroups[0].members[0]);onSync(activeGroups.every(x=>x.sync));}
     refresh();update();
    });
    const text=document.createElement("span");text.textContent=g.name+" ("+g.members.length+"人)";
    row.append(checkbox,text);multiRoot.append(row);
   }
   pickerSignature=signature;
  }
  const want=multiple?"__multi__":current?.id||"";
  if(picker.value!==want)picker.value=want;
  for(const checkbox of $("rts-group-multi-list").querySelectorAll("input[type=checkbox]"))
   checkbox.checked=squad.groups.activeIds.includes(checkbox.value);
  $("rts-multi-group-summary").textContent=selected.length?
   selected.map(g=>g.name).join("・")+" / 対象"+squad.selected.size+"人":
   "部隊をチェックすると複数選択できます。";
  $("rts-group-assemble").disabled=!selected.length;
  $("rts-multi-assemble").disabled=!selected.length;
  $("rts-multi-form").disabled=!selected.length;
  $("rts-multi-stop").disabled=!selected.length;
  $("rts-follow").disabled=!selected.length;
  const follow=selected.length>0&&selected.every(g=>g.follow);
  $("rts-follow").textContent=follow?"👣 追従ON":"👣 追従OFF";
  $("rts-follow").setAttribute("aria-pressed",String(follow));
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
  $("group-follow").checked=group?.follow??true;
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
   sync:$("group-sync").checked,follow:$("group-follow").checked};
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
  if(e.target.value==="__multi__")return;
  const group=context().squad.selectGroup(e.target.value||null);
  selectedGroup(group);
 });
 $("rts-group-toggle").addEventListener("click",()=>{
  closeMulti();
  open($("group-panel").hidden);
 });
 function closeMulti(){
  $("rts-multi-group-panel").hidden=true;
  $("rts-multi-groups").setAttribute("aria-expanded","false");
 }
 $("rts-multi-groups").addEventListener("click",()=>{
  const show=$("rts-multi-group-panel").hidden;
  $("rts-multi-group-panel").hidden=!show;
  $("rts-multi-groups").setAttribute("aria-expanded",String(show));
  if(show){close();refresh();}
 });
 $("rts-multi-group-close").addEventListener("click",closeMulti);
 $("rts-follow").addEventListener("click",()=>{
  const {squad}=context(),groups=squad.selectedGroups();
  if(!groups.length)return;
  const value=!groups.every(g=>g.follow);
  for(const g of groups)squad.setGroupFollow(g.id,value);
  refresh();if(!$("group-panel").hidden)loadDraft(active());update();
  notify(value?"👣 隊長の移動に合わせて隊形を維持します。":"👣 隊形追従を解除しました。");
 });
 function multiCommand(command){
  const {squad}=context(),groups=squad.selectedGroups();
  if(!groups.length){notify("先に部隊を選択してください。");return;}
  const n=squad.orderGroups(groups.map(g=>g.id),command);
  notify("👥 "+groups.length+"部隊への"+({rally:"集合",form:"整列",stop:"停止"}[command]||command)+"指示："+n+"人");
  update();
 }
 $("rts-multi-assemble").addEventListener("click",()=>multiCommand("rally"));
 $("rts-multi-form").addEventListener("click",()=>multiCommand("form"));
 $("rts-multi-stop").addEventListener("click",()=>multiCommand("stop"));
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
  const {squad}=context(),groups=squad.selectedGroups();
  if(!groups.length){notify("登録部隊を選択してください。");return;}
  const moved=squad.orderGroups(groups.map(g=>g.id),"rally");
  notify(moved?"📣 "+groups.length+"部隊の"+moved+"人が登録隊形で集合します。":"集合できません。地形と集合地点を確認してください。");
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
  const moved=squad.orderGroups([g.id],"form");
  notify("↔ "+g.name+"："+moved+"人に隊形整列を指示しました。");
 });
 return {refresh,loadDraft,close,closeMulti,reset(){
  pickerSignature="";draftMembers=[];close();closeMulti();refresh();
 }};
}
