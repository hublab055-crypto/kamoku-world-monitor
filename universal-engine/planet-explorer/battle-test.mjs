/** Local battle sandbox. Enemies are test dummies that approach without
 * damaging the player's campaign state. Coordinates use explorer X/Z metres.
 */
export const TEST_ENEMIES=Object.freeze({
 slime:Object.freeze({name:"スライム",hp:30,radius:.72,speed:.72,height:1.22}),
 goblin:Object.freeze({name:"ゴブリン",hp:45,radius:.60,speed:1.15,height:1.93}),
 bandit:Object.freeze({name:"盗賊",hp:65,radius:.65,speed:1.38,height:2.10}),
 skeleton:Object.freeze({name:"骸骨兵",hp:50,radius:.52,speed:1.20,height:2.25}),
 orc:Object.freeze({name:"オーク戦士",hp:110,radius:.84,speed:.85,height:2.55}),
 lizardman:Object.freeze({name:"リザードマン",hp:80,radius:.67,speed:1.35,height:2.32}),
 demon:Object.freeze({name:"魔族剣士",hp:140,radius:.70,speed:1.52,height:2.60})
});
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
export class BattleTest{
 constructor(){
  this.enemies=[];this.nextId=1;this.maxEnemies=10;
  this.lastAttack=null;this.hitStages=new Set();
  this.playerHp=100;this.enemyHits=[];this.playerGuard=0;this.playerGuardFactor=.30;this.targetId=null;
 }
 spawn(controller,type="slime"){
  const config=TEST_ENEMIES[type];
  if(!config)return {ok:false,message:"敵の種類が無効です。"};
  if(!controller||controller.altitudeM>12||controller.jumpY>.01)
   return {ok:false,message:"地表に降りてから敵を出現させてください。"};
  if(this.enemies.filter(e=>e.hp>0).length>=this.maxEnemies)
   return {ok:false,message:"テスト敵は最大10体です。倒してから追加してください。"};
  const yaw=Number.isFinite(controller.yaw)?controller.yaw:0;
  const side=(this.nextId%3-1)*1.8,front=5.8+this.nextId%3;
  const x=controller.x+Math.sin(yaw)*front+Math.cos(yaw)*side;
  const z=controller.z+Math.cos(yaw)*front-Math.sin(yaw)*side;
  const enemy={id:this.nextId++,type,name:config.name,
   x,z,yaw:wrap(yaw+Math.PI),radius:config.radius,height:config.height,
   hp:config.hp,maxHp:config.hp,speed:config.speed,walkPhase:0,
   anim:"idle",animTime:0,attackCooldown:.6,guardCooldown:0,
   attackLanded:false,deathTime:0,lastHit:0};
  this.enemies.push(enemy);
  return {ok:true,enemy,message:"👾 "+config.name+"が前方に出現しました（HP "+config.hp+"）。"};
 }
 /** Animated approach, attack, guard, hit and death in isolated battle sandbox. */
 advance(dt,player,playerAction=null){
  if(!Number.isFinite(dt)||dt<0)throw TypeError("Invalid battle timestep");
  if(!player)return;
  const step=clamp(dt,0,.1);
  this.playerGuard=Math.max(0,this.playerGuard-step);
  for(const e of this.enemies){
   if(e.hp<=0){e.anim="death";e.deathTime=(e.deathTime||0)+step;continue;}
   e.animTime=(e.animTime||0)+step;
   e.attackCooldown=Math.max(0,(e.attackCooldown||0)-step);
   e.guardCooldown=Math.max(0,(e.guardCooldown||0)-step);
   const dx=player.x-e.x,dz=player.z-e.z,d=Math.hypot(dx,dz);
   if(d>.001)e.yaw=Math.atan2(dx,dz);
   if(e.anim==="hit"){
    if(e.animTime<.34)continue;
    e.anim="idle";e.animTime=0;
   }
   if(e.anim==="guard"){
    if(e.animTime<.52)continue;
    e.anim="idle";e.animTime=0;
   }
   if(e.anim==="attack"){
    // Damage only on the animated weapon's impact; never every frame.
    if(e.animTime>=.52&&!e.attackLanded){
     e.attackLanded=true;
     if(d<3.0&&this.playerHp>0){
      const points=e.type==="orc"?12:e.type==="demon"?14:e.type==="skeleton"?7:8;
      const dealt=this.playerGuard>0?Math.max(1,Math.round(points*this.playerGuardFactor)):points;
      this.playerHp=Math.max(0,this.playerHp-dealt);
      this.enemyHits.push({name:e.name,damage:dealt,hp:this.playerHp,
       message:e.name+" の攻撃：-"+dealt+" HP"+(this.playerGuard>0?"（ガード）":"")+"（戦闘テストHP "+this.playerHp+"）"});
     }
    }
    if(e.animTime<1.03)continue;
    e.anim="idle";e.animTime=0;e.attackCooldown=1.35;
   }
   const incoming=playerAction&&["sword","spear","greatsword","axe"].includes(playerAction.kind)&&
    playerAction.time/playerAction.duration<.47&&playerAction.time/playerAction.duration>.09;
   const facingPlayer=Math.abs(wrap(Math.atan2(e.x-player.x,e.z-player.z)-(player.yaw||0)))<1.25;
   if(incoming&&facingPlayer&&d<3.7&&e.guardCooldown===0&&e.type!=="slime"){
    e.anim="guard";e.animTime=0;e.guardCooldown=2.2;
    continue;
   }
   if(d>2.45){
    const travel=Math.min(d-2.45,e.speed*step);
    e.x+=dx/(d||1)*travel;e.z+=dz/(d||1)*travel;
    e.walkPhase=(e.walkPhase||0)+travel*6.5;
    if(e.anim!=="walk"){e.anim="walk";e.animTime=0;}
   }else if(e.attackCooldown===0&&this.playerHp>0){
    e.anim="attack";e.animTime=0;e.attackLanded=false;
   }else if(e.anim!=="idle"){
    e.anim="idle";e.animTime=0;
   }
  }
 }
 consumeEnemyHits(){return this.enemyHits.splice(0);}

