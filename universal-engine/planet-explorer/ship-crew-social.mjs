/** Ship-only crew relationship model. Save with ShipInterior snapshot; never store a global romance flag. */
export const CREW_RELATIONSHIP_LEVELS=Object.freeze([
 {id:"comrade",label:"仲間",minimum:0},
 {id:"friend",label:"友人",minimum:20},
 {id:"bestFriend",label:"親友",minimum:75},
 {id:"lover",label:"恋人",minimum:150},
 {id:"family",label:"家族",minimum:280}
]);
const CREW_ACTIONS=Object.freeze({
 talk:{points:3,seconds:9,label:"会話"},chat:{points:7,seconds:28,label:"雑談"},
 gift:{points:15,seconds:60,label:"プレゼント"}
});
const clamp=n=>Math.max(0,Math.min(500,Number.isFinite(n)?n:0));
export class ShipCrewSocial {
 constructor(saved={}){
  this.clock=Number.isFinite(saved?.clock)?Math.max(0,saved.clock):0;
  this.members={};
  // Session-only NPC consent; a save/load or timeout revokes it automatically.
  this.casualOffers=new Map();
  for(const id of ["navigator","engineer","companion"]){
   const v=saved?.members?.[id]||{};
   this.members[id]={points:clamp(v.points),romance:Boolean(v.romance),family:Boolean(v.family),
    last:Object.fromEntries(Object.keys(CREW_ACTIONS).map(action=>[action,Number.isFinite(v.last?.[action])?v.last[action]:-1e9]))};
  }
 }
 advance(dt){
  if(Number.isFinite(dt)&&dt>0)this.clock+=Math.min(dt,.16);
  for(const [id,until] of this.casualOffers)if(until<this.clock)this.casualOffers.delete(id);
 }
 status(id){
  const s=this.members[id];if(!s)return null;
  let level=CREW_RELATIONSHIP_LEVELS[0];
  if(s.points>=280&&s.family)level=CREW_RELATIONSHIP_LEVELS[4];
  else if(s.points>=150&&s.romance)level=CREW_RELATIONSHIP_LEVELS[3];
  else if(s.points>=75)level=CREW_RELATIONSHIP_LEVELS[2];
  else if(s.points>=20)level=CREW_RELATIONSHIP_LEVELS[1];
  return {id:level.id,label:level.label,points:s.points,romance:s.romance,family:s.family,
   casualConsent:(this.casualOffers.get(id)??-Infinity)>=this.clock};
 }
 interact(id,action,{hasGift=false}={}){
  const member=this.members[id],spec=CREW_ACTIONS[action];
  if(!member||!spec)return {ok:false,message:"乗員または行動が不明です"};
  if(action==="gift"&&!hasGift)return {ok:false,message:"プレゼントに使える所持品がありません"};
  const left=spec.seconds-(this.clock-member.last[action]);
  if(left>0)return {ok:false,message:"もう少し時間を空けてから"+spec.label+"しましょう（"+Math.ceil(left)+"秒）"};
  member.last[action]=this.clock;
  member.points=clamp(member.points+spec.points);
  const status=this.status(id);
  return {ok:true,spentGift:action==="gift",status,message:spec.label+"をしました。親密度 +"+spec.points+"（"+status.points+" / "+status.label+"）"};
 }
 deepen(id,kind){
  const s=this.members[id];if(!s)return {ok:false,message:"乗員が見つかりません"};
  if(kind==="casual"){
   if(s.points<75)return {ok:false,message:"相手はまだ親密な誘いに同意していません。信頼関係を築いてください"};
   this.casualOffers.set(id,this.clock+180);
   return {ok:true,message:"相手から、この場限りのプライベートな交流について同意を得ました（3分間有効）"};
  }
  if(kind==="romance"&&s.points>=150&&!s.romance){s.romance=true;return {ok:true,message:"お互いの意思を確認して恋人になりました"};}
  if(kind==="family"&&s.points>=280&&s.romance&&!s.family){s.family=true;return {ok:true,message:"家族としての絆を結びました"};}
  return {ok:false,message:"今の親密度・関係では選択できません"};
 }
 consumeCasualConsent(id){
  const agreed=(this.casualOffers.get(id)??-Infinity)>=this.clock;
  this.casualOffers.delete(id);
  return agreed;
 }
 snapshot(){
  return {version:1,clock:this.clock,members:Object.fromEntries(Object.entries(this.members).map(([id,s])=>
   [id,{points:s.points,romance:s.romance,family:s.family,last:{...s.last}}]))};
 }
}
