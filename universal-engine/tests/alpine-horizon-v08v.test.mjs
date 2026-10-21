import test from "node:test";
import assert from "node:assert/strict";
import {Planet} from "../planet/planet-core.mjs";
import {Terrain} from "../planet/terrain-engine.mjs";
import {findLand,geoOffset,terrainSurface,samplePatch} from "../planet-explorer/geo.mjs";
import {regionalLakeMesh,regionalLake} from "../planet-explorer/regional-landforms.mjs";
import {buildDistantLandscape,HORIZON_RADII_M} from "../planet-explorer/distant-landscape.mjs";

const setup=()=>{
 const terrain=new Terrain(new Planet({seed:77}));
 terrain.landscapeAnchor=findLand(terrain,28,42);
 return {terrain,anchor:terrain.landscapeAnchor};
};
const at=(terrain,anchor,x,z)=>{
 const p=geoOffset(anchor.lat,anchor.lon,x,z,terrain.planet.radiusM);
 return terrainSurface(terrain,p.lat,p.lon);
};
test("alpine panorama has a snowy-range elevation beyond the intact village",()=>{
 const {terrain,anchor}=setup();
 const village=at(terrain,anchor,0,0);
 const alpine=at(terrain,anchor,0,8100);
 assert.ok(alpine.elevationM>village.elevationM+1200,"distant mountain must dominate skyline");
 assert.equal(alpine.landform,"mountain-range");
 const patch=samplePatch(terrain,anchor.lat,anchor.lon,450,32);
 assert.equal(patch.vertexCount,33*33);
 assert.ok(patch.vertices.every(Number.isFinite));
});
test("open southern grassland, broad lake basin and river outlet are joined",()=>{
 const {terrain,anchor}=setup();
 const grass=at(terrain,anchor,3500,-4500);
 const lake=at(terrain,anchor,regionalLake.x,regionalLake.z);
 const outlet=at(terrain,anchor,145+21*Math.sin(-2000/155)+9*Math.sin(-2000/61),-2000);
 assert.equal(lake.landform,"lake");
 assert.equal(lake.lake,true);
 assert.equal(lake.river,true);
 assert.ok(lake.waterLevelM>lake.elevationM);
 assert.ok(grass.elevationM>0);
 assert.equal(outlet.landform,"river");
 assert.ok(outlet.waterLevelM>outlet.elevationM);
});
test("lake water sheet matches its elevation and obeys Uint16 index limits",()=>{
 const {terrain,anchor}=setup();
 const center=geoOffset(anchor.lat,anchor.lon,regionalLake.x,regionalLake.z,terrain.planet.radiusM);
 const mesh=regionalLakeMesh(terrain,center,450);
 const count=mesh.positions.length/3;
 assert.ok(count>100&&count<65535);
 assert.equal(mesh.normals.length,mesh.positions.length);
 assert.equal(mesh.colors.length,mesh.positions.length);
 assert.ok(mesh.indices.every(i=>i<count));
 const away=regionalLakeMesh(terrain,anchor,450);
 assert.equal(away.indices.length,0);
});
test("distant geodesic terrain mesh has a natural curved horizon and finite colors",()=>{
 const {terrain,anchor}=setup();
 const far=buildDistantLandscape(terrain,anchor.lat,anchor.lon);
 assert.equal(far.positions.length/3,HORIZON_RADII_M.length*96);
 assert.equal(far.colors.length,far.positions.length);
 assert.equal(far.normals.length,far.positions.length);
 assert.ok(far.indices.length>6000);
 assert.ok(far.indices.every(i=>i>=0&&i<far.positions.length/3));
 assert.ok(far.positions.every(Number.isFinite));
 assert.ok(far.colors.every(c=>Number.isFinite(c)&&c>=0&&c<=1));
 assert.equal(far.outerRadiusM,47000);
});
