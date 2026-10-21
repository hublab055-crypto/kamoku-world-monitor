/**
 * Deterministic streamed scenery for the Planet Explorer.
 * All world coordinates are metres from the current landing origin. Visual props
 * are not save-game structures and must not be exposed as interactive huts.
 */
import {settlementLayout} from "./settlements.mjs?v=0.8w-alpine-horizon";
import {stationById} from "./railway.mjs?v=0.8x-rail-safety";
import {keepResidentOffRail} from "./railway-security.mjs?v=0.8x-rail-safety";

export const VILLAGE_SITES = Object.freeze([
  {type:"lodge",x:54,z:44,angle:.12},
  {type:"cabin",x:104,z:28,angle:-.25},
  {type:"cabin",x:46,z:102,angle:.18},
  {type:"cabin",x:-68,z:83,angle:-.34},
  {type:"cabin",x:-114,z:-76,angle:.33},
  {type:"barn",x:133,z:-62,angle:.23},
  {type:"workshop",x:85,z:-122,angle:-.18},
  {type:"watchtower",x:-115,z:-115,angle:0},
  {type:"granary",x:-42,z:144,angle:.10},
  {type:"well",x:12,z:78,angle:0},
  {type:"market",x:7,z:-98,angle:-.2},
  {type:"stable",x:173,z:91,angle:.1}
]);
const frac=n=>n-Math.floor(n);
export function sceneryHash(ix,iz,seed=0){
  // Hashing fixed integer cell IDs keeps scenery stationary across LOD changes.
  return frac(Math.sin(ix*127.1+iz*311.7+seed*19.19)*43758.5453);
}
function clearOfBuildings(x,z,sites=VILLAGE_SITES,clearing=0){
  if(Math.hypot(x,z)<(clearing?Math.min(clearing,155):14))return false; // roads and town square
  if(!clearing&&x>0&&x<57&&Math.abs(z-x*.55)<6)return false; // pioneer path
  for(const site of sites){
    const half=site.type==="barn"||site.type==="stable"||site.type==="lodge"?18:12;
    if(Math.abs(x-site.x)<half&&Math.abs(z-site.z)<half)return false;
  }
  return true;
}
/** Height on the actual rendered ground patch, not the unsampled noise surface. */
export function patchSceneryHeight(patch,x,z){
  if(!patch?.vertices||!patch.resolution||!patch.radiusM)return 0;
  const n=patch.resolution,r=patch.radiusM;
  const u=Math.max(0,Math.min(n,(x+r)*n/(2*r)));
  const v=Math.max(0,Math.min(n,(r-z)*n/(2*r)));
  const i=Math.min(n-1,Math.floor(u)),j=Math.min(n-1,Math.floor(v));
  const tx=u-i,tz=v-j,w=n+1,h=(ii,jj)=>patch.vertices[(jj*w+ii)*3+1];
  return h(i,j)*(1-tx)*(1-tz)+h(i+1,j)*tx*(1-tz)+h(i,j+1)*(1-tx)*tz+h(i+1,j+1)*tx*tz;
}
/**
 * The old renderer capped its scattered nature at 80 objects and drew no
 * ground-cover meadow. Dense 3D woods + small meadow blades are independent
 * of assets/network and reproducible for a planet seed.
 */
