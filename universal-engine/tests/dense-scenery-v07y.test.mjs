import test from "node:test";
import assert from "node:assert/strict";
import {VILLAGE_SITES,sceneryHash,patchSceneryHeight,planWorldScenery} from "../planet-explorer/world-scenery.mjs";
import {buildSceneryMeshes,buildSceneryInstances,sceneryPrototype} from "../planet-explorer/scenery-geometry.mjs";
const forest={elevationM:440,category:"forest",water:false,river:false};
const options={seed:77,cx:0,cz:0,radius:450,groundAt:()=>440,biomeAt:()=>forest};

test("deterministic close-up forest and meadow are more than 10x the old 80-object ceiling",()=>{
  const first=planWorldScenery(options),second=planWorldScenery(options);
  assert.ok(first.trees.filter(n=>n.kind==="wood").length>=13000,">=10x the previous 1.3k trees");
  assert.ok(first.trees.filter(n=>n.kind==="stone").length>=1100,">=10x previous scattered rocks");
  assert.ok(first.grass.length>=130000,">=10x previous 13k grass blades");
  assert.equal(first.buildings.length,VILLAGE_SITES.length);
  assert.equal(first.buildings.length,12);
  assert.deepEqual(first.trees,second.trees);
  assert.deepEqual(first.grass,second.grass);
  assert.ok(first.trees.every(n=>n.id&&["wood","stone"].includes(n.kind)));
  assert.ok(first.trees.every(n=>Math.hypot(n.x,n.z)>14),"landing pad must stay clear");
});

test("same trees remain anchored across zoom and panning",()=>{
  const a=planWorldScenery(options);
  const zoom=planWorldScenery({...options,radius:900});
  const pan=planWorldScenery({...options,cx:110,cz:0});
  const z=new Map(zoom.trees.map(n=>[n.id,n]));
  const p=new Map(pan.trees.map(n=>[n.id,n]));
  assert.ok(a.trees.every(n=>z.has(n.id)&&z.get(n.id).x===n.x&&z.get(n.id).z===n.z));
  const visible=a.trees.filter(n=>p.has(n.id));
  assert.ok(visible.length>200);
  assert.ok(visible.every(n=>p.get(n.id).x===n.x&&p.get(n.id).z===n.z));
  assert.equal(sceneryHash(33,-17,77),sceneryHash(33,-17,77));
  assert.equal(planWorldScenery({...options,radius:5000}).trees.length,0);
});

test("terrain-conforming placement samples the rendered patch",()=>{
  const vertices=[];
  for(let j=0;j<=2;j++)for(let i=0;i<=2;i++)vertices.push((i-1)*20,100+i*10+j*20,(1-j)*20);
  const patch={vertices:new Float32Array(vertices),resolution:2,radiusM:20};
  assert.equal(patchSceneryHeight(patch,0,0),130);
  assert.equal(patchSceneryHeight(patch,-20,20),100);
  assert.equal(patchSceneryHeight(patch,20,-20),160);
  assert.ok(Number.isFinite(patchSceneryHeight(patch,5,-5)));
});

test("forest, grass, and all settlement geometries fit uint16 WebGL batches",()=>{
  const plan=planWorldScenery(options);
  // A bounded compatibility sample exercises the old baked mesh fallback.
  // The main renderer now uses GPU instancing for the whole 10x population.
  const sample={trees:plan.trees.slice(0,150),grass:plan.grass.slice(0,800),buildings:plan.buildings};
  const scene=buildSceneryMeshes(sample);
  const groups=buildSceneryInstances(plan);
  assert.equal(groups.woods.reduce((n,g)=>n+g.count,0),plan.trees.length);
  assert.equal(groups.meadow.reduce((n,g)=>n+g.count,0),plan.grass.length);
  for(const group of [...groups.woods,...groups.meadow]){
    assert.ok(group.count>0);
    assert.equal(group.transforms.length,group.count*6);
    assert.ok(group.transforms.every(Number.isFinite));
    const proto=sceneryPrototype(group.kind);
    assert.ok(proto.positions.length>0 && proto.indices.length>0);
    assert.ok(proto.positions.length/3<65535);
  }
  assert.ok(scene.woods.length>=1);
  assert.ok(scene.meadow.length>=1);
  assert.ok(scene.settlement.length>=1);
  for(const [name,batches] of Object.entries(scene)){
    for(const batch of batches){
      const count=batch.positions.length/3;
      assert.ok(count<65535,name+" vertex count must fit uint16");
      assert.equal(batch.positions.length,batch.colors.length);
      assert.equal(batch.positions.length,batch.normals.length);
      assert.ok(batch.indices.length>0);
      assert.ok(batch.indices.every(i=>Number.isSafeInteger(i)&&i>=0&&i<count));
      assert.ok(batch.positions.every(Number.isFinite));
    }
  }
});
