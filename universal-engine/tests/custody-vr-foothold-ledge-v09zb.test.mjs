import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
 BAR_FLOOR_Y,BAR_CLIMB_HEIGHT_M,BAR_BRACED_HEIGHT_M,BAR_LEDGE_HEIGHT_M,BAR_LEDGE_Z,
 newCustodyBarClimb,grabCustodyBar,pullCustodyBars,custodyClimbHeld,
 braceCustodyFoot,custodyLedgeReachable,beginCustodyLedgeMantle,
 stepOffCustodyLedge,settleCustodyBarClimb,releaseAllCustodyBars
} from "../planet-explorer/custody-bar-climb.mjs";
const source=name=>readFileSync(new URL("../planet-explorer/"+name,import.meta.url),"utf8");
const m=(x=0,y=0,z=0)=>[1,0,0,0,0,1,0,0,0,0,1,0,x,y,z,1];
const p=()=>({x:0,y:BAR_FLOOR_Y,z:-6.5,yaw:0});
const bar=m(0,1.4,.35),stage=m();

test("foot brace requires a gripped, closed door inside the player's cell",()=>{
 const s=newCustodyBarClimb(),actor=p();
 assert.equal(braceCustodyFoot(s,actor,0).ok,false);
 assert.equal(grabCustodyBar(s,actor,"left",bar,stage).ok,true);
 assert.deepEqual(braceCustodyFoot(s,actor,0),{ok:true,braced:true});
 assert.deepEqual(braceCustodyFoot(s,actor,0),{ok:true,braced:false});
 assert.equal(braceCustodyFoot(s,actor,1).ok,false);
 actor.z=-8.8;
 assert.equal(braceCustodyFoot(s,actor,0).ok,false);
});
test("foot support increases climbing range, but cannot bypass ceiling",()=>{
 const s=newCustodyBarClimb(),actor=p();
 grabCustodyBar(s,actor,"left",bar,stage);
 actor.y=BAR_FLOOR_Y+BAR_CLIMB_HEIGHT_M;
 let delta=pullCustodyBars(s,actor,{left:m(0,1.33,.35)},stage,.011);
 assert.equal(delta,0,"unbraced still capped");
 braceCustodyFoot(s,actor,0);
 delta=pullCustodyBars(s,actor,{left:m(0,1.26,.35)},stage,.011);
 assert.ok(delta>0,"feet permit further physical hand pull");
 assert.ok(actor.y<=BAR_FLOOR_Y+BAR_BRACED_HEIGHT_M);
});
test("ledge mantle requires foot support, real tracked hand on ledge, and enough altitude",()=>{
 const s=newCustodyBarClimb(),actor=p();
 grabCustodyBar(s,actor,"left",bar,stage);
 assert.equal(beginCustodyLedgeMantle(s,actor,0,m(0,.25,-.26),stage).ok,false);
 braceCustodyFoot(s,actor,0);
 assert.equal(beginCustodyLedgeMantle(s,actor,0,m(0,.25,-.26),stage).ok,false,"too low");
 actor.y+=1.05;
 assert.equal(custodyLedgeReachable(m(0,.25,-.26),stage,actor),true);
 assert.equal(beginCustodyLedgeMantle(s,actor,0,m(0,.25,1.5),stage).ok,false,"hand not at ledge");
 assert.equal(beginCustodyLedgeMantle(s,actor,1,m(0,.25,-.26),stage).ok,false,"door open");
 const ok=beginCustodyLedgeMantle(s,actor,0,m(0,.25,-.26),stage);
 assert.equal(ok.ok,true);
 assert.equal(Boolean(s.mantle),true);
 assert.equal(custodyClimbHeld(s),false);
});
test("mantle animation lands ONLY on inside ledge, cannot cross locked bars",()=>{
 const s=newCustodyBarClimb(),actor=p();
 grabCustodyBar(s,actor,"left",bar,stage);
 braceCustodyFoot(s,actor);
 actor.y+=1.03;
 assert.ok(beginCustodyLedgeMantle(s,actor,0,m(0,.25,-.26),stage).ok);
 for(let i=0;i<30;i++)settleCustodyBarClimb(s,actor,.03);
 assert.equal(s.onLedge,true);
 assert.equal(s.active,true);
 assert.ok(Math.abs(actor.y-BAR_FLOOR_Y-BAR_LEDGE_HEIGHT_M)<1e-6);
 assert.ok(Math.abs(actor.z-BAR_LEDGE_Z)<1e-6);
 assert.ok(actor.z < -6.20,"never crossed locked door or gallery");
 for(let i=0;i<5;i++)settleCustodyBarClimb(s,actor,.03);
 assert.equal(actor.y,BAR_FLOOR_Y+BAR_LEDGE_HEIGHT_M,"ledge supports standing");
});
test("left stick backward safely steps off ledge into cell and gravity descends",()=>{
 const s=newCustodyBarClimb(),actor=p();
 grabCustodyBar(s,actor,"left",bar,stage);braceCustodyFoot(s,actor);
 actor.y+=1.03;
 beginCustodyLedgeMantle(s,actor,0,m(0,.25,-.26),stage);
 for(let i=0;i<30;i++)settleCustodyBarClimb(s,actor,.03);
 assert.equal(stepOffCustodyLedge(s,actor,{forward:1}),false);
 assert.equal(stepOffCustodyLedge(s,actor,{forward:-.8}),true);
 assert.ok(actor.z<=-7.21,"descent is on cell side");
 for(let i=0;i<90;i++)settleCustodyBarClimb(s,actor,.016);
 assert.equal(actor.y,BAR_FLOOR_Y);
 assert.equal(s.onLedge,false);
 assert.equal(s.active,false);
});
test("VR exit cancels foot/ledge state without persisting impossible movement",()=>{
 const s=newCustodyBarClimb(),actor=p();
 grabCustodyBar(s,actor,"left",bar,stage);braceCustodyFoot(s,actor);
 actor.y+=1.03;beginCustodyLedgeMantle(s,actor,0,m(0,.25,-.26),stage);
 releaseAllCustodyBars(s);
 assert.equal(s.footBraced,false);
 assert.equal(s.onLedge,false);
 assert.equal(s.mantle,null);
 for(let i=0;i<90;i++)settleCustodyBarClimb(s,actor,.016);
 assert.equal(actor.y,BAR_FLOOR_Y);
});
test("door geometry contains foothold rungs and a solid inside ledge",()=>{
 const geometry=source("custody-facility-geometry.mjs");
 assert.match(geometry,/for\(const height of \[\.38,\.83\]\)/);
 assert.match(geometry,/box\(b,0,3\.8\+1\.22,-6\.76/);
 assert.match(geometry,/box\(b,0,3\.8\+1\.32,-6\.76/);
});
test("Quest events, simulation and body match foot + ledge state without releasing player to world",()=>{
 const xr=source("xr-ui.mjs"),app=source("app.mjs"),render=source("render.mjs");
 assert.match(xr,/onVRCustody\("climb-foot"/);
 assert.match(xr,/onVRCustody\("climb-mantle"/);
 assert.match(xr,/vrCustodyTriggerConsumed\.delete/);
 assert.match(app,/braceCustodyFoot\(custodyClimb,player/);
 assert.match(app,/beginCustodyLedgeMantle\(custodyClimb,player/);
 assert.match(app,/stepOffCustodyLedge\(custodyClimb,custodyFacility\.player,input\)/);
 assert.match(app,/controller\.update\(dt,\{forward:0,strafe:0,turn:0\}\)/);
 assert.match(render,/rig\.custodyFootBraced/);
});
