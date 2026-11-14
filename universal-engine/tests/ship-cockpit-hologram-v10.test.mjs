import test from "node:test";
import assert from "node:assert/strict";
import {COCKPIT_LEVER,COCKPIT_STICK,COCKPIT_HOLOGRAM_CONTROLS,xrCockpitControlHit} from "../planet-explorer/ship-control-hit.mjs";
import {COCKPIT_HOLOGRAM_ACTIONS,applyCockpitHologramAction} from "../planet-explorer/ship-cockpit-hologram.mjs";

function fixture(){
 const voyage={
  seated:true,throttle:.5,fuel:60,warpEngaged:false,autopilot:true,status:"atmosphere",
  gearMode:"auto",horizon:false,autoFire:false,shipSystems:null,
  setThrottle(value){this.throttle=value;},
  setAutopilot(value){this.autopilot=value;},
  cycleGear(){this.gearMode="down";}
 };
 const combat={
  weapon:"pulse",config:{name:"パルス砲"},fireControl:false,autoFire:false,
  parts:{engine:75,hull:100,weapons:100,shield:100},
  player:{hp:100,maxHp:100,shield:40,maxShield:100},
  supplies:{fuel:2,kits:6},elapsed:30,lastHit:0,
  repairPart(key){this.supplies.kits--;this.parts[key]=100;return {ok:true,message:"修理済み"};},
  refuel(v){this.supplies.fuel--;v.fuel+=35;return {ok:true,message:"補給済み"};},
  systemSnapshot(){return {parts:{...this.parts},supplies:{...this.supplies}};}
 };
 return {voyage,combat};
}
test("throttle is left, control stick right, both holograms share unique touch IDs",()=>{
 assert.ok(COCKPIT_LEVER[0]<0);
 assert.ok(COCKPIT_STICK[0]>0);
 assert.equal(COCKPIT_HOLOGRAM_CONTROLS.length,12);
 assert.equal(new Set(COCKPIT_HOLOGRAM_CONTROLS.map(control=>control.id)).size,12);
 assert.deepEqual(
  COCKPIT_HOLOGRAM_CONTROLS.map(control=>control.id),
  COCKPIT_HOLOGRAM_ACTIONS.map(action=>action.id)
 );
});
test("Quest ray finds each hologram at its real 3D position",()=>{
 for(const target of COCKPIT_HOLOGRAM_CONTROLS){
  const [x,y,z]=target.position;
  const controller=[1,0,0,0,0,1,0,0,0,0,1,0,x,y,z+.45,1];
  const stage=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
  const picked=xrCockpitControlHit(controller,stage);
  assert.equal(picked?.id,target.id);
 }
});
test("left panel controls speed, lock and fire without forcing a warp",()=>{
 const {voyage,combat}=fixture();
 assert.equal(applyCockpitHologramAction("speed-down",{voyage,combat}).ok,true);
 assert.ok(Math.abs(voyage.throttle-.4)<1e-9);
 assert.equal(voyage.autopilot,false);
 assert.equal(applyCockpitHologramAction("auto-lock",{voyage,combat}).ok,true);
 assert.equal(combat.fireControl,true);
 assert.equal(applyCockpitHologramAction("auto-fire",{voyage,combat}).ok,true);
 assert.equal(combat.autoFire,true);
 assert.equal(voyage.autoFire,true);
 voyage.warpEngaged=true;
 assert.equal(applyCockpitHologramAction("speed-up",{voyage,combat}).ok,false);
});
test("repair, fuel and shield actions consume existing supplies",()=>{
 const {voyage,combat}=fixture();
 assert.equal(applyCockpitHologramAction("repair",{voyage,combat}).ok,true);
 assert.equal(combat.parts.engine,100);
 assert.equal(combat.supplies.kits,5);
 assert.equal(applyCockpitHologramAction("fuel",{voyage,combat}).ok,true);
 assert.equal(voyage.fuel,95);
 assert.equal(combat.supplies.fuel,1);
 assert.equal(applyCockpitHologramAction("shield",{voyage,combat}).ok,true);
 assert.equal(combat.player.shield,75);
 assert.equal(combat.supplies.kits,3);
});
test("shield restoration is blocked during recent damage and cannot exceed maximum",()=>{
 const {voyage,combat}=fixture();
 combat.elapsed=4;
 assert.equal(applyCockpitHologramAction("shield",{voyage,combat}).ok,false);
 assert.equal(combat.supplies.kits,6);
 combat.elapsed=20;combat.player.shield=90;
 assert.equal(applyCockpitHologramAction("shield",{voyage,combat}).ok,true);
 assert.equal(combat.player.shield,100);
});
test("landing gear uses its existing control and seated permission is enforced",()=>{
 const {voyage,combat}=fixture();
 assert.equal(applyCockpitHologramAction("gear",{voyage,combat}).ok,true);
 assert.equal(voyage.gearMode,"down");
 voyage.seated=false;
 assert.equal(applyCockpitHologramAction("fuel",{voyage,combat}).ok,false);
 assert.equal(combat.supplies.fuel,2);
});
