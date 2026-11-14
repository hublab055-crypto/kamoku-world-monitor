import test from "node:test";
import assert from "node:assert/strict";
import {sampleShipVRStanding} from "./ship-vr-standing.mjs";
const run=(state,headY,seated=true,dt=.1)=>sampleShipVRStanding(state,{seated,headY,dt});
test("sitting to physical standing triggers cabin walk after a sustained head rise",()=>{
 let state=null;
 for(let i=0;i<6;i++)({state}=run(state,1.17));
 let result={};
 for(let i=0;i<4;i++){result=run(state,1.68);state=result.state;}
 assert.equal(result.stand,true);
});
test("head nods, brief tracking jumps and disabled cabin posture do not stand avatar",()=>{
 let state=null;
 for(let i=0;i<5;i++)({state}=run(state,1.17));
 assert.equal(run(state,1.31).stand,false);
 assert.equal(run(state,1.85).stand,false);
 assert.equal(run(state,1.85,false).stand,false);
 assert.equal(sampleShipVRStanding(state,{seated:true,headY:NaN,dt:.1}).stand,false);
});
test("starting VR already standing does not leave pilot seat automatically",()=>{
 let state=null;
 for(let i=0;i<8;i++){const r=run(state,1.69);state=r.state;assert.equal(r.stand,false);}
});
