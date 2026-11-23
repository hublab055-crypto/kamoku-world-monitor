import test from 'node:test';
import assert from 'node:assert/strict';
import {ShipLaunchProcedure, launchCrewReady, launchStatus} from '../ship-launch-procedure.mjs';
function fixture(){
 const crew=[['navigator',-2.3,-10.8],['engineer',1.6,7.2],['companion',-2.5,3]].map(([id,x,z])=>({id,x,z,seated:true,following:false,returning:false}));
 const v={kind:'surface-to-surface',status:'docked',seated:true,hatchOpen:true,fuel:80,throttle:.72,
  airAltitude:0,volThrottle:0,shipSystems:{parts:{engine:100}},interior:{crew,routine:{endIfParticipant:()=>{}},advanceCrew(dt){for(const c of crew)if(c.returning){c.returning=false;c.seated=true;} }},setThrottle(x){this.throttle=x;}};
 return v;
}
const advance=(p,v,n=26)=>{for(let i=0;i<n;i++)p.update(v,.12)};
test('main engine start then spinup, crew order and roll call before launch',()=>{
 const lines=[];const p=new ShipLaunchProcedure({notify:t=>lines.push(t)}),v=fixture();
 assert.equal(p.beforeLaunch(v).ok,false);
 assert.equal(p.orderCrew(v).ok,true);
 assert.equal(p.startEngine(v).ok,true);
 assert.equal(p.rollCall(v).ok,false);
 advance(p,v);v.hatchOpen=false;
 assert.equal(p.rollCall(v).ok,true);
 assert.equal(p.beforeLaunch(v).ok,true);
 assert.ok(lines.some(s=>s.includes('機関士')));
});
test('unseated captain and insufficient fuel cannot start',()=>{
 const v=fixture(),p=new ShipLaunchProcedure();v.seated=false;
 assert.equal(p.startEngine(v).ok,false);v.seated=true;v.fuel=1;
 assert.equal(p.startEngine(v).ok,false);
});
test('crew return is required; walking is not teleported',()=>{
 const v=fixture(),p=new ShipLaunchProcedure();
 v.interior.crew[0].following=true;v.interior.crew[0].seated=false;v.interior.crew[0].x=1;
 assert.equal(p.orderCrew(v).ok,true);assert.equal(v.interior.crew[0].seated,false);
 assert.equal(v.interior.crew[0].returning,true);
 advance(p,v,1);assert.equal(launchCrewReady(v),true);
});
test('hatch opening or standing after roll call revokes departure permission',()=>{
 const v=fixture(),p=new ShipLaunchProcedure();p.orderCrew(v);p.startEngine(v);advance(p,v);v.hatchOpen=false;
 assert.equal(p.rollCall(v).ok,true);v.hatchOpen=true;p.update(v,.12);
 assert.equal(v.launchChecklist.rollCalled,false);
 assert.equal(p.beforeLaunch(v).ok,false);
});
test('launch explicitly resets MAIN and VOL, and persists state',()=>{
 const v=fixture(),p=new ShipLaunchProcedure();p.orderCrew(v);p.startEngine(v);advance(p,v);v.hatchOpen=false;p.rollCall(v);
 p.launched(v);v.status='atmosphere';assert.equal(v.throttle,0);assert.equal(v.volThrottle,0);
 assert.equal(v.launchChecklist.launched,true);assert.equal(v.launchChecklist.combatAuthorized,false);
});
test('lift clearance and pirate contact announce only once',()=>{
 const messages=[],p=new ShipLaunchProcedure({notify:s=>messages.push(s)}),v=fixture();
 p.launched(v);v.status='atmosphere';v.airAltitude=32;p.update(v,.12);
 v.status='origin-orbit';const combat={combatTargets:[{id:'pirate-1'}],lockContact:()=>true,fireControl:false,autoFire:true};
 p.update(v,.12,combat);p.update(v,.12,combat);
 assert.equal(combat.fireControl,true);assert.equal(combat.autoFire,false);
 assert.equal(messages.filter(s=>s.includes('前方から所属不明機')).length,1);
 assert.equal(messages.filter(s=>s.includes('進路クリア')).length,1);
 assert.equal(p.authorizeCombat(v,combat).ok,true);
 assert.equal(v.launchChecklist.combatAuthorized,true);
});
test('authorization blocked before orbit and without targets',()=>{
 const v=fixture(),p=new ShipLaunchProcedure();p.launched(v);
 assert.equal(p.authorizeCombat(v,{combatTargets:[{id:1}]}).ok,false);
 v.status='orbit';assert.equal(p.authorizeCombat(v,{combatTargets:[]}).ok,false);
});
test('legacy voyages not in surface mode are unaffected',()=>{
 const p=new ShipLaunchProcedure(),v=fixture();v.kind='test';
 assert.equal(p.ensure(v),null);assert.equal(p.beforeLaunch(v).ok,false);
 assert.equal(launchStatus(v).active,false);
});