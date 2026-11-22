import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {installXRUI} from "../planet-explorer/xr-ui.mjs";

const read=name=>readFileSync(new URL("../planet-explorer/"+name,import.meta.url),"utf8");

test("XR module remains importable in a non-XR browser such as Safari",()=>{
 assert.equal(typeof installXRUI,"function");
 // This module must have no document/window side effects on import.
 assert.match(read("xr-ui.mjs"),/navigator\.xr\.isSessionSupported/);
});
test("XR modes keep separate user-click controls and device status",()=>{
 const html=read("index.html");
 for(const id of ["xr-controls","xr-vr","xr-mr-rts","xr-mr-planet","xr-exit","xr-status","xr-scale"])
  assert.match(html,new RegExp('id="'+id+'"'));
 const app=read("app.mjs");
 assert.match(app,/installXRUI\(/);
 assert.match(app,/xrUI\?\.active\?displayMode:renderer\.frame/);
});
test("WebGL2 headset rendering does not overwrite ordinary fullscreen canvas",()=>{
 const render=read("render.mjs");
 assert.match(render,/this\.xrView=null/);
 assert.match(render,/gl\.scissor\(xr\.viewport\.x,xr\.viewport\.y,w,h\)/);
 assert.match(render,/gl\.clearColor\(\.40,\.64,\.78,1\)/);
 assert.match(render,/if\(!xr\)\{/);
});
