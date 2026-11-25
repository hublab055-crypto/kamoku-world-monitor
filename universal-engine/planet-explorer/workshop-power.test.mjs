import test from "node:test";
import assert from "node:assert/strict";
import {Workshop} from "./workshop.mjs";
import {placePart} from "./workshop-spatial.mjs";
import {addMechanism,driveMechanism,addMotor,setMotor,tickMotors,removeMechanism} from "./workshop-mechanics.mjs";
const setup=()=>{const w=new Workshop(),site={lat:0,lon:0},parts=Array.from({length:4},(_,i)=>{const p=w.stock("round",20,10);placePart(w,p.id,site,i*30,0,100);return p;});return {w,parts};};
test("gear chain transmits to lead screw",()=>{const {w,parts:[a,b,c,d]}=setup();const r=addMechanism(w,a.id,b.id,"gear",{ratio:.5});addMechanism(w,b.id,c.id,"gear",{ratio:2});addMechanism(w,c.id,d.id,"screw",{pitch:5});driveMechanism(w,r.id,2*Math.PI);assert.ok(Math.abs(c.pose.yaw-2*Math.PI)<1e-9);assert.ok(Math.abs(d.pose.x-95)<1e-9);assert.throws(()=>addMechanism(w,c.id,a.id,"gear"));assert.throws(()=>removeMechanism(w,r.id));});
test("continuous motor, energy, stop and reload",()=>{const {w,parts:[a,b]}=setup();const r=addMechanism(w,a.id,b.id,"gear",{ratio:1});const m=addMotor(w,r.id,{rpm:60,energyWh:1});setMotor(w,m.id,true);for(let i=0;i<20;i++)tickMotors(w,.05);assert.ok(b.pose.yaw<0&&m.energyWh<1);const x=b.pose.yaw;tickMotors(w,0);assert.equal(b.pose.yaw,x);assert.equal(new Workshop(w.snapshot()).motors[0].running,false);setMotor(w,m.id,false);tickMotors(w,.1);assert.equal(b.pose.yaw,x);});
test("overload and battery depletion",()=>{const {w,parts:[a,b]}=setup();const r=addMechanism(w,a.id,b.id,"gear");const m=addMotor(w,r.id,{torque:1,load:2});setMotor(w,m.id,true);tickMotors(w,.1);assert.equal(m.status,"過負荷停止");m.load=.1;m.energyWh=.000001;setMotor(w,m.id,true);tickMotors(w,.1);assert.equal(m.status,"電力切れ");});
