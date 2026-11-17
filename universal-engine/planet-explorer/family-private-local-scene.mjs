/**
 * Local-only, camera-retaining, non-graphic pair-motion controller.
 * The FamilyLife consent/eligibility gate authorizes an ephemeral scene.
 * This module intentionally contains NO explicit animations, private imagery,
 * identity persistence or network transports.
 */
export const LOCAL_PRIVATE_GESTURES=Object.freeze([
 Object.freeze({id:"handhold",label:"手をつなぐ",key:"1"}),
 Object.freeze({id:"hug",label:"ハグ",key:"2"}),
 Object.freeze({id:"kiss",label:"キス",key:"3"})
]);

const validGesture=id=>LOCAL_PRIVATE_GESTURES.some(entry=>entry.id===id);
export class LocalPrivateScene {
 constructor({play=()=>({ok:false,message:"モーションがありません"}),guard=()=>false}={}){
  this.play=play;
  this.guard=guard;
  this.partner=null;
  this.active=false;
  this.lastMotion=null;
 }
 open(event){
  const detail=event?.modEvent;
  if(event?.fadeToBlack!==false||event?.cameraTransition!=="retain"||
   detail?.version!==1||detail?.renderContent!=="external-only"||
   detail?.adults!==true||detail?.consent!==true||
   typeof detail?.partner!=="string"||!this.guard(detail.partner)){
   this.close();
   return {ok:false,message:"成人確認・合意・距離・MOD連携を確認してください"};
  }
  this.partner=detail.partner;
  this.active=true;
  this.lastMotion=null;
  return {ok:true,message:"ローカル操作を開始しました。暗転なし・非露骨モーションのみ"};
 }
 playMotion(id){
  if(!this.active)return {ok:false,message:"ローカル操作は開始されていません"};
  if(!this.guard(this.partner)){
   this.close();
   return {ok:false,message:"条件が変わったため、ローカル操作を終了しました"};
  }
  if(!validGesture(id))return {ok:false,message:"対応していないモーションです"};
  const result=this.play(id,this.partner)??{ok:false,message:"モーションを実行できません"};
  if(result.ok)this.lastMotion=id;
  return result;
 }
 replay(){
  return this.lastMotion?this.playMotion(this.lastMotion):
   {ok:false,message:"再生するモーションを選択してください"};
 }
 close(){
  this.active=false;
  this.partner=null;
  this.lastMotion=null;
  return {ok:true,message:"ローカル操作を終了しました"};
 }
}
