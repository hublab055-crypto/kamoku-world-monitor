import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const source=name=>readFileSync(new URL(name,import.meta.url),"utf8");
test("workshop UI is reachable and live renderer receives state",()=>{
 const app=source("app.mjs"),html=source("index.html"),render=source("render.mjs"),ui=source("workshop-ui.mjs");
 assert.equal((html.match(/id="workshop-open"/g)||[]).length,1);
 assert.match(app,/import \{installWorkshop\} from "\.\/workshop-ui\.mjs/);
 assert.match(app,/workshopRuntime=installWorkshop\(/);
 assert.match(app,/renderer\.workshop=\(\)=>workshopRuntime\?\.state/);
 assert.match(app,/if\(worldActive&&!voyage\?\.active\)workshopRuntime\?\.tick\(worldDt\)/);
 assert.match(render,/this\.drawWorkshop\(vp,light,s,radius\)/);
 assert.match(render,/this\.workshopMeshes\?\.clear\(\)/);
 assert.match(ui,/tickCAM\(state,dt\)/);
 assert.match(ui,/getElementById\("workshop-open"\)/);
});
