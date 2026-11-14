import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const root=new URL("../planet-explorer/",import.meta.url);
const source=readFileSync(new URL("frontier-skinned-renderer.mjs",root),"utf8");
const ui=readFileSync(new URL("avatar-v10-ui.mjs",root),"utf8");
const assets=readFileSync(new URL("avatar-v10-assets.mjs",root),"utf8");
const render=readFileSync(new URL("render.mjs",root),"utf8");

test("GLSL vertex shader declares each float local only once per main scope",()=>{
 const vertex=source.match(/const VS=`([\s\S]*?)`;/)?.[1];
 assert.ok(vertex,"vertex shader template must be present");
 // This is a lexical safeguard for the duplicated 'float chest' regression.
 // OpenGL ES/WebGL compilers reject redeclarations in the same scope.
 const names=[...vertex.matchAll(/\bfloat\s+([A-Za-z_]\w*)\s*=/g)].map(match=>match[1]);
 assert.equal(new Set(names).size,names.length,
  "duplicate float declaration in vertex shader: "+names.filter((v,i)=>names.indexOf(v)!==i).join(", "));
 assert.ok(vertex.includes("float chest=exp("),"previous body-fit chest profile is retained");
 assert.ok(vertex.includes("float reviewChest=exp("),"Review sculpt uses a distinct local mask");
 assert.ok(vertex.includes("uReviewVol.x*reviewChest"),"chest sculpt remains connected");
 assert.ok(vertex.includes("vec3(reviewChest*front"),"soft-part deformation remains connected");
});

test("preview and ship renderer import the same fixed skinned shader",()=>{
 assert.match(assets,/frontier-skinned-renderer\.mjs\?v=20261114-glsl-chest-fix/);
 assert.match(ui,/avatar-v10-assets\.mjs\?v=20261114-glsl-chest-fix/);
 assert.match(render,/avatar-v10-assets\.mjs\?v=20261114-glsl-chest-fix/);
});
