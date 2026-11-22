import test from "node:test";
import assert from "node:assert/strict";
import {xrIdentity,xrMul,xrTranslate,xrRotateY,xrAnchor,xrStage,xrTableHit,
 xrPlacementFromHit,xrHeading} from "../planet-explorer/xr-spatial.mjs";

function point(m,v){
 return [
  m[0]*v[0]+m[4]*v[1]+m[8]*v[2]+m[12],
  m[1]*v[0]+m[5]*v[1]+m[9]*v[2]+m[13],
  m[2]*v[0]+m[6]*v[1]+m[10]*v[2]+m[14]
 ];
}
function near(a,b,eps=1e-6){assert.ok(Math.abs(a-b)<eps,`${a} not close to ${b}`);}
test("XR identity, yaw and column-major transform order are stable",()=>{
 const yaw=xrRotateY(Math.PI/2);
 near(xrHeading(yaw),Math.PI/2);
 const out=point(xrMul(xrTranslate(2,3,4),yaw),[0,0,-1]);
 near(out[0],1);near(out[1],3);near(out[2],4);
});
test("MR planet centers mesh at the floating world position",()=>{
 const pose=xrIdentity();pose[13]=1.7;
 const a=xrAnchor(pose,{floor:true});
 near(a.position[1],.78);
 const stage=xrStage({mode:"mr-planet",anchor:a,planetRadius:100,planetScale:.24});
 const center=point(stage,[0,0,0]);for(let i=0;i<3;i++)near(center[i],a.position[i]);
 near(Math.hypot(...point(stage,[100,0,0]).map((v,i)=>v-center[i])),.24);
});
test("MR RTS model keeps the game actor at the table origin",()=>{
 const pose=xrIdentity();pose[12]=.2;pose[13]=1.65;pose[14]=.1;
 const anchor=xrAnchor(pose,{floor:true});
 const stage=xrStage({mode:"mr-rts",anchor,actorYaw:.65,rtsScale:.0014});
 const model=xrMul(stage,xrTranslate(-30,-12,-50));
 const actor=point(model,[30,12,50]);
 anchor.position.forEach((v,i)=>near(actor[i],v));
});
test("VR floor follows local-floor origin without moving the avatar save position",()=>{
 const head=xrIdentity();head[12]=3;head[13]=1.72;
 const anchor=xrAnchor(head,{floor:true});
 const stage=xrStage({mode:"vr",anchor,actorYaw:0});
 const actor=point(xrMul(stage,xrTranslate(-10,-20,-30)),[10,20,30]);
 near(actor[0],3);near(actor[1],0);near(actor[2],0);
});
test("controller ray hits correct world location on the tabletop",()=>{
 const pose=xrIdentity();pose[13]=1.7;
 const a=xrAnchor(pose,{floor:true});
 const actor={x:30,z:50,yaw:0};
 const ray=xrIdentity();
 ray[12]=a.position[0];ray[13]=1.3;ray[14]=a.position[2];
 ray[8]=0;ray[9]=1;ray[10]=0; // a ray pointed straight down
 const hit=xrTableHit(ray,a,0,actor,.0014);
 assert.ok(hit);near(hit.x,30);near(hit.z,50);
 ray[9]=-1;
 assert.equal(xrTableHit(ray,a,0,actor,.0014),null,"upward ray cannot pick floor");
});
test("hit-test placement only changes ephemeral hologram anchor",()=>{
 const head=xrIdentity(),hit=xrTranslate(2,.65,-2);
 const a=xrPlacementFromHit(hit,head,true);
 near(a.position[0],2);near(a.position[1],.675);near(a.position[2],-2);
});
