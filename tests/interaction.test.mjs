import test from "node:test";
import assert from "node:assert/strict";
import {Planet} from "../planet/planet-core.mjs";
import {Terrain} from "../planet/terrain-engine.mjs";
import {ExplorerController} from "../planet-explorer/controller.mjs";
import {terrainSurface} from "../planet-explorer/geo.mjs";
import {Actions} from "../planet-explorer/actions.mjs";
import {JOINT_NAMES,RIG_SEGMENTS,samplePose,jointTransforms,matrixMultiply,point} from "../planet-explorer/rig.mjs";
import {invert4,unproject,pickSurface} from "../planet-explorer/picking.mjs";
import {ExplorerRenderer,lookAt,multiply4,perspective} from "../planet-explorer/render.mjs";

const make = () => {
  const planet=new Planet({seed:77,timeDays:.25});
  const terrain=new Terrain(planet),controller=new ExplorerController(terrain);
  controller.altitudeM=controller.targetAltitudeM=2.5;
  const actions=new Actions();
  return {planet,terrain,controller,actions,at:(lat,lon)=>terrainSurface(terrain,lat,lon)};
};
test("anatomical joint hierarchy exists for head, neck, hands and legs",()=>{
  const pose=samplePose(),joints=jointTransforms(pose);
  assert.ok(JOINT_NAMES.length>=20);
  for(const key of JOINT_NAMES)assert.equal(joints[key].length,16,key);
  assert.ok(RIG_SEGMENTS.length>=16);
  assert.ok(joints.leftKnee[13]<joints.leftHip[13]);
  assert.ok(joints.leftAnkle[13]<joints.leftKnee[13]);
});
test("walking produces alternating arm and leg swings",()=>{
  const pose=samplePose({phase:Math.PI/2,moving:true});
  assert.ok(pose.leftHipX>0&&pose.rightHipX<0);
  assert.ok(pose.rightShoulderX>0&&pose.leftShoulderX<0);
  assert.ok(pose.leftKneeX>=0&&pose.rightKneeX>=0);
});
test("walk amplitude disappears when standing idle",()=>{
  const still=samplePose({phase:6,moving:false});
  assert.ok(Math.abs(still.leftHipX)<1e-10);
  assert.ok(Math.abs(still.rightHipX)<1e-10);
});
test("jump makes a distinct bent-knee raised-arm pose",()=>{
  const jump=samplePose({jumpHeight:.7});
  assert.ok(jump.leftKneeX>.3);
  assert.ok(jump.rightShoulderX<-.9);
  assert.equal(jump.tool,null);
});
test("sword axe pickaxe and hammer poses carry appropriate tools",()=>{
  for(const [action,tool] of [["sword","sword"],["axe","axe"],["mine","pickaxe"],["build","hammer"]]){
    const a=samplePose({action,progress:.2});
    const b=samplePose({action,progress:.8});
    assert.equal(a.tool,tool);
    assert.notEqual(a.rightShoulderX,b.rightShoulderX);
  }
});
test("rotating a parent shoulder changes child hand position",()=>{
  const straight=jointTransforms(samplePose());
  const swung=jointTransforms(samplePose({action:"sword",progress:.15}));
  const p0=point(straight.rightHand),p1=point(swung.rightHand);
  assert.ok(Math.hypot(...p0.map((v,i)=>v-p1[i]))>.3);
});
test("jump uses planetary gravity and returns to ground",()=>{
  const {controller}=make();
  assert.ok(controller.jump());
  assert.equal(controller.jump(),false); // no double jump before the first frame
  let max=0;
  for(let i=0;i<100;i++){controller.update(.025);max=Math.max(max,controller.jumpY);}
  assert.ok(max>1);
  assert.equal(controller.jumpY,0);
  assert.equal(controller.jumpV,0);
});
test("jump is unavailable while in orbital view",()=>{
  const {controller}=make();
  controller.altitudeM=80000;
  assert.equal(controller.jump(),false);
});
test("tap waypoint is followed and disappears near destination",()=>{
  const {controller}=make();
  assert.ok(controller.setMoveTarget(0,8));
  for(let i=0;i<100;i++)controller.update(.05);
  assert.ok(controller.z>6);
  assert.equal(controller.moveTarget,null);
});
test("manual stick movement cancels tap autopilot",()=>{
  const {controller}=make();
  controller.setMoveTarget(0,30);
  controller.update(.05,{strafe:1});
  assert.equal(controller.moveTarget,null);
});
test("tap target outside local limit is rejected",()=>{
  const {controller}=make();
  assert.equal(controller.setMoveTarget(600,0),false);
});
test("jump and pending waypoint survive snapshot restore",()=>{
  const {controller,terrain}=make();
  controller.setMoveTarget(0,25);
  controller.jump();controller.update(.15);
  const restored=ExplorerController.fromSnapshot(terrain,controller.snapshot());
  assert.deepEqual(restored.snapshot(),controller.snapshot());
});
test("building consumes wood and stone and completes a hut",()=>{
  const {controller,actions,at}=make();
  assert.equal(actions.start("build",controller,at),true);
  assert.equal(actions.resources.wood,8);
  assert.equal(actions.resources.stone,6);
  assert.equal(actions.structures.length,1);
  assert.equal(actions.structures[0].progress,0);
  for(let i=0;i<24;i++)actions.advance(.20);
  assert.equal(actions.structures[0].progress,1);
  assert.equal(actions.completed,1);
});
test("construction cannot overlap previously placed hut",()=>{
  const {controller,actions,at}=make();
  assert.equal(actions.start("build",controller,at),true);
  for(let i=0;i<24;i++)actions.advance(.2);
  assert.equal(actions.start("build",controller,at),false);
  assert.equal(actions.structures.length,1);
});
test("two successive resource jobs add collected materials",()=>{
  const {controller,actions,at}=make();
  assert.equal(actions.start("axe",controller,at),true);
  for(let i=0;i<18;i++)actions.advance(.1);
  assert.equal(actions.resources.wood,14);
  assert.equal(actions.start("mine",controller,at),true);
  for(let i=0;i<18;i++)actions.advance(.1);
  assert.equal(actions.resources.stone,10);
});
test("action in progress cannot be overwritten by another command",()=>{
  const {controller,actions,at}=make();
  assert.equal(actions.start("sword",controller,at),true);
  assert.equal(actions.start("build",controller,at),false);
  assert.equal(actions.structures.length,0);
});
test("airborne building is rejected without spending materials",()=>{
  const {controller,actions,at}=make();
  controller.jump();controller.update(.15);
  assert.equal(actions.start("build",controller,at),false);
  assert.equal(actions.resources.wood,12);
});
test("action snapshots preserve in-progress structures and materials",()=>{
  const {controller,actions,at}=make();
  actions.start("build",controller,at);
  actions.advance(.8);
  const copy=Actions.fromSnapshot(actions.snapshot());
  assert.deepEqual(copy.snapshot(),actions.snapshot());
  for(let i=0;i<23;i++)copy.advance(.2);
  assert.equal(copy.structures[0].progress,1);
});
test("pick center of two-triangle mesh in clip-space",()=>{
  const mesh=[-1,-1,0,1,-1,0,1,1,0,-1,1,0];
  const ids=[0,1,2,0,2,3],vp=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
  const pick=pickSurface(mesh,ids,vp,0,0);
  assert.ok(pick);
  assert.ok(Math.hypot(...pick)<1e-7);
});
test("perspective view projection inverse maps screen space correctly",()=>{
  const m=multiply4(perspective(.95,1.5,.1,1500),lookAt([0,7,-8],[0,1,0]));
  const inverse=invert4(m);
  assert.ok(inverse);
  const near=unproject(inverse,0,0,-1),far=unproject(inverse,0,0,1);
  assert.ok(near.every(Number.isFinite)&&far.every(Number.isFinite));
  assert.ok(Math.hypot(...near.map((v,i)=>v-far[i]))>100);
});
test("articulated renderer draws parts, tool and building with WebGL mock",()=>{
  const {planet,terrain,controller,actions,at}=make();
  let draws=0;
  const gl={
    VERTEX_SHADER:35633,FRAGMENT_SHADER:35632,COMPILE_STATUS:35713,LINK_STATUS:35714,
    ARRAY_BUFFER:34962,ELEMENT_ARRAY_BUFFER:34963,STATIC_DRAW:35044,
    FLOAT:5126,TRIANGLES:4,UNSIGNED_SHORT:5123,DEPTH_TEST:2929,
    COLOR_BUFFER_BIT:16384,DEPTH_BUFFER_BIT:256,BLEND:3042,SRC_ALPHA:770,ONE_MINUS_SRC_ALPHA:771,
    createShader:()=>({}),shaderSource(){},compileShader(){},getShaderParameter:()=>true,
    createProgram:()=>({}),attachShader(){},linkProgram(){},getProgramParameter:()=>true,
    getUniformLocation:()=>({}),createVertexArray:()=>({}),bindVertexArray(){},
    createBuffer:()=>({}),bindBuffer(){},bufferData(){},
    enableVertexAttribArray(){},vertexAttribPointer(){},enable(){},disable(){},
    uniformMatrix4fv(){},uniform3fv(){},uniform1f(){},useProgram(){},viewport(){},
    clearColor(){},clear(){},blendFunc(){},depthMask(){},drawElements(){draws++;},
    deleteBuffer(){},deleteVertexArray(){},deleteProgram(){}
  };
  const canvas={width:960,height:560,clientWidth:960,clientHeight:560,
    getContext:()=>gl,getBoundingClientRect:()=>({left:0,top:0,width:960,height:560})};
  const renderer=new ExplorerRenderer(canvas,planet,terrain);
  renderer.sceneActions=actions;
  actions.start("sword",controller,at);
  assert.equal(renderer.frame(controller),"ground");
  assert.ok(draws>16);
  assert.ok(renderer.rigParts.length>=16);
  assert.ok(renderer.pickGround(480,280));
  for(let i=0;i<5;i++)actions.advance(.2);
  assert.equal(actions.start("build",controller,at),true);
  renderer.frame(controller);
  assert.ok(renderer.buildingMeshes.base);
  renderer.destroy();
});
test("buildings remain anchored to planetary geographic coordinates",()=>{
  const {controller,actions,terrain,at}=make();
  assert.equal(actions.start("build",controller,at),true);
  const house=actions.structures[0];
  assert.ok(Number.isFinite(house.lat)&&Number.isFinite(house.lon));
  const original={lat:house.lat,lon:house.lon};
  for(let i=0;i<23;i++)actions.advance(.2);
  controller.setLanding(controller.origin.lat+1,controller.origin.lon+1);
  assert.deepEqual({lat:actions.structures[0].lat,lon:actions.structures[0].lon},original);
  assert.equal(actions.start("build",controller,at),true);
  assert.equal(actions.structures.length,2);
});
test("malformed rig, input and job snapshots fail safely",()=>{
  const {controller,actions,at}=make();
  assert.throws(()=>samplePose({phase:NaN}),/finite/);
  assert.throws(()=>controller.setMoveTarget(NaN,2),/Invalid/);
  assert.throws(()=>actions.start("fireball",controller,at),/Unknown/);
  assert.throws(()=>Actions.fromSnapshot({}),/Unsupported/);
  assert.equal(invert4(Array(16).fill(0)),null);
});
