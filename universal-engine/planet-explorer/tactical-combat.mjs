import {TROOP_ROLES} from "./tactical-roster.mjs";
/** Bounded local RTS battle AI. No damage to the campaign save outside BattleTest. */
export const HOSTILE_PRESETS=Object.freeze({
 raiders:{name:"盗賊小隊",types:{bandit:4,goblin:6},layout:"wedge"},
 warband:{name:"魔物戦団",types:{goblin:8,orc:4,skeleton:4,demon:2},layout:"line"}
});
export function spawnHostileFormation(battle,player,preset="raiders"){
 const spec=HOSTILE_PRESETS[preset];if(!spec)return {ok:false,message:"敵編成が無効です。"};
 const types=Object.entries(spec.types).flatMap(([kind,count])=>Array(count).fill(kind));
 if(battle.count()+types.length>80)return {ok:false,message:"敵軍の上限は80体です。"};
 if(player.altitudeM>12||player.jumpY>.01)return {ok:false,message:"地表に降りてから敵を配置してください。"};
 battle.nextUnitId=(battle.nextUnitId||0)+1;
 const groupId="enemy-unit-"+battle.nextUnitId,memberIds=[];
 const yaw=player.yaw||0,sn=Math.sin(yaw),cs=Math.cos(yaw);
 for(let i=0;i<types.length;i++){
  const item=battle.spawn(player,types[i],{allowLarge:true});
  if(!item.ok)return {ok:false,message:item.message,count:memberIds.length};
  const enemy=item.enemy,columns=Math.min(6,Math.ceil(Math.sqrt(types.length)));
  const col=i%columns,row=Math.floor(i/columns);
  const spread=(col-(columns-1)/2)*2.8;
  const forward=23+row*2.5;
  enemy.x=player.x+sn*forward+cs*spread;
  enemy.z=player.z+cs*forward-sn*spread;
  enemy.yaw=yaw+Math.PI;enemy.unitId=groupId;enemy.unitRole=i<4?"front":"support";
  memberIds.push(enemy.id);
 }
 battle.enemyUnits??=[];
 battle.enemyUnits.push({id:groupId,name:spec.name,members:memberIds,order:"attack"});
 return {ok:true,groupId,count:memberIds.length,message:"👹 "+spec.name+" "+memberIds.length+"体が進軍を開始しました。"};
}
export function nearestAliveAlly(enemy,squad,player,playerHp=100){
 const people=squad?.agents||[];
 let best=player,bestId="player",distance=Math.hypot(enemy.x-player.x,enemy.z-player.z);
 for(const a of people){
  if(a.id==="player"||a.hp<=0||!a.control.nearGround)continue;
  const d=Math.hypot(enemy.x-a.control.x,enemy.z-a.control.z);
  if(d<distance){distance=d;best=a.control;bestId=a.id;}
 }
 return {control:best,id:bestId,distance};
}
export function stepAlliedCombat(battle,squad,dt,{launchArrow=null}={}){
 if(!squad||dt<=0)return;
 const allies=squad.agents;
 // Automatic tactical logic only controls deployed soldiers, not the original player/NPC trio.
 for(const soldier of allies){
  if(!soldier.id.startsWith("troop-")||soldier.hp<=0||
     soldier.task||!soldier.control.nearGround)continue;
  const role=TROOP_ROLES[soldier.role];if(!role||soldier.combatCooldown>0)continue;
  if(soldier.role==="healer"){
   const injured=allies.filter(a=>a.hp>0&&a.hp<a.maxHp&&
    Math.hypot(soldier.control.x-a.control.x,soldier.control.z-a.control.z)<=role.range)
    .sort((a,b)=>(a.hp/a.maxHp)-(b.hp/b.maxHp))[0];
   if(injured){
    const healed=Math.min(role.heal,injured.maxHp-injured.hp);injured.hp+=healed;
    soldier.combatCooldown=role.period;soldier.status="💚 "+injured.name+" +"+healed;
    battle.tacticalEvents.push({kind:"heal",actorId:injured.id,amount:healed});
   }else if(battle.playerHp<100&&Math.hypot(soldier.control.x-squad.get("player").control.x,soldier.control.z-squad.get("player").control.z)<role.range){
    const healed=battle.heal(role.heal);soldier.combatCooldown=role.period;
    battle.tacticalEvents.push({kind:"heal",actorId:"player",amount:healed});
   }
   continue;
  }
  let target=null,best=Infinity;
  for(const enemy of battle.enemies){
   if(enemy.hp<=0)continue;
   const d=Math.hypot(soldier.control.x-enemy.x,soldier.control.z-enemy.z);
   if(d>role.range+enemy.radius||d>=best)continue;
   best=d;target=enemy;
  }
  if(!target)continue;
  soldier.combatCooldown=role.period;
  const targetAngle=Math.atan2(target.x-soldier.control.x,target.z-soldier.control.z);
  soldier.control.yaw=targetAngle;
  soldier.status=role.icon+" "+target.name+"を攻撃";
  if(soldier.role==="archer"&&typeof launchArrow==="function"){
   launchArrow(soldier,target);
  }else{
   const hit=battle.damage(target,role.damage);
   battle.tacticalEvents.push({kind:"damage",actorId:soldier.id,enemyId:target.id,amount:hit.damage});
  }
  if(battle.tacticalEvents.length>80)battle.tacticalEvents.splice(0,battle.tacticalEvents.length-80);
 }
}
