import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const file=name=>readFileSync(new URL("../planet-explorer/"+name,import.meta.url),"utf8");
const html=file("index.html"),css=file("style.css"),app=file("app.mjs"),lifeUI=file("lifestyle-ui.mjs");

const byId=id=>new RegExp('id="'+id+'"','g');
test("compact HUD has two immediately visible top controls and a closed quick panel",()=>{
 const bar=html.slice(html.indexOf('<div class="viewport-compact-bar">'),html.indexOf('<div id="viewport-quick-panel"'));
 assert.equal((bar.match(/<button/g)||[]).length,2);
 assert.ok(bar.includes('id="viewport-expand"'));
 assert.ok(bar.includes('id="viewport-quick-toggle"'));
 assert.match(html,/<div id="viewport-quick-panel"[^>]* hidden/);
 assert.match(html,/id="viewport-quick-toggle" aria-expanded="false"/);
 assert.match(css,/\.viewport-quick-panel\[hidden\]/);
});
test("existing camera, RTS, automation, books, life and full settings remain accessible",()=>{
 const buttons=["viewport-camera","viewport-controls","viewport-rts","viewport-auto","viewport-books","viewport-life","viewport-menu","viewport-expand"];
 for(const id of buttons)assert.equal((html.match(byId(id))||[]).length,1,id);
 const menu=html.slice(html.indexOf('id="viewport-quick-panel"'),html.indexOf('id="stick-area"'));
 for(const id of buttons.filter(x=>x!=="viewport-expand"))assert.ok(menu.includes('id="'+id+'"'),id);
 for(const anchor of ["viewport-camera","viewport-controls","viewport-rts","viewport-auto","viewport-books","viewport-life","viewport-menu"])
   assert.ok((app+lifeUI).includes('"'+anchor+'"'),anchor);
});
test("tools are behind a toggle, while jump remains a direct action",()=>{
 const action=html.slice(html.indexOf('id="action-pad"'),html.indexOf('id="rts-controls"'));
 assert.ok(action.includes('id="jump"'));
 assert.ok(action.includes('id="action-tools-toggle" aria-expanded="false"'));
 assert.match(action,/id="action-tool-list"[^>]*hidden/);
 for(const id of ["action-sword","action-axe","action-mine","action-build"])
  assert.equal((action.match(byId(id))||[]).length,1,id);
 assert.match(css,/\.action-tool-list\[hidden\]/);
});
test("door context is hidden until nearby, with an accessible toggle",()=>{
 const segment=html.slice(html.indexOf('id="door-controls"'),html.indexOf('id="action-pad"'));
 assert.ok(segment.includes('id="door-actions-toggle" aria-expanded="false"'));
 assert.ok(segment.includes('id="door-options"'));
 for(const id of ["door-toggle","door-enter","door-exit","door-shelf"])
  assert.ok(segment.includes('id="'+id+'"'));
 assert.match(app,/if\(!active\)\{setDoorMenu\(false\);return;\}/);
 assert.match(css,/\.door-options\[hidden\]/);
});
test("compact menu state synchronizes aria-expanded and dismisses upon canvas taps and Escape",()=>{
 for(const part of [
  'function setQuickMenu(open)','function setToolMenu(open)','function setDoorMenu(open)',
  'function closeCompactMenus()','quickToggle.addEventListener("click"',
  'toolToggle.addEventListener("click"','doorToggle.addEventListener("click"',
  'document.addEventListener("pointerdown"',
  'if(!e.target.closest(".viewport-actions"))setQuickMenu(false)',
  'if(!e.target.closest(".action-pad"))setToolMenu(false)',
  'if(!e.target.closest(".door-controls"))setDoorMenu(false)',
  'if(!quickPanel.hidden||!toolPanel.hidden||!doorPanel.hidden)']){
  assert.ok(app.includes(part),part);
 }
 for(const name of ["quickToggle","toolToggle","doorToggle"])
  assert.match(app,new RegExp(name+'\\.setAttribute\\("aria-expanded",String\\(open\\)\\)'));
});
test("compact touch controls and safe areas are still operable on narrow mobile screens",()=>{
 assert.match(css,/@media\(max-width:760px\)/);
 assert.match(css,/viewport-compact-bar #viewport-expand\{width:41px/);
 assert.match(css,/\.action-pad>button\{height:44px/);
 assert.match(css,/safe-area-inset-bottom/);
 assert.match(css,/\.viewport-quick-panel\{width:min\(234px/);
 assert.match(css,/\.door-controls\{bottom:calc\(73px/);
 assert.match(css,/\.viewport-quick-panel button\{min-height:42px/);
});
