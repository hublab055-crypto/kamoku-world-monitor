import test from "node:test";
import assert from "node:assert/strict";
import {createAvatarV10ProceduralBody} from "../avatar-v10-procedural-body.mjs";

const identity=()=>[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
const origin=(x,y,z)=>{
 const m=identity();m[12]=x;m[13]=y;m[14]=z;return m;
};
const JOINTS=[
 ["Pelvis",0,.88,0],["Waist",0,1.05,0],["Chest",0,1.32,0],["Neck",0,1.52,0],
 ["LeftShoulder",-.25,1.38,0],["LeftElbow",-.39,1.12,0],["LeftWrist",-.45,.94,0],
 ["RightShoulder",.25,1.38,0],["RightElbow",.39,1.12,0],["RightWrist",.45,.94,0],
 ["LeftHip",-.13,.82,0],["LeftKnee",-.13,.45,0],["LeftAnkle",-.13,.10,0],
 ["RightHip",.13,.82,0],["RightKnee",.13,.45,0],["RightAnkle",.13,.10,0]
];
function fixture(){
 return {isV10:true,studyModelBust:false,center:[0,0,0],scale:1,primitives:[],
  parents:JOINTS.map(()=>-1),
  nodes:JOINTS.map(([name,x,y,z])=>({name,matrix:origin(x,y,z),
   translation:[x,y,z],rotation:[0,0,0,1],scale:[1,1,1]})),
  skins:[{joints:JOINTS.map((_,i)=>i),inverseBind:JOINTS.map(()=>identity()),skeleton:0}]
 };
}
test("a clothing-free skeleton yields an actual single skinned body volume",()=>{
 const rig=fixture();
 const body=createAvatarV10ProceduralBody(rig,{resolution:.066});
 assert(body);
 assert.equal(body.name,"V10 procedural anatomical body");
 assert.equal(body.proceduralAnatomy,true);
 assert.deepEqual(body.wardrobe,["base","swim"]);
 assert(body.indices.length>2500);
 assert(body.arrays.positions.length>2400);
 assert.equal(body.arrays.positions.length,body.arrays.normals.length);
 assert.equal(body.arrays.positions.length,body.arrays.colors.length);
 assert.equal(body.arrays.positions.length/3*4,body.arrays.joints.length);
 assert.equal(body.arrays.positions.length/3*4,body.arrays.weights.length);
 assert.equal(rig.primitives.length,0); // no stolen clothing geometry
});
test("surface is watertight with one contiguous connected component",()=>{
 const body=createAvatarV10ProceduralBody(fixture(),{resolution:.066});
 const triangles=body.indices,edgeCounts=new Map(),adj=new Map();
 const edge=(a,b)=>{
  const key=Math.min(a,b)+":"+Math.max(a,b);
  edgeCounts.set(key,(edgeCounts.get(key)||0)+1);
  if(!adj.has(a))adj.set(a,new Set());
  if(!adj.has(b))adj.set(b,new Set());
  adj.get(a).add(b);adj.get(b).add(a);
 };
 for(let i=0;i<triangles.length;i+=3){
  edge(triangles[i],triangles[i+1]);
  edge(triangles[i+1],triangles[i+2]);
  edge(triangles[i+2],triangles[i]);
 }
 assert([...edgeCounts.values()].every(n=>n===2),"open edge or non-manifold seam");
 const seen=new Set(),stack=[triangles[0]];
 while(stack.length){
  const v=stack.pop();if(seen.has(v))continue;seen.add(v);
  for(const n of adj.get(v)||[])if(!seen.has(n))stack.push(n);
 }
 assert.equal(seen.size,body.arrays.positions.length/3,"fragmented body");
});
test("skin weights are finite, normalized and address valid bone indices",()=>{
 const rig=fixture(),body=createAvatarV10ProceduralBody(rig,{resolution:.066});
 const w=body.arrays.weights,j=body.arrays.joints;
 for(let i=0;i<w.length;i+=4){
  const total=w[i]+w[i+1]+w[i+2]+w[i+3];
  assert(Math.abs(total-1)<1e-4);
  for(let c=0;c<4;c++){
   assert(Number.isFinite(w[i+c]));
   assert(Number.isInteger(j[i+c]));
   assert(j[i+c]>=0&&j[i+c]<rig.skins[0].joints.length);
  }
 }
});
test("absent or incompatible rig retains the existing legacy fallback",()=>{
 assert.equal(createAvatarV10ProceduralBody({isV10:false}),null);
 const rig=fixture();rig.nodes[0].name="Unknown";
 assert.equal(createAvatarV10ProceduralBody(rig),null);
});
