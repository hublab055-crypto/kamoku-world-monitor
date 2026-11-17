import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {AVATAR_DAILY_ACTIONS,sampleAvatarDailyPose} from "../avatar-daily-actions.mjs";
const read=name=>readFileSync(new URL("../"+name,import.meta.url),"utf8");
test("all newly added motions are wired into game menu and V10 renderer",()=>{
 const html=read("index.html"),app=read("app.mjs"),renderer=read("render.mjs");
 const names=["wave","stretch","kneel","pelvicTilt","supportedSquat","laborBreathing","sideRest","rockBaby"];
 for(const action of names){
  assert(AVATAR_DAILY_ACTIONS[action],"missing action "+action);
  assert(html.includes('value="'+action+'"'),"menu option missing "+action);
  assert(renderer.includes('"'+action+'"'),"game renderer whitelist missing "+action);
  const pose=sampleAvatarDailyPose(action,{time:1.5,progress:.4});
  assert(pose&&Object.values(pose).every(Number.isFinite));
 }
 assert(app.includes('avatar-daily-extended'));
 assert(app.includes('activateAvatarDaily(action)'));
 assert(html.includes("avatar-daily-extended"));
});