 hitArc(player,{range=2.5,arc=Math.PI*.9,damage=18}={}){
  const results=[],yaw=player.yaw||0;
  for(const e of this.enemies){
   if(e.hp<=0)continue;
   const dx=e.x-player.x,dz=e.z-player.z,d=Math.hypot(dx,dz);
   if(d>range+e.radius)continue;
   if(Math.abs(wrap(Math.atan2(dx,dz)-yaw))>arc/2)continue;
   results.push(this.damage(e,damage));
  }
  return results;
 }
 hitArrow(player,{range=18,damage=22,targetId=this.targetId}={}){
  const yaw=player.yaw||0,fx=Math.sin(yaw),fz=Math.cos(yaw);
  let target=null,best=Infinity;
  for(const e of this.enemies){
   if(e.hp<=0)continue;
   const dx=e.x-player.x,dz=e.z-player.z;
   const forward=dx*fx+dz*fz;
   const side=Math.abs(dx*fz-dz*fx);
   if(forward<.2||forward>range+e.radius||side>e.radius+.22)continue;
   if(forward<best){best=forward;target=e;}
  }
  const aimed=this.enemies.find(e=>e.id===targetId&&e.hp>0);
  if(aimed){
   const dx=aimed.x-player.x,dz=aimed.z-player.z,forward=dx*fx+dz*fz;
   const side=Math.abs(dx*fz-dz*fx);
   if(forward>.2&&forward<range+aimed.radius&&side<aimed.radius+.22)target=aimed;
  }
  return target?[this.damage(target,damage)]:[];
 }
 damage(enemy,points){
  if(enemy.hp<=0)return {id:enemy.id,type:enemy.type,name:enemy.name,hp:0,damage:0,defeated:true,message:enemy.name+" は既に撃破されています"};
  const guarded=enemy.anim==="guard"&&enemy.animTime<.52;
  const dealt=guarded?Math.max(1,Math.round(points*.45)):points;
  enemy.hp=Math.max(0,enemy.hp-dealt);
  enemy.lastHit=dealt;enemy.anim=enemy.hp===0?"death":"hit";
  enemy.animTime=0;enemy.deathTime=0;enemy.attackLanded=false;
  return {id:enemy.id,type:enemy.type,name:enemy.name,hp:enemy.hp,
   damage:dealt,guarded,defeated:enemy.hp===0,
   message:enemy.name+" に "+dealt+" ダメージ"+(guarded?"（防御）":"")+(enemy.hp===0?"！撃破！":"（残りHP "+enemy.hp+"）")};
 }
 /** Resolve a single swing for either the player or an RTS-controlled ally.
  * Shared hit rules prevent the NPC simulation from having different reach. */
 hitWeapon(player,kind,style="overhead"){
  if(!["sword","spear","greatsword","axe"].includes(kind))return [];
  const wide=style==="sweep",thrust=style==="thrust";
  const spear=kind==="spear",greatsword=kind==="greatsword";
  return this.hitArc(player,{
   range:spear?(thrust?4.7:wide?3.5:3.8):
    greatsword?(thrust?3.5:wide?3.6:3.25):
    thrust?3.25:wide?3.0:kind==="axe"?2.6:2.5,
   arc:thrust?Math.PI/(spear?5:4):wide?Math.PI*(spear?.80:1.10):Math.PI*.65,
   damage:spear?(thrust?27:wide?16:22):
    greatsword?(thrust?23:wide?31:34):
    kind==="axe"?22:thrust?19:18
  });
 }
 /** Apply impacts once at the visual strike/release phase (never per frame). */
 resolveAttack(active,player){
  if(!active||!player||!["sword","spear","greatsword","axe","bow"].includes(active.kind))return [];
  if(this.lastAttack!==active){this.lastAttack=active;this.hitStages=new Set();}
  const t=active.time/active.duration,variant=active.variant||"overhead";
  const isCombo=variant==="combo"&&active.kind!=="bow";
  const twoHit=["spear","greatsword","axe"].includes(active.kind);
  const thresholds=isCombo?(twoHit?[.34,.81]:[.22,.55,.88]):
   [active.kind==="bow"?.81:.62];
  let results=[];
  thresholds.forEach((threshold,i)=>{
   if(t<threshold||this.hitStages.has(i))return;
   this.hitStages.add(i);
   if(active.kind==="bow"){results.push(...this.hitArrow(player));return;}
   const style=isCombo?(active.kind==="axe"?["overhead","sweep"][i]:
     active.kind==="spear"?["sweep","thrust"][i]:
     active.kind==="greatsword"?["overhead","sweep"][i]:
     ["overhead","sweep","thrust"][i]):variant;
   results.push(...this.hitWeapon(player,active.kind,style));
  });
  return results;
 }
 guard(seconds=1.25,factor=.30){this.playerGuard=Math.max(this.playerGuard,Math.min(5,Math.max(0,seconds)));this.playerGuardFactor=clamp(factor,.1,1);return true;}
 heal(amount=35){const prev=this.playerHp;this.playerHp=clamp(this.playerHp+amount,0,100);return this.playerHp-prev;}
 count(){return this.enemies.filter(e=>e.hp>0).length;}
 clear(){
  this.enemies=[];this.lastAttack=null;this.hitStages.clear();
  this.playerHp=100;this.enemyHits=[];this.playerGuard=0;this.playerGuardFactor=.30;this.targetId=null;
 }
}
