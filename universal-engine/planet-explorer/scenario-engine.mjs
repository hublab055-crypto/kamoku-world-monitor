// Optional scenario module. Existing sandbox saves remain unchanged.
export const SCENARIO_VERSION=1;
export const SCENARIO_DISCIPLINES=["fantasy","modern-combat","courtroom","profession","rts","programming","modeling","music","gallery"];
export const CIVILIZATION_PATHS=["federation","conquest","economy","research","culture"];
export const SCENARIO_CHAPTERS=["traveler","city-states","continental-politics","planetary","stellar","galactic"];
const copy=x=>JSON.parse(JSON.stringify(x));
export function createScenario(snapshot=null){
 const s={version:1,mode:"sandbox",chapter:"traveler",generation:1,quests:{},history:[],energyWatts:0,creations:[]};
 if(snapshot){if(snapshot.version!==1)throw Error("Unsupported scenario version");if(["story","sandbox"].includes(snapshot.mode))s.mode=snapshot.mode;if(SCENARIO_CHAPTERS.includes(snapshot.chapter))s.chapter=snapshot.chapter;if(Number.isSafeInteger(snapshot.generation)&&snapshot.generation>0)s.generation=snapshot.generation;if(snapshot.quests&&typeof snapshot.quests==="object"&&!Array.isArray(snapshot.quests))s.quests=copy(snapshot.quests);if(Array.isArray(snapshot.history))s.history=copy(snapshot.history.slice(-1000));if(Array.isArray(snapshot.creations))s.creations=copy(snapshot.creations.slice(-1000));if(Number.isFinite(snapshot.energyWatts)&&snapshot.energyWatts>=0)s.energyWatts=snapshot.energyWatts;}
 const event=(type,data)=>{s.history.push({type,data:copy(data),generation:s.generation});if(s.history.length>1000)s.history.shift();};
 return {snapshot:()=>copy(s),start(mode){if(!["story","sandbox"].includes(mode))throw Error("Invalid mode");s.mode=mode;event("mode",{mode});},
 addQuest(q){if(!q||typeof q.id!=="string"||!q.id||typeof q.title!=="string"||s.quests[q.id])throw Error("Invalid quest");s.quests[q.id]={id:q.id,title:q.title,discipline:SCENARIO_DISCIPLINES.includes(q.discipline)?q.discipline:"profession",choices:copy(q.choices||[]),status:"available"};},
 resolve(id,choice){const q=s.quests[id];if(!q||q.status!=="available"||!q.choices.some(c=>c.id===choice))throw Error("Invalid choice");q.status="resolved";q.choice=choice;event("quest",{id,choice});},
 advance(chapter){if(!SCENARIO_CHAPTERS.includes(chapter))throw Error("Invalid chapter");s.chapter=chapter;event("chapter",{chapter});},
 inherit(heir){if(typeof heir!=="string"||!heir.trim())throw Error("Invalid heir");s.generation++;event("inheritance",{heir});},
 setEnergy(watts){if(!Number.isFinite(watts)||watts<0)throw Error("Invalid energy");s.energyWatts=watts;},
 kardashev(){return s.energyWatts>0?(Math.log10(s.energyWatts)-6)/10:null;},
 addCreation(c){if(!c||!["program","model","music","illustration"].includes(c.kind)||typeof c.id!=="string"||!c.id||typeof c.title!=="string"||typeof c.assetRef!=="string"||s.creations.some(x=>x.id===c.id))throw Error("Invalid creation");s.creations.push(copy(c));event("creation",{id:c.id,kind:c.kind});}
 };
}
export const INTRO_QUESTS=[
{id:"first-journey",title:"旅の始まり",discipline:"profession",choices:[{id:"help",label:"村を手伝う"},{id:"explore",label:"探索する"}]},
{id:"bridge-dispute",title:"橋の向こうの村",discipline:"courtroom",choices:[{id:"negotiate",label:"交渉"},{id:"repair",label:"修復"},{id:"decline",label:"見送る"}]},
{id:"dragon-encounter",title:"竜との遭遇",discipline:"fantasy",choices:[{id:"defend",label:"守る"},{id:"research",label:"研究する"},{id:"retreat",label:"撤退する"}]}
];