import {geoOffset,clamp,findLand,wrapLon,terrainSurface} from "./geo.mjs";

/**
 * Single landing-site geographic authority: the globe camera and streamed ground
 * use the same latitude/longitude. Local (x,z) metres always resolve via geoOffset.
 */
export class ExplorerController {
  constructor(terrain,{startLat=28,startLon=42}={}){
    this.terrain=terrain;
    const site=findLand(terrain,startLat,startLon);
    this.origin={lat:site.lat,lon:site.lon};
    this.x=0;this.z=0;this.lat=site.lat;this.lon=site.lon;
    this.yaw=0;this.altitudeM=16000000;this.targetAltitudeM=16000000;
    this.walkSpeed=5;this.totalDistanceM=0;this.blocked=false;
  }
  get nearGround(){return this.altitudeM<=12.01}
  setLanding(lat,lon){
    const s=terrainSurface(this.terrain,lat,lon);
    if(s.water)throw new Error("着陸地点は陸地を選択してください。");
    this.origin={lat,lon:wrapLon(lon)};
    this.x=0;this.z=0;this.lat=lat;this.lon=wrapLon(lon);
  }
  targetAltitude(value){
    if(!Number.isFinite(value))throw new TypeError("Invalid altitude");
    this.targetAltitudeM=clamp(value,2.5,50000000);
    return this.targetAltitudeM;
  }
  zoom(factor){
    if(!Number.isFinite(factor)||factor<=0)throw new TypeError("Invalid zoom factor");
    return this.targetAltitude(this.targetAltitudeM*factor);
  }
  turn(deltaRadians){
    if(!Number.isFinite(deltaRadians))throw new TypeError("Invalid yaw");
    this.yaw=(this.yaw+deltaRadians)%(2*Math.PI);
    return this.yaw;
  }
  update(dt,{forward=0,strafe=0,turn=0}={}){
    if(!Number.isFinite(dt)||dt<0)throw new TypeError("Invalid frame delta");
    dt=clamp(dt,0,.1);
    const response=1-Math.exp(-dt*2.15);
    // Log-altitude interpolation covers orbit-to-ground in seconds at every scale.
    const nextLog=Math.log(this.altitudeM)+(Math.log(this.targetAltitudeM)-Math.log(this.altitudeM))*response;
    this.altitudeM=Math.exp(nextLog);
    if(Math.abs(Math.log(this.targetAltitudeM/this.altitudeM))<.003) this.altitudeM=this.targetAltitudeM;
    this.turn(clamp(turn,-1,1)*dt*1.7);
    if(this.altitudeM>12.01){this.blocked=false;return;}
    if(![forward,strafe].every(Number.isFinite))throw new TypeError("Invalid walking controls");
    let f=clamp(forward,-1,1),s=clamp(strafe,-1,1);
    const len=Math.hypot(f,s);if(len>1){f/=len;s/=len;}
    const step=this.walkSpeed*dt;
    const east=step*(Math.sin(this.yaw)*f+Math.cos(this.yaw)*s);
    const north=step*(Math.cos(this.yaw)*f-Math.sin(this.yaw)*s);
    if(Math.hypot(east,north)<1e-9){this.blocked=false;return;}
    const x=this.x+east,z=this.z+north;
    const next=geoOffset(this.origin.lat,this.origin.lon,x,z,this.terrain.planet.radiusM);
    const sample=terrainSurface(this.terrain,next.lat,next.lon);
    const present=terrainSurface(this.terrain,this.lat,this.lon);
    // Water, steep vertical steps, and terrain > 2800m are blocked for the MVP.
    const blocked=sample.water||sample.river||sample.elevationM>2800||
      Math.abs(sample.elevationM-present.elevationM)>Math.max(1.8,Math.hypot(east,north)*1.65);
    this.blocked=blocked;
    if(!blocked){
      this.x=x;this.z=z;this.lat=next.lat;this.lon=next.lon;
      this.totalDistanceM+=Math.hypot(east,north);
    }
  }
  snapshot(){return {format:"ue/explorer",version:1,origin:{...this.origin},
    x:this.x,z:this.z,yaw:this.yaw,altitudeM:this.altitudeM,
    targetAltitudeM:this.targetAltitudeM,totalDistanceM:this.totalDistanceM};}
  static fromSnapshot(terrain,data){
    if(!data||data.format!=="ue/explorer"||data.version!==1)throw Error("Unsupported explorer snapshot");
    const t=new ExplorerController(terrain,{startLat:data.origin?.lat,startLon:data.origin?.lon});
    if(![data.x,data.z,data.yaw,data.altitudeM,data.targetAltitudeM,data.totalDistanceM].every(Number.isFinite))throw Error("Invalid explorer values");
    if(data.altitudeM<2.5||data.targetAltitudeM<2.5||data.totalDistanceM<0)throw Error("Invalid saved altitude or distance");
    t.origin={lat:data.origin.lat,lon:wrapLon(data.origin.lon)};
    t.x=data.x;t.z=data.z;t.yaw=data.yaw;t.altitudeM=data.altitudeM;
    t.targetAltitudeM=data.targetAltitudeM;t.totalDistanceM=data.totalDistanceM;
    const here=geoOffset(t.origin.lat,t.origin.lon,t.x,t.z,terrain.planet.radiusM);
    t.lat=here.lat;t.lon=here.lon;
    return t;
  }
}