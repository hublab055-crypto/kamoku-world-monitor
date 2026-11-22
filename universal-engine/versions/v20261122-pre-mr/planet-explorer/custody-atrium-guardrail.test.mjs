import test from "node:test";
import assert from "node:assert/strict";
import {
  CUSTODY_ATRIUM_RAIL,
  custodyAtriumGuardrailGeometry,
  resolveCustodyAtriumRailCollision
} from "./custody-atrium-guardrail.mjs";

test("atrium rails are continuous on four sides and 1.10m above upper floor",()=>{
  const geo=custodyAtriumGuardrailGeometry();
  assert.ok(geo.positions.length>0);
  assert.equal(geo.positions.length,geo.normals.length);
  assert.equal(geo.positions.length,geo.colors.length);
  assert.equal(geo.indices.length,geo.positions.length/3);
  const points=Array.from({length:geo.positions.length/3},(_,i)=>geo.positions.slice(3*i,3*i+3));
  const yMax=Math.max(...points.map(p=>p[1]));
  assert.ok(Math.abs(yMax-(CUSTODY_ATRIUM_RAIL.floorY+CUSTODY_ATRIUM_RAIL.height))<1e-7);
  for(const [axis,expected] of [["x",CUSTODY_ATRIUM_RAIL.halfWidth],
    ["z",CUSTODY_ATRIUM_RAIL.halfDepth]]){
    assert.ok(points.some(p=>Math.abs(Math.abs(p[axis==="x"?0:2])-expected)<.09));
  }
});

test("standing on the upper gallery may walk alongside the inner railing",()=>{
  const result=resolveCustodyAtriumRailCollision(
    {x:-5.8,z:-2},{x:-5.8,z:2});
  assert.equal(result.blocked,false);
  assert.equal(result.z,2);
});

test("the guardrail stops entry into the void and fast sweeps across it",()=>{
  for(const target of [{x:0,z:0},{x:7,z:0}]){
    const result=resolveCustodyAtriumRailCollision({x:-7,z:0},target);
    assert.equal(result.blocked,true);
    assert.ok(result.x<=-5.8);
  }
});

test("the guardrail prevents diagonal corner crossing",()=>{
  const result=resolveCustodyAtriumRailCollision({x:-7,z:-6},{x:7,z:6});
  assert.equal(result.blocked,true);
});

test("a misplaced loaded avatar can be recovered outside the hole",()=>{
  const result=resolveCustodyAtriumRailCollision({x:0,z:0},{x:1,z:1});
  assert.equal(result.blocked,true);
  assert.equal(result.recovered,true);
  assert.ok(Math.abs(result.z)>=4.8||Math.abs(result.x)>=5.8);
});

test("custom outer dimensions and upper-floor levels are supported",()=>{
  const config={centerX:4,centerZ:2,halfWidth:2,halfDepth:1,floorY:5,height:1.1};
  const geo=custodyAtriumGuardrailGeometry(config);
  let maxY=-Infinity;
  for(let i=1;i<geo.positions.length;i+=3)maxY=Math.max(maxY,geo.positions[i]);
  assert.ok(Math.abs(maxY-6.1)<1e-7);
  const result=resolveCustodyAtriumRailCollision({x:0,z:2},{x:4,z:2},config);
  assert.equal(result.blocked,true);
});
