import {createCelestialPlanet} from "./solar-system.mjs";
export function freshCelestialSave(source,id,days){
 const next=JSON.parse(JSON.stringify(source));
 next.planet=createCelestialPlanet(id,days).snapshot();
 next.explorer={...next.explorer,origin:{lat:28,lon:42},x:0,z:0,
  altitudeM:16000000,targetAltitudeM:16000000,travelMode:"walk",moveTarget:null,jumpY:0,jumpV:0};
 next.actions.structures=[];next.actions.active=null;
 next.v0_7e={insideId:null};
 next.v0_7g={...source.v0_7g,furnishings:[],chestContents:{},chestWeightsKg:{},
  deployments:[],initializedHuts:[],activity:"idle",activityFurnitureId:null,insideTentId:null};
 if(next.v0_7d?.squad?.frontier){
  next.v0_7d.squad.frontier.nodes=[];
  next.v0_7d.squad.frontier.base={x:0,z:0};
 }
 for(const key of ["v0_8a","v0_8e","v0_8f","v0_8g","v0_8t","v0_8w",
  "v0_9f","v0_9g","v0_8y","v0_9d","v0_9z","v0_9u"])delete next[key];
 next.v0_8r={schemaVersion:1,destinationId:"wilderness"};
 next.v0_8s=null;
 if(next.v0_8x)next.v0_8x.security=null;
 delete next.v0_aa;
 return next;
}
export function carryCelestialInventory(next,current){
 next.avatarStyle=current.avatarStyle;
 for(const key of ["v0_7b","v0_7i","v0_9n","v0_9v"])next[key]=current[key];
 next.actions.resources={...current.actions.resources};
 if(next.v0_7d?.squad?.frontier&&current.v0_7d?.squad?.frontier)
  next.v0_7d.squad.frontier.people=current.v0_7d.squad.frontier.people;
 if(next.v0_8s&&current.v0_8s)next.v0_8s.coins=current.v0_8s.coins;
 if(next.v0_8x&&current.v0_8x)next.v0_8x.timeScale=current.v0_8x.timeScale;
 return next;
}
