import test from "node:test";
import assert from "node:assert/strict";
import {cadAssemblyToAssetDocument} from "../planet-explorer/cad-assembly-bridge.mjs";
import {AssetStudioModel} from "../planet-explorer/asset-studio-model.mjs";

const sample=()=>({
 format:"UE-assembly-v2",units:"mm",mode:"smooth",
 objects:[
  {id:"part1",kind:"assembly",name:"Test Assembly",pos:[0,0,0],rot:[0,0,0],size:[50,35,12],parent:null},
  {id:"part2",kind:"plate",name:"Plate",pos:[0,0,0],rot:[0,0,0],size:[110,70,12],parent:"part1",color:"#539dd0"},
  {id:"part3",kind:"bolt",name:"Bolt",pos:[40,20,14],rot:[0,0,45],size:[9,9,24],parent:"part1",color:"#b3bac5"}
 ],mates:[]
});
test("assembly converts into a validated, editable asset proxy in meters",()=>{
 const result=cadAssemblyToAssetDocument(sample());
 assert.equal(result.converted,2);
 assert.equal(result.document.nodes.length,2);
 assert.equal(result.document.meta.units,"m");
 assert.deepEqual(result.document.nodes.map(n=>n.geometry.shape),["cube","cylinder"]);
 assert.ok(result.document.nodes.every(n=>n.geometry.size.x>=.1));
 assert.ok(new AssetStudioModel(result.document).parts.length===2);
 assert.ok(result.document.nodes[1].transform.rotation.z>0);
});
test("invalid source units, parent references and cycles fail before import",()=>{
 const wrongUnits=sample();wrongUnits.units="m";
 assert.throws(()=>cadAssemblyToAssetDocument(wrongUnits));
 const dangling=sample();dangling.objects[1].parent="missing";
 assert.throws(()=>cadAssemblyToAssetDocument(dangling));
 const cycle=sample();cycle.objects[0].parent="part3";
 assert.throws(()=>cadAssemblyToAssetDocument(cycle));
});
test("source assembly data is not mutated",()=>{
 const original=sample(),before=JSON.stringify(original);
 cadAssemblyToAssetDocument(original);
 assert.equal(JSON.stringify(original),before);
});
