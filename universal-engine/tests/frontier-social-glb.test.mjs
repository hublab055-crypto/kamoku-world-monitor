import test from "node:test";
import assert from "node:assert/strict";
import {SocialEquipment} from "../planet-explorer/social-equipment.mjs";
import {parseFrontierGLB} from "../planet-explorer/frontier-glb.mjs";
import {Planet} from "../planet/planet-core.mjs";
import {Terrain} from "../planet/terrain-engine.mjs";
import {ExplorerController} from "../planet-explorer/controller.mjs";
import {Actions} from "../planet-explorer/actions.mjs";
import {SquadEngine} from "../planet-explorer/squad.mjs";
import {Lifestyle} from "../planet-explorer/lifestyle.mjs";

function setup(){
 const terrain=new Terrain(new Planet({seed:77})),control=new ExplorerController(terrain);
 const actions=new Actions(),squad=new SquadEngine(terrain,control,actions);
 const life=new Lifestyle(),social=new SocialEquipment();
 squad.attachLifestyle(life);
 // The pair is physically near each other when this test begins.
 squad.get("scout").control.x=control.x+2;
 squad.get("scout").control.z=control.z;
 return {squad,life,social};
}
test("five item slots select/use/equip independently for each avatar",()=>{
 const {social,life,squad}=setup();
 assert.equal(social.actor("player").slots.length,5);
 assert.equal(social.equip("scout",4,"meal"),true);
 assert.equal(social.actor("player").slots[4],"book");
 assert.equal(social.select("player",3),true);
 assert.equal(social.chosen("player"),"cup");
 const before=life.inventory.water;
 const result=social.use(squad.get("player"),life,squad.frontier);
 assert.equal(result.ok,true);
 assert.equal(life.inventory.water,before-1);
 const saved=new SocialEquipment(social.snapshot());
 assert.equal(saved.chosen("player"),"cup");
 assert.equal(saved.actor("scout").slots[4],"meal");
 assert.equal(saved.equip("player",5,"axe"),false);
});
test("talk and gifts need proximity; gifts transfer exactly once and persist",()=>{
 const {social,life,squad}=setup();
 const a=squad.get("player"),b=squad.get("scout"),f=squad.frontier;
 assert.equal(social.talk(a,b).ok,true);
 assert.equal(social.relation("player","scout"),41);
 const initial=life.inventory.cup;
 const gift=social.gift(a,b,"cup",life,f);
 assert.equal(gift.ok,true);
 assert.equal(life.inventory.cup,initial-1);
 assert.equal(f.person("scout").gifts.cup,1);
 assert.equal(social.relation("player","scout"),45);
 const squadClone=new SquadEngine(squad.terrain,a.control,squad.actions,squad.snapshot());
 assert.equal(squadClone.frontier.person("scout").gifts.cup,1);
 const socialClone=new SocialEquipment(social.snapshot());
 assert.equal(socialClone.history.length,2);
 b.control.x=a.control.x+10;
 const blocked=social.gift(a,b,"cup",life,f);
 assert.equal(blocked.ok,false);
 assert.equal(life.inventory.cup,initial-1);
});
test("hotbar returns a deploy request for bedroll and an animation action for axe",()=>{
 const {social,squad,life}=setup(),actor=squad.get("player");
 social.equip("player",0,"bedroll");
 assert.deepEqual(social.use(actor,life,squad.frontier),{ok:true,kind:"deploy",item:"bedroll"});
 social.equip("player",0,"axe");
 assert.deepEqual(social.use(actor,life,squad.frontier),{ok:true,kind:"action",action:"axe"});
});
function syntheticGLB(){
 const json={asset:{version:"2.0"},scene:0,scenes:[{nodes:[0]}],nodes:[{mesh:0}],
  meshes:[{primitives:[{attributes:{POSITION:0,NORMAL:1},indices:2,mode:4}]}],
  buffers:[{byteLength:78}],
  bufferViews:[{buffer:0,byteOffset:0,byteLength:36},{buffer:0,byteOffset:36,byteLength:36},{buffer:0,byteOffset:72,byteLength:6}],
  accessors:[{bufferView:0,componentType:5126,count:3,type:"VEC3"},
    {bufferView:1,componentType:5126,count:3,type:"VEC3"},
    {bufferView:2,componentType:5123,count:3,type:"SCALAR"}]};
 const j=new TextEncoder().encode(JSON.stringify(json));
 const paddedJson=(j.length+3)&~3,binLength=80,total=12+8+paddedJson+8+binLength;
 const buffer=new ArrayBuffer(total),view=new DataView(buffer);
 view.setUint32(0,0x46546c67,true);view.setUint32(4,2,true);view.setUint32(8,total,true);
 view.setUint32(12,paddedJson,true);view.setUint32(16,0x4e4f534a,true);
 const text=new Uint8Array(buffer,20,paddedJson);text.fill(32);text.set(j);
 const start=20+paddedJson;view.setUint32(start,binLength,true);view.setUint32(start+4,0x004e4942,true);
 const byteStart=start+8;
 [0,0,0,1,0,0,0,2,0].forEach((n,i)=>view.setFloat32(byteStart+i*4,n,true));
 for(let i=0;i<3;i++)for(let j=0;j<3;j++)view.setFloat32(byteStart+36+(i*3+j)*4,j===1?1:0,true);
 for(let i=0;i<3;i++)view.setUint16(byteStart+72+i*2,i,true);
 return buffer;
}
test("GLB2 geometry can be parsed with vertex data and normalized to 1.8m",()=>{
 const glb=parseFrontierGLB(syntheticGLB());
 assert.equal(glb.triangles,1);assert.equal(glb.chunks.length,1);
 assert.equal(glb.chunks[0].positions.length,9);
 assert.equal(Math.max(...glb.chunks[0].positions.filter((_,i)=>i%3===1)),1.8);
 assert.throws(()=>parseFrontierGLB(new ArrayBuffer(28)),/GLB/);
});
