export function adjustDryWorld(terrain,id){
 if(id==="terra")return;
 const sample=terrain.sample.bind(terrain);
 terrain.sample=(lat,lon)=>{
  const s=sample(lat,lon);
  return {...s,water:false,river:false,
   elevationM:s.water?200+Math.min(1400,Math.abs(s.elevationM)*.15):s.elevationM,
   category:id==="nix"?"tundra":"highland"};
 };
}
