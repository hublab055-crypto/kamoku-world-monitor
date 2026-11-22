import test from "node:test";
import assert from "node:assert/strict";
import {TREE_FALL_SECONDS,fallingTreeYaw,fallingTreeAngle,scaledMatrix} from "../planet-explorer/tree-fall.mjs";
import {groundCloudGeometry,cloudWind} from "../planet-explorer/ground-clouds.mjs";
import {ResourceHarvest} from "../planet-explorer/resource-harvest.mjs";
import {Weather} from "../planet/weather-engine.mjs";
import {Planet} from "../planet/planet-core.mjs";

test("axe-felled trees have a reproducible directional hinged fall",()=>{
 const node={id:"tree-44",kind:"wood",type:"maple-red"};
 const harvest=new ResourceHarvest();
 const yaw=fallingTreeYaw(node.id);
 assert.equal(yaw,fallingTreeYaw(node.id));
 assert.ok(yaw>=0&&yaw<Math.PI*2);
 assert.notEqual(yaw,fallingTreeYaw("tree-45"));
 assert.equal(fallingTreeAngle(-5),0);
 assert.equal(fallingTreeAngle(0),0);
 assert.ok(fallingTreeAngle(TREE_FALL_SECONDS*.5)>0);
 assert.ok(fallingTreeAngle(TREE_FALL_SECONDS*.85)>fallingTreeAngle(TREE_FALL_SECONDS*.5));
 assert.ok(fallingTreeAngle(TREE_FALL_SECONDS)<=Math.PI/2);
 assert.equal(fallingTreeAngle(TREE_FALL_SECONDS+20),fallingTreeAngle(TREE_FALL_SECONDS));
 assert.equal(scaledMatrix(1).length,16);
 assert.ok(scaledMatrix(1.4).every(Number.isFinite));
 let result;
 for(let i=0;i<3;i++)result=harvest.hit(node,"axe");
 assert.equal(result.stage,"felled");
 assert.equal(harvest.visual(node).type,"fallen-log");
 assert.equal(new ResourceHarvest(harvest.snapshot()).visual(node).type,"fallen-log");
});

test("wind responds to cloud cover, precipitation and simulated planetary conditions",()=>{
 const sun={cloudCover:.10,precipitation:"none"},storm={cloudCover:.91,precipitation:"rain"};
 const light=cloudWind(sun,35,18),wet=cloudWind(storm,35,18);
 assert.ok(wet.opacity>light.opacity);
 assert.ok(Math.hypot(wet.eastMps,wet.northMps)>Math.hypot(light.eastMps,light.northMps));
 assert.notDeepEqual(cloudWind(storm,35,18),cloudWind(storm,-40,37));
 assert.deepEqual(cloudWind(storm,35,18),cloudWind(storm,35,18));
 const planet=new Planet({seed:77}),weather=new Weather(planet);
 const climate=weather.sample(35,47,150);
 const motion=cloudWind(climate,35,planet.timeDays);
 assert.ok(motion.opacity>=.04&&motion.opacity<=.76);
 assert.ok(Number.isFinite(motion.eastMps)&&Number.isFinite(motion.northMps));
});

test("rebuilding a cloud chunk at current world drift is seamless with transform animation",()=>{
 const a=groundCloudGeometry({radius:450,seed:77,cx:0,cz:0,cloudCover:.6,driftEast:0});
 const b=groundCloudGeometry({radius:450,seed:77,cx:0,cz:0,cloudCover:.6,driftEast:30});
 assert.equal(a.positions.length,b.positions.length);
 assert.equal(a.indices.length,b.indices.length);
 for(let k=0;k<Math.min(90,a.positions.length);k+=3){
  assert.ok(Math.abs(b.positions[k]-a.positions[k]-30)<1e-6);
  assert.equal(b.positions[k+1],a.positions[k+1]);
 }
 const empty=groundCloudGeometry({radius:12500,cloudCover:.6});
 assert.equal(empty.indices.length,0);
});

test("rain-darkened clouds have valid RGBA-ready vertex colors and denser coverage",()=>{
 const sunny=groundCloudGeometry({seed:77,radius:450,cloudCover:.15,precipitation:"none"});
 const rainy=groundCloudGeometry({seed:77,radius:450,cloudCover:.90,precipitation:"rain"});
 assert.ok(rainy.indices.length>=sunny.indices.length);
 assert.ok(rainy.colors[0]<1);
 assert.ok(rainy.colors.every(Number.isFinite));
 assert.ok(rainy.indices.every(i=>i<rainy.positions.length/3));
 assert.ok(rainy.positions.length/3<65535);
});
