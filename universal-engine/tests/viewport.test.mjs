import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const view = readFileSync(new URL("../planet-explorer/index.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../planet-explorer/style.css", import.meta.url), "utf8");
const app = readFileSync(new URL("../planet-explorer/app.mjs", import.meta.url), "utf8");

test("3D stage has visible fullscreen toggle and remains accessible", () => {
  assert.match(view, /id="fullscreen-toggle"/);
  assert.match(view, /aria-pressed="false"/);
  assert.match(view, /id="world"/);
  assert.match(view, /id="stick-area"/);
  assert.match(view, /id="action-pad"/);
});

test("normal desktop and phone have enlarged 3D canvas", () => {
  assert.match(css, /72dvh/);
  assert.match(css, /76dvh/);
  assert.match(css, /\.view-panel #world\{width:100%;height:100%/);
  assert.match(css, /calc\(100% - 12px\)/);
});

test("fullscreen works natively or with an iPhone-compatible CSS fallback", () => {
  assert.match(css, /\.view-panel:fullscreen/);
  assert.match(css, /\.view-panel\.immersive/);
  assert.match(css, /body\.immersive\{overflow:hidden\}/);
  assert.match(app, /stage\.requestFullscreen/);
  assert.match(app, /cssImmersive=true/);
  assert.match(app, /stage\.classList\.add\("immersive"\)/);
  assert.match(app, /stage\.classList\.remove\("immersive"\)/);
  assert.match(app, /syncFullscreenButton/);
});

test("enlargement preserves the game controls and 3D hit target", () => {
  for(const id of ["ground-button","orbit-button","mode-stick","mode-tap","jump","action-build"]){
    assert.ok(view.includes('id="' + id + '"'), "missing control "+id);
  }
  assert.match(app, /pickGround/);
  assert.match(app, /stickArea/);
  assert.match(css, /\.view-panel\.immersive \.canvas-wrap/);
});
