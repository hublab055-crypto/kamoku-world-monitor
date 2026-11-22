/** Saved named avatar groups and deterministic, direction-relative formations.
 * No DOM, networking, or executable user scripts; compatible with older saves. */
export const FORMATIONS=Object.freeze({
 line:"横隊",column:"縦隊",wedge:"楔形",square:"方陣",battleline:"前衛・後衛"
});
const validPoint=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.z)&&
 Math.abs(p.x)<1e7&&Math.abs(p.z)<1e7;
const cloneGroup=g=>({...g,members:[...g.members],rally:g.rally?{...g.rally}:null});
const cleanName=name=>{
 const value=typeof name==="string"?name.trim():"";
 if(!value||value.length>24)throw RangeError("部隊名は1〜24文字にしてください");
 return value;
};
const cleanMembers=(ids,available)=>{
 if(!Array.isArray(ids)||ids.length<1||ids.length>64)throw RangeError("部隊には1〜64人を指定してください");
 const members=[...new Set(ids)];
 if(members.length!==ids.length||members.some(id=>typeof id!=="string"||!available.includes(id)))
  throw RangeError("部隊のメンバーが不正です");
 return members;
};
const cleanFormation=value=>{
 if(!Object.hasOwn(FORMATIONS,value))throw RangeError("未対応の隊形");
 return value;
};
const cleanSpacing=value=>{
 if(!Number.isFinite(value)||value<1.2||value>8)throw RangeError("隊員間隔は1.2〜8m");
 return value;
};
const cleanRally=value=>{
 if(value===null)return null;
 if(!validPoint(value))throw RangeError("集合地点が不正です");
 return {x:value.x,z:value.z};
};
/** x = marching direction's right; z = forward. First member is the leader. */
export function formationOffsets(count,formation="line",spacing=2.4){
 if(!Number.isInteger(count)||count<0||count>64)throw RangeError("Invalid group size");
 cleanFormation(formation);cleanSpacing(spacing);
 if(!count)return [];
 if(formation==="line")
  return Array.from({length:count},(_,i)=>({x:(i-(count-1)/2)*spacing,z:0}));
 if(formation==="column")
  return Array.from({length:count},(_,i)=>({x:0,z:((count-1)/2-i)*spacing}));
 if(formation==="square"||formation==="battleline"){
  const cols=Math.ceil(Math.sqrt(count)),rows=Math.ceil(count/cols);
  return Array.from({length:count},(_,i)=>({
   x:((i%cols)-(cols-1)/2)*spacing,
   z:((rows-1)/2-Math.floor(i/cols))*spacing
  }));
 }
 // Wedge: leader on point, alternating wings behind. Center the footprint.
 const positions=Array.from({length:count},(_,i)=>{
  if(!i)return {x:0,z:0};
  const rank=Math.ceil(i/2);
  return {x:(i%2?-1:1)*rank*spacing,z:-rank*spacing};
 });
 const mean=positions.reduce((sum,p)=>sum+p.z,0)/count;
 return positions.map(p=>({x:p.x,z:p.z-mean}));
}
export class GroupRegistry{
 constructor(knownIds,save=null){
  this.knownIds=knownIds;
  this.entries=[];this.nextId=1;this.activeId=null;this.activeIds=[];
  if(save)this.restore(save);
 }
 all(){return this.entries.map(cloneGroup);}
 get(id){return this.entries.find(g=>g.id===id)||null;}
 active(){return this.activeIds.length===1?this.get(this.activeIds[0]):null;}
 selected(){return this.activeIds.map(id=>this.get(id)).filter(Boolean).map(cloneGroup);}
 normalize(raw,previous=null){
  const base=previous||{};
  const members=cleanMembers(raw.members??base.members,this.knownIds());
  const name=cleanName(raw.name??base.name);
  const formation=cleanFormation(raw.formation??base.formation??"line");
  const spacing=cleanSpacing(raw.spacing??base.spacing??2.4);
  const rally=cleanRally(raw.rally===undefined?base.rally??null:raw.rally);
  const sync=raw.sync===undefined?(base.sync??false):raw.sync;
  const follow=raw.follow===undefined?(base.follow??false):raw.follow;
  if(typeof sync!=="boolean"||typeof follow!=="boolean")throw TypeError("部隊の同期・追従設定が不正です");
  const duplicate=this.entries.find(g=>g.id!==previous?.id&&g.name===name);
  if(duplicate)throw RangeError("同じ名前の部隊が登録済みです");
  return {id:previous?.id||"g"+this.nextId,name,members,formation,spacing,sync,follow,rally};
 }
 create(raw){
  if(this.entries.length>=32)throw RangeError("登録部隊は32個までです");
  const group=this.normalize(raw);this.nextId++;
  this.entries.push(group);this.activeId=group.id;this.activeIds=[group.id];
  return cloneGroup(group);
 }
 update(id,patch){
  const previous=this.get(id);
  if(!previous)throw RangeError("部隊が見つかりません");
  const next=this.normalize(patch,previous);
  Object.assign(previous,next);return cloneGroup(previous);
 }
 remove(id){
  const index=this.entries.findIndex(g=>g.id===id);
  if(index<0)return false;
  this.entries.splice(index,1);
  this.activeIds=this.activeIds.filter(key=>key!==id);
  this.activeId=this.activeIds.length===1?this.activeIds[0]:null;
  return true;
 }
 activate(id){
  if(id===null||id===""){this.activeId=null;this.activeIds=[];return null;}
  const group=this.get(id);
  if(!group)return null;
  this.activeId=id;this.activeIds=[id];return cloneGroup(group);
 }
 activateMany(ids){
  if(!Array.isArray(ids)||ids.length>32)throw RangeError("複数部隊指定が不正です");
  const keys=[...new Set(ids)];
  if(keys.length!==ids.length||keys.some(id=>!this.get(id)))throw RangeError("存在しない部隊が含まれています");
  this.activeIds=keys;this.activeId=keys.length===1?keys[0]:null;
  return this.selected();
 }
 snapshot(){
  return {version:1,nextId:this.nextId,activeId:this.activeId,activeIds:[...this.activeIds],entries:this.all()};
 }
 restore(save){
  if(save?.version!==1||!Array.isArray(save.entries))return false;
  this.entries=[];this.nextId=1;this.activeId=null;this.activeIds=[];
  for(const raw of save.entries.slice(0,32)){
   if(!/^g[1-9][0-9]*$/.test(raw?.id||"")||this.get(raw.id))continue;
   try{
    const g=this.normalize(raw);
    g.id=raw.id;this.entries.push(g);
    this.nextId=Math.max(this.nextId,Number(raw.id.slice(1))+1);
   }catch(_){/* Ignore a corrupted group, not the entire game save. */}
  }
  if(Number.isSafeInteger(save.nextId)&&save.nextId>this.nextId)this.nextId=save.nextId;
  const selected=Array.isArray(save.activeIds)?save.activeIds:[save.activeId];
  const valid=selected.filter((id,i)=>this.get(id)&&selected.indexOf(id)===i);
  this.activateMany(valid);
  return true;
 }
}
