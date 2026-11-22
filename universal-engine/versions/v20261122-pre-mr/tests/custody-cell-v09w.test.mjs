import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {CELL_BOUNDS,newCustodyCell,custodyPositionAllowed,walkCustodyCell} from "../planet-explorer/custody-cell.mjs";

const source=name=>readFileSync(new URL("../planet-explorer/"+name,import.meta.url),"utf8");
const walk=(pose,command,count=1)=>{
 let p=pose;
 for(let i=0;i<count;i++)p=walkCustodyCell(p,command,.08);
 return p;
};

test("guard cell and railway cell both permit four-direction stick walking",()=>{
 const p=newCustodyCell();
 assert.ok(walk(p,{forward:1}).z>p.z,"forward moves inside jail");
 assert.ok(walk(p,{forward:-1}).z<p.z,"back moves inside jail");
 assert.ok(walk(p,{strafe:1}).x>p.x,"right strafes");
 assert.ok(walk(p,{strafe:-1}).x<p.x,"left strafes");
});
test("iron bars and stone walls physically contain the avatar on every edge",()=>{
 const movements=[{forward:1},{forward:-1},{strafe:1},{strafe:-1}];
 for(const command of movements){
  const p=walk(newCustodyCell(),command,250);
  assert.ok(custodyPositionAllowed(p.x,p.z),JSON.stringify(command));
  assert.ok(p.x>=CELL_BOUNDS.minX&&p.x<=CELL_BOUNDS.maxX);
  assert.ok(p.z>=CELL_BOUNDS.minZ&&p.z<=CELL_BOUNDS.maxZ);
  assert.equal(p.blocked,true,"wall/bar collision");
 }
});
test("locked cell furniture has solid footprints",()=>{
 const p=walk(newCustodyCell(),{strafe:1},3);
 assert.ok(p.x>0.6);
 let nearBed=p;
 for(let i=0;i<45;i++)nearBed=walkCustodyCell(nearBed,{forward:-1},.08);
 assert.ok(nearBed.z>=-.91,"bed stops movement");
 assert.ok(nearBed.blocked,"bed collision shown");
 assert.equal(custodyPositionAllowed(1,-2),false);
 assert.equal(custodyPositionAllowed(-1.5,1.7),false);
});
test("cell movement slides along bars and keeps avatar in the same room",()=>{
 const p={x:3.74,z:0,yaw:0};
 const next=walkCustodyCell(p,{forward:1,strafe:1},.08);
 assert.equal(next.x,p.x);
 assert.ok(next.z>p.z,"sliding along wall is supported");
 assert.equal(next.blocked,true);
});
test("turning in place and paused world state do not freeze room locomotion",()=>{
 const a=walkCustodyCell(newCustodyCell(),{turn:1},.08);
 assert.ok(a.yaw>0);
 assert.ok(walkCustodyCell(a,{forward:1},.08).moving);
 assert.ok(custodyPositionAllowed(a.x,a.z));
});
test("game wires VR joystick to isolated custody movement and unlocks on release",()=>{
 const app=source("app.mjs"),render=source("render.mjs"),xr=source("xr-ui.mjs");
 assert.match(app,/renderer\.custodyCell=walkCustodyCell\(renderer\.custodyCell,input,dt\)/);
 assert.match(app,/if\(xrAxes&&\(!detained\|\|jailCellActive\)\)/);
 assert.match(app,/controller\.update\(dt,\{forward:0,strafe:0,turn:0\}\)/);
 assert.match(app,/renderer\.custodyCell=null;renderer\.custodyKind=null/);
 assert.match(render,/this\.custodyCell\|\|this\.railwaySecurity\?\.jailed/);
 assert.match(render,/this\.xrInteriorVP\(person\)/);
 assert.match(xr,/movement\.jailWalkable/);
});
