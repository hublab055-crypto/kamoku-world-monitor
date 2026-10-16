/** Local battle sandbox. Enemies are test dummies that approach without
 * damaging the player's campaign state. Coordinates use explorer X/Z metres.
 */
export const TEST_ENEMIES=Object.freeze({
 slime:Object.freeze({name:"スライム",hp:30,radius:.72,speed:.72}),
 goblin:Object.freeze({name:"ゴブリン",hp:45,radius:.60,speed:1.15}),
 bandit:Object.freeze({name:"盗賊",hp:65,radius:.65,speed:1.38})
});
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
export class BattleTest{
 constructor(){
  this.enemies=[];this.nextId=1;this.maxEnemies=10;
  this.lastAttack=null;this.hitStages=new Set();
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
   x,z,yaw:wrap(yaw+Math.PI),radius:config.radius,
   hp:config.hp,maxHp:config.hp,speed:config.speed};
  this.enemies.push(enemy);
  return {ok:true,enemy,message:"👾 "+config.name+"が前方に出現しました（HP "+config.hp+"）。"};
 }
 advance(dt,player){
  if(!Number.isFinite(dt)||dt<0)throw TypeError("Invalid battle timestep");
  if(!player)return;
  const step=clamp(dt,0,.1);
  for(const e of this.enemies){
   if(e.hp<=0)continue;
   const dx=player.x-e.x,dz=player.z-e.z,d=Math.hypot(dx,dz);
   if(d<.001)continue;
   e.yaw=Math.atan2(dx,dz);
   // Slow pursuit creates a moving target, but no damage to the player yet.
   if(d>2.45){
    const travel=Math.min(d-2.45,e.speed*step);
    e.x+=dx/d*travel;e.z+=dz/d*travel;
   }
  }
 }
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
 hitArrow(player,{range=18,damage=22}={}){
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
  return target?[this.damage(target,damage)]:[];
 }
 damage(enemy,points){
  enemy.hp=Math.max(0,enemy.hp-points);
  return {id:enemy.id,type:enemy.type,name:enemy.name,hp:enemy.hp,
   damage:points,defeated:enemy.hp===0,
   message:enemy.name+" に "+points+" ダメージ"+(enemy.hp===0?"！撃破！":"（残りHP "+enemy.hp+"）")};
 }
 /** Apply impacts once at the visual strike/release phase (never per frame). */
 resolveAttack(active,player){
  if(!active||!player||!["sword","axe","bow"].includes(active.kind))return [];
  if(this.lastAttack!==active){this.lastAttack=active;this.hitStages=new Set();}
  const t=active.time/active.duration,variant=active.variant||"overhead";
  const isCombo=variant==="combo"&&active.kind!=="bow";
  const thresholds=isCombo?(active.kind==="axe"?[.34,.81]:[.22,.55,.88]):
   [active.kind==="bow"?.81:.62];
  let results=[];
  thresholds.forEach((threshold,i)=>{
   if(t<threshold||this.hitStages.has(i))return;
   this.hitStages.add(i);
   if(active.kind==="bow"){results.push(...this.hitArrow(player));return;}
   const style=isCombo?(active.kind==="axe"?["overhead","sweep"][i]:
     ["overhead","sweep","thrust"][i]):variant;
   const wide=style==="sweep",thrust=style==="thrust";
   results.push(...this.hitArc(player,{
    range:thrust?3.25:wide?3.0:active.kind==="axe"?2.6:2.5,
    arc:thrust?Math.PI/4:wide?Math.PI*1.10:Math.PI*.65,
    damage:active.kind==="axe"?22:thrust?19:18
   }));
  });
  return results;
 }
 count(){return this.enemies.filter(e=>e.hp>0).length;}
 clear(){this.enemies=[];this.lastAttack=null;this.hitStages.clear();}
}
