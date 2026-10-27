import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
 BAR_FLOOR_Y,BAR_CLIMB_HEIGHT_M,newCustodyBarClimb,custodyGripPoint,
 custodyBarGrippable,grabCustodyBar,releaseCustodyBar,releaseAllCustodyBars,
 pullCustodyBars,settleCustodyBarClimb,custodyClimbHeld
} from "../planet-explorer/custody-bar-climb.mjs";

const source=name=>readFileSync(new URL("../planet-explorer/"+name,import.meta.url),"utf8");
const matrix=(x=0,y=0,z=0)=>{
 const m=[1,0,0,0,0,1,0,0,0,0,1,0,x,y,z,1];return m;
};
const actor=()=>({x:0,z:-6.5,y:BAR_FLOOR_Y,yaw:0});
const grip=(x=0,y=1.40,z=.35)=>matrix(x,y,z);

test("headset hand transforms resolve to actual bars of the upstairs cell",()=>{
 const person=actor(),s=matrix();
 const p=custodyGripPoint(grip(),s,person);
 assert.ok(p);
 assert.equal(p.x,0);assert.equal(p.z,-6.15);
 assert.ok(Math.abs(p.y-5.2)<1e-9);
 assert.equal(custodyBarGrippable(p,person,0),true);
 assert.equal(custodyBarGrippable({...p,z:-5.6},person,0),false,"reach is finite");
 assert.equal(custodyBarGrippable({...p,x:3},person,0),false,"other cell cannot be grabbed");
 assert.equal(custodyBarGrippable(p,person,1),false,"open cell gate no longer graspable");
});
test("VR world-to-cell transform honors XR stage heading and actor translation",()=>{
 const stage=matrix(10,1,-2);
 const p=actor();p.x=1;p.z=-7.2;
 const worldGrip=matrix(10.2,2.4,-1.0);
 const local=custodyGripPoint(worldGrip,stage,p);
 assert.ok(Math.abs(local.x-1.2)<1e-9);
 assert.ok(Math.abs(local.y-5.2)<1e-9);
 assert.ok(Math.abs(local.z+6.2)<1e-9);
 // 90 degree heading: world (dx=1,dz=0) corresponds to local z=1.
 const turned=[0,0,-1,0,0,1,0,0,1,0,0,0,0,0,0,1];
 const translated=custodyGripPoint(matrix(1,1.4,0),turned,actor());
 assert.ok(Math.abs(translated.x)<1e-9);
 assert.ok(Math.abs(translated.z+5.5)<1e-9);
});
test("left grip or right grip lifts body when tracked hand pulls DOWN",()=>{
 const state=newCustodyBarClimb(),person=actor(),stage=matrix();
 assert.equal(grabCustodyBar(state,person,"left",grip(),stage).ok,true);
 assert.equal(custodyClimbHeld(state),true);
 const raised=pullCustodyBars(state,person,{left:grip(0,1.35,.35)},stage,1/90);
 assert.ok(raised>.04);assert.ok(raised<=.07);
 assert.ok(person.y>BAR_FLOOR_Y);
 assert.equal(releaseCustodyBar(state,"left"),true);
 assert.equal(custodyClimbHeld(state),false);
 assert.equal(grabCustodyBar(state,person,"right",grip(.2,1.40,.35),stage).ok,true);
});
test("two hands alternate pulls without double-climbing while holding together",()=>{
 const state=newCustodyBarClimb(),person=actor(),stage=matrix();
 assert.equal(grabCustodyBar(state,person,"left",grip(-.2),stage).ok,true);
 assert.equal(grabCustodyBar(state,person,"right",grip(.2),stage).ok,true);
 const raised=pullCustodyBars(state,person,
  {left:grip(-.2,1.34),right:grip(.2,1.34)},stage,1/90);
 assert.ok(raised>.05&&raised<.07);
 assert.ok(Math.abs(person.y-BAR_FLOOR_Y-.06)<1e-9);
 assert.equal(releaseCustodyBar(state,"left"),true);
 assert.equal(custodyClimbHeld(state),true,"right hand remains on bars");
});
test("climb cannot bypass ceiling and release safely returns to floor",()=>{
 const state=newCustodyBarClimb(),person=actor(),stage=matrix();
 assert.ok(grabCustodyBar(state,person,"left",grip(),stage).ok);
 let y=1.4;
 for(let i=0;i<40;i++){y-=.09;pullCustodyBars(state,person,{left:grip(0,y,.35)},stage,1/90);}
 assert.ok(person.y<=BAR_FLOOR_Y+BAR_CLIMB_HEIGHT_M+1e-9);
 assert.ok(person.y>BAR_FLOOR_Y,"actor actually climbed");
 assert.equal(releaseCustodyBar(state,"left"),true);
 for(let i=0;i<150;i++)settleCustodyBarClimb(state,person,.016);
 assert.equal(person.y,BAR_FLOOR_Y);
 assert.equal(state.active,false);
});
test("controller tracking loss and session end cannot leave a permanently attached hand",()=>{
 const state=newCustodyBarClimb(),person=actor();
 grabCustodyBar(state,person,"right",grip(),matrix());
 for(let i=0;i<30;i++)pullCustodyBars(state,person,{right:null},matrix(),.011);
 assert.equal(custodyClimbHeld(state),false);
 grabCustodyBar(state,person,"left",grip(),matrix());
 releaseAllCustodyBars(state);
 assert.equal(custodyClimbHeld(state),false);
 assert.equal(grabCustodyBar(state,person,"left",grip(),matrix(),1).ok,false);
});
test("VR input is routed only through custody, does not bypass guard/escape rules",()=>{
 const ui=source("xr-ui.mjs"),app=source("app.mjs"),render=source("render.mjs");
 assert.match(ui,/addEventListener\("squeezestart",onVRSqueezeStart\)/);
 assert.match(ui,/addEventListener\("squeezeend",onVRSqueezeEnd\)/);
 assert.match(ui,/onVRCustody\("climb-grab"/);
 assert.match(ui,/onVRCustody\("climb-pull"/);
 assert.match(app,/grabCustodyBar\(custodyClimb,player/);
 assert.match(app,/pullCustodyBars\(custodyClimb,player/);
 assert.match(app,/settleCustodyBarClimb\(custodyClimb,custodyFacility\.player,dt\)/);
 assert.match(app,/controller\.update\(dt,\{forward:0,strafe:0,turn:0\}\)/);
 assert.match(render,/translate\(-person\.x,-\(person\.y\|\|0\),-person\.z\)/);
});
