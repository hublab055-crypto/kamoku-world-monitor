import test from "node:test";
import assert from "node:assert/strict";
import {cadTarget,installProgram,camControl,tickCAM} from "./workshop-cam.mjs";
import {Workshop} from "./workshop.mjs";
import {addMechanism,addMotor} from "./workshop-mechanics.mjs";
import {registerMachine} from "./workshop-machine-tools.mjs";
const doc={shapes:[{id:"r",type:"rect",a:{x:0,y:0},b:{x:40,y:30}},{id:"h",type:"circle",c:{x:20,y:15},r:4}],features:[{kind:"addExtrude",sourceIds:["r"],plane:"XY",depth:10},{kind:"cutExtrude",sourceIds:["h"],plane:"XY",depth:10}]};
const site={lat:0,lon:0};
function setup(){const w=new Workshop();for(const kind of ["mill","drill"]){const parts=Array.from({length:4},(_,i)=>{const p=w.stock("round",20,10);p.pose={site,x:Math.floor(i/2)*50,y:100+i%2*10,z:0,yaw:0};return p;});const spindle=addMotor(w,addMechanism(w,parts[0].id,parts[1].id,"shaft").id,{rpm:120});const feed=addMotor(w,addMechanism(w,parts[2].id,parts[3].id,"screw",{pitch:10}).id,{rpm:60});registerMachine(w,{kind,spindle:spindle.id,feed:feed.id});}return w;}
test("CAD subset and unsupported cuts",()=>{const t=cadTarget(doc);assert.equal(t.w,40);assert.equal(t.holes[0].x,0);assert.throws(()=>cadTarget({...doc,features:[doc.features[0],{...doc.features[1],depth:3}]}));});
test("two operations auto transfer and complete",()=>{const w=setup(),p=w.stock("plate",12,35,45);const c=installProgram(w,p.id,doc,site);assert.equal(c.steps.length,2);camControl(w,"start");for(let i=0;i<40;i++)tickCAM(w,.25);assert.equal(c.status,"complete");assert.equal(p.d,10);assert.equal(p.w,40);assert.equal(p.holes[0].through,true);});
test("resume after reload",()=>{const w=setup(),p=w.stock("plate",12,35,45);installProgram(w,p.id,doc,site);camControl(w,"start");tickCAM(w,.1);const r=new Workshop(w.snapshot());assert.equal(r.cam.status,"paused");camControl(r,"start");for(let i=0;i<40;i++)tickCAM(r,.25);assert.equal(r.cam.status,"complete");});
