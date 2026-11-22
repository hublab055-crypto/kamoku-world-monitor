import test from "node:test";
import assert from "node:assert/strict";
import {Planet} from "../planet/planet-core.mjs";
import {Terrain} from "../planet/terrain-engine.mjs";
import {findLand,geoOffset,terrainSurface,samplePatch} from "../planet-explorer/geo.mjs";
import {riverCenterX,riverHalfWidth,riverLevel,frontierValleyAt,buildRiverWaterPatch} from "../planet-explorer/landscape-relief.mjs";

function valley(){
 const p=new Planet({seed:77}),terrain=new Terrain(p);
 terrain.landscapeAnchor=findLand(terrain,28,42);
 return {p,terrain,anchor:terrain.landscapeAnchor};
}
const at=(terrain,anchor,x,z)=>{const g=geoOffset(anchor.lat,anchor.lon,x,z,terrain.planet.radiusM);return terrainSurface(terrain,g.lat,g.lon);};
test("river cuts a real channel and water stays above the bed below the two banks",()=>{
 const {terrain,anchor}=valley(),z=40,center=riverCenterX(z),width=riverHalfWidth(z);
 const middle=at(terrain,anchor,center,z),left=at(terrain,anchor,center-width*1.70,z),right=at(terrain,anchor,center+width*1.70,z);
 assert.equal(middle.landform,"river");assert.equal(middle.river,true);
 assert.ok(middle.elevationM<middle.waterLevelM,"bed below water surface");
 assert.ok(middle.elevationM<left.elevationM&&middle.elevationM<right.elevationM,"waterway incised between banks");
 assert.ok(Math.abs(middle.waterLevelM-riverLevel(anchor,z))<.000001);
});
test("mountains rise toward north, western hills and canyon incise western ridge",()=>{
 const {terrain,anchor}=valley();
 const base=at(terrain,anchor,0,10);
 const peak=at(terrain,anchor,0,690);
 const hill=at(terrain,anchor,-420,40);
 const canyon=at(terrain,anchor,-305+34*Math.sin(40/145),40);
 assert.ok(peak.elevationM-base.elevationM>60,"northern mountain rise");
 assert.ok(hill.elevationM>canyon.elevationM+30,"canyon carved below neighboring hill");
 assert.ok(["canyon","hills","mountain-range"].includes(canyon.landform)||canyon.elevationM<hill.elevationM);
});
test("render water geometry uses valid compact WebGL Uint16 indices",()=>{
 const {terrain,anchor}=valley();
 const mesh=buildRiverWaterPatch(terrain,{lat:anchor.lat,lon:anchor.lon},450);
 assert.ok(mesh.indices.length>40,"riverwater visible on starter ground patch");
 const verts=mesh.positions.length/3;
 assert.ok(verts>0&&verts<65535);
 assert.equal(mesh.normals.length,mesh.positions.length);
 assert.equal(mesh.colors.length,mesh.positions.length);
 assert.ok(mesh.indices.every(i=>i>=0&&i<verts));
 assert.ok(mesh.positions.every(Number.isFinite));
 const off=geoOffset(anchor.lat,anchor.lon,11000,0,terrain.planet.radiusM);
 assert.equal(buildRiverWaterPatch(terrain,off,450).indices.length,0);
});
test("ground mesh and physics use the same eroded riverbed elevations",()=>{
 const {terrain,anchor}=valley(),point=geoOffset(anchor.lat,anchor.lon,riverCenterX(0),0,terrain.planet.radiusM);
 const v=terrainSurface(terrain,point.lat,point.lon);
 assert.ok(v.river);
 const patch=samplePatch(terrain,anchor.lat,anchor.lon,450,64);
 assert.equal(patch.vertexCount,65*65);
 assert.ok(patch.indices.length>500);
 // Earthworks remains layered on top of the carved channel.
 const before=at(terrain,anchor,-100,0).elevationM;
 terrain.earthworks={deltaAt:()=>-2};
 assert.equal(at(terrain,anchor,-100,0).elevationM,before-2);
});