export function planWorldScenery({seed=77,cx=0,cz=0,radius=450,
    groundAt=()=>300, biomeAt=()=>({water:false,river:false,category:"forest",elevationM:300}),
    settlementId="pioneer"}={}){
  const trees=[],grass=[],buildings=[],people=[];
  const layout=settlementLayout(settlementId);
  const sites=settlementId==="pioneer"?VILLAGE_SITES:layout.buildings;
  const railStation=stationById(settlementId);
  const allowed=(x,z)=>clearOfBuildings(x,z,sites,layout.clearing)&&
   !(railStation&&Math.abs(x-railStation.site.x)<15&&Math.abs(z-railStation.site.z)<380);
  if(radius>4100)return {trees,grass,buildings,people,landmark:null};
  const reach=Math.min(radius*.87,850);
  // A consistent cell grid: no popping/random reshuffle when panning.
  const cell=17; // Retain every existing world cell and tree ID.
  const densityBoost=11; // Parent + 10 more in near field; >=10x after clearing paths.
  const xMin=Math.floor((cx-reach)/cell),xMax=Math.ceil((cx+reach)/cell);
  const zMin=Math.floor((cz-reach)/cell),zMax=Math.ceil((cz+reach)/cell);
  for(let iz=zMin;iz<=zMax;iz++)for(let ix=xMin;ix<=xMax;ix++){
    const jitter=sceneryHash(ix,iz,seed),choice=sceneryHash(ix+31,iz-17,seed);
    const ax=(ix+.15+jitter*.7)*cell,az=(iz+.15+choice*.7)*cell;
    const x=ax-cx,z=az-cz;
    if(x*x+z*z>reach*reach||!allowed(ax,az))continue;
    const distance=Math.hypot(x,z),roll=sceneryHash(ix-11,iz+29,seed);
    // Reject distant LOD first: don't run expensive geographical sampling
    // thousands of times for trees that won't be generated.
    if(distance>430&&roll>.09)continue;
    const biome=biomeAt(ax,az);
    if(biome.water||biome.river||biome.elevationM<60||biome.elevationM>2800)continue;
    // A real open plain must remain open: keep dense groves in forests,
    // sparse trees in meadows and treeless snowy highlands.
    const density=biome.category==="forest"?.89:
      biome.landform==="grassland"||biome.landform==="plain"||biome.category==="plains"?.10:
      biome.category==="mountain"?.25:biome.category==="highland"?.31:.49;
    if(roll>density*(distance>430?.09:1))continue;
    const variation=sceneryHash(ix+97,iz-63,seed);
    // Mature evergreen, autumn deciduous and understorey distributions.
    // Original slot zero keeps legacy types and IDs; new slots add variety.
    const parentType=variation<.075?"boulder":variation<.16?"flowering":variation<.54?"pine":"broadleaf";
    // Preserve original coordinates as slot zero. Extra slots use a stable
    // 4x3 subcell lattice so a forest becomes dense without random clumping.
    const slots=distance<=430?densityBoost:1;
    for(let slot=0;slot<slots;slot++){
      const gx=slot?slot-1:0,noiseA=sceneryHash(ix*13+slot*17,iz*7-slot,seed),
        noiseB=sceneryHash(ix*5-slot*11,iz*19+slot*3,seed);
      const wx=slot?(ix+((gx%4)+.18+noiseA*.64)/4)*cell:ax;
      const wz=slot?(iz+(Math.floor(gx/4)+.18+noiseB*.64)/3)*cell:az;
      if(slot&&!allowed(wx,wz))continue;
      // Exclude the narrow starter-valley stream from subcell trees too.
      // Outside that corridor, avoid the many expensive biome lookups.
      if(slot&&((wx>65&&wx<230)||(wz< -1250&&wz> -4600&&Math.abs(wx)<1350))){
       const water=biomeAt(wx,wz);
       if(water.water||water.river)continue;
      }
      const lx=wx-cx,lz=wz-cz;
      if(lx*lx+lz*lz>reach*reach)continue;
      const v=slot?sceneryHash(ix*23+slot*13,iz*17-slot*7,seed):variation;
      const type=!slot?parentType:
        v<.022?"pebble":v<.070?"iron-deposit":v<.133?"boulder":
        v<.23?"shrub":v<.27?"large-oak":
        v<.39?"maple-red":v<.51?"maple-orange":
        v<.61?"oak-yellow":v<.69?"birch":
        v<.78?"flowering":v<.90?"pine":"broadleaf";
      trees.push({id:"vegetation-"+ix+"-"+iz+(slot?"-"+slot:""),type,
        kind:["boulder","pebble","iron-deposit"].includes(type)?"stone":"wood",
        name:type==="boulder"?"岩":type==="pebble"?"小石":type==="iron-deposit"?"鉄鉱床":type==="large-oak"?"大木":type==="shrub"?"低木":
          type.startsWith("maple")?"カエデ":type==="oak-yellow"?"紅葉したナラ":
          type==="birch"?"シラカバ":"木",
        x:wx,z:wz,localX:lx,localZ:lz,elevationM:groundAt(lx,lz),
        scale: (type==="pebble"?.27:type==="iron-deposit"?1.12:type==="large-oak"?1.5:type==="boulder"?.68:.75)+(slot?noiseA:jitter)*.62,
        rotation:(slot?noiseB:choice)*6.28318});
    }
  }
  // Meadow clumps use a denser mesh but only nearby; high-altitude views
  // show the terrain's vertex colors without generating unnecessary blades.
  if(radius<=900){ // grass blades become subpixel beyond this ground LOD
    const stride=5.5; // Fixed world-space grass grid; no zoom-dependent reshuffle
    for(let iz=Math.floor((cz-reach)/stride);iz<=Math.ceil((cz+reach)/stride);iz++)
      for(let ix=Math.floor((cx-reach)/stride);ix<=Math.ceil((cx+reach)/stride);ix++){
        const a=sceneryHash(ix+1103,iz-771,seed),b=sceneryHash(ix-321,iz+613,seed);
        if(a>.86)continue;
        const ax=(ix+.14+a*.70)*stride,az=(iz+.14+b*.70)*stride,x=ax-cx,z=az-cz;
        if(x*x+z*z>reach*reach||!allowed(ax,az))continue;
        if((ax>65&&ax<230)||(az< -1250&&az> -4600&&Math.abs(ax)<1350)){
         const moisture=biomeAt(ax,az);
         if(moisture.water||moisture.river)continue;
        }
        if(Math.hypot(x,z)>430&&a>.10)continue;
        const y=groundAt(x,z);
        if(y<.15||y>2800)continue;
        const tint=sceneryHash(ix+21,iz+81,seed);
        grass.push({x,z,y,scale:.30+.66*a,rotation:b*6.28318,tint});
        // Additional blades occupy their own deterministic subcells; their
        // GPU geometry is shared via instancing rather than rebuilt per blade.
        if(Math.hypot(x,z)<=430)for(let slot=1;slot<densityBoost;slot++){
          const q=slot-1,h=sceneryHash(ix*7+slot*13,iz*11-slot*3,seed),
            v=sceneryHash(ix*17-slot*19,iz*3+slot*5,seed);
          const wx=(ix+((q%4)+.20+h*.60)/4)*stride;
          const wz=(iz+(Math.floor(q/4)+.20+v*.60)/3)*stride;
          const lx=wx-cx,lz=wz-cz;
          if(lx*lx+lz*lz>reach*reach||!allowed(wx,wz))continue;
          const bladeY=groundAt(lx,lz);
          if(bladeY<.15||bladeY>2800)continue;
          if(wz< -1250&&wz> -4600&&Math.abs(wx)<1350){
            const water=biomeAt(wx,wz);
            if(water.water||water.river)continue;
          }
          grass.push({x:lx,z:lz,y:bladeY,scale:.24+.64*h,
            rotation:v*6.28318,tint:sceneryHash(ix+slot*3,iz-slot*5,seed)});
        }
      }
  }
  for(const [index,site] of sites.entries()){
    const x=site.x-cx,z=site.z-cz;
    if(Math.abs(x)>radius*.96||Math.abs(z)>radius*.96)continue;
    const y=groundAt(x,z);
    if(y<5||y>2800)continue;
    if(settlementId!=="pioneer"){
      const ground=biomeAt(site.x,site.z);
      if(ground.water||ground.river)continue;
    }
    buildings.push({...site,id:"village-"+index,localX:x,localZ:z,elevationM:y});
  }
  for(const resident of layout.residents){
    const safe=keepResidentOffRail(settlementId,resident.x,resident.z);
    const x=safe.x-cx,z=safe.z-cz;
    if(Math.abs(x)>radius*.95||Math.abs(z)>radius*.95)continue;
    const ground=biomeAt(safe.x,safe.z);
    if(ground.water||ground.river)continue;
    people.push({...resident,x:safe.x,z:safe.z,localX:x,localZ:z,elevationM:groundAt(x,z)});
  }
  const marker=layout.landmark;
  const landmark=marker&&Math.abs(marker.x-cx)<radius*.9&&Math.abs(marker.z-cz)<radius*.9&&
    !biomeAt(marker.x,marker.z).water?{
    localX:marker.x-cx,localZ:marker.z-cz,
    elevationM:groundAt(marker.x-cx,marker.z-cz)}:null;
  return {trees,grass,buildings,people,landmark};
}
