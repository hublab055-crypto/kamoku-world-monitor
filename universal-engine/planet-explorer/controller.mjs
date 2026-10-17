import {geoOffset,clamp,findLand,wrapLon,terrainSurface} from "./geo.mjs?v=0.8b-river-valley";
import {smoothAltitude} from "./descent-visuals.mjs";

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
    this.jumpY=0;this.jumpV=0;this.moving=false;this.moveTarget=null;
  }
  get nearGround(){return this.altitudeM<=12.01}
  setLanding(lat,lon,{allowWater=false}={}){
    if(!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90)throw new RangeError("Invalid landing coordinate");
    const s=terrainSurface(this.terrain,lat,lon);
    if(s.water&&!allowWater)throw new Error("着陸地点は陸地を選択してください。");
    this.origin={lat,lon:wrapLon(lon)};
    this.x=0;this.z=0;this.lat=lat;this.lon=wrapLon(lon);
    this.moveTarget=null;this.jumpY=0;this.jumpV=0;
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
  locationAt(x,z){
    if(![x,z].every(Number.isFinite))throw new TypeError("Invalid coordinates.");
    return geoOffset(this.origin.lat,this.origin.lon,x,z,this.terrain.planet.radiusM);
  }
  setMoveTarget(x,z){
    if(![x,z].every(Number.isFinite))throw new TypeError("Invalid movement target.");
    if(this.altitudeM>12.01) return false;
    const range=Math.hypot(x-this.x,z-this.z);
    if(range>.3 && range<=350){this.moveTarget={x,z};return true;}
    return false;
  }
  clearMoveTarget(){this.moveTarget=null;}
  jump(){
    if(this.altitudeM>12.01||this.jumpY>.001||this.jumpV!==0)return false;
    this.jumpV=5.6;return true;
  }
  update(dt,{forward=0,strafe=0,turn=0}={}){
    if(!Number.isFinite(dt)||dt<0)throw new TypeError("Invalid frame delta");
    dt=clamp(dt,0,.1);
    // Bounded log-space motion preserves the spherical-to-ground cloud handoff.
    // Previous exponential interpolation skipped ~23 km in only a few frames.
    this.altitudeM=smoothAltitude(this.altitudeM,this.targetAltitudeM,dt);
    if(![forward,strafe,turn].every(Number.isFinite))throw new TypeError("Invalid walking controls");
    if(Math.abs(forward)+Math.abs(strafe)+Math.abs(turn)>.1)this.moveTarget=null;
    if(this.altitudeM>12.01){
      this.turn(clamp(turn,-1,1)*dt*1.7);
      this.blocked=false;this.moving=false;this.jumpY=0;this.jumpV=0;return;
    }
    if(this.moveTarget){
      const dx=this.moveTarget.x-this.x,dz=this.moveTarget.z-this.z;
      const distance=Math.hypot(dx,dz);
      if(distance<.42){this.moveTarget=null;forward=0;}
      else{
        const desired=Math.atan2(dx,dz);
        const angle=Math.atan2(Math.sin(desired-this.yaw),Math.cos(desired-this.yaw));
        turn=clamp(angle/(dt*1.7||1),-1,1);
        forward=Math.abs(angle)<.40 ? Math.min(1,distance/(dt*this.walkSpeed||1)) : 0;
      }
    }
    this.turn(clamp(turn,-1,1)*dt*1.7);
    if(this.jumpV!==0||this.jumpY>0){
      this.jumpV-=this.terrain.planet.gravity*dt;
      this.jumpY=Math.max(0,this.jumpY+this.jumpV*dt);
      if(this.jumpY===0)this.jumpV=0;
    }
    let f=clamp(forward,-1,1),s=clamp(strafe,-1,1);
    const len=Math.hypot(f,s);if(len>1){f/=len;s/=len;}
    const step=this.walkSpeed*dt;
    const east=step*(Math.sin(this.yaw)*f+Math.cos(this.yaw)*s);
    const north=step*(Math.cos(this.yaw)*f-Math.sin(this.yaw)*s);
    if(Math.hypot(east,north)<1e-9){this.blocked=false;this.moving=false;return;}
    const x=this.x+east,z=this.z+north;
    const next=geoOffset(this.origin.lat,this.origin.lon,x,z,this.terrain.planet.radiusM);
    const sample=terrainSurface(this.terrain,next.lat,next.lon);
    const present=terrainSurface(this.terrain,this.lat,this.lon);
    // Water, steep vertical steps, and terrain > 2800m are blocked for the MVP.
    const blocked=sample.water||sample.river||sample.elevationM>2800||
      Math.abs(sample.elevationM-present.elevationM)>Math.max(1.8,Math.hypot(east,north)*1.65);
    this.blocked=blocked;this.moving=!blocked;
    if(blocked && this.moveTarget)this.moveTarget=null;
    if(!blocked){
      this.x=x;this.z=z;this.lat=next.lat;this.lon=next.lon;
      this.totalDistanceM+=Math.hypot(east,north);
    }
  }
  snapshot(){return {format:"ue/explorer",version:1,origin:{...this.origin},
    x:this.x,z:this.z,yaw:this.yaw,altitudeM:this.altitudeM,
    targetAltitudeM:this.targetAltitudeM,totalDistanceM:this.totalDistanceM,
    jumpY:this.jumpY,jumpV:this.jumpV,moveTarget:this.moveTarget};}
  static fromSnapshot(terrain,data){
    if(!data||data.format!=="ue/explorer"||data.version!==1)throw Error("Unsupported explorer snapshot");
    const t=new ExplorerController(terrain,{startLat:data.origin?.lat,startLon:data.origin?.lon});
    if(![data.x,data.z,data.yaw,data.altitudeM,data.targetAltitudeM,data.totalDistanceM].every(Number.isFinite))throw Error("Invalid explorer values");
    if(data.altitudeM<2.5||data.targetAltitudeM<2.5||data.totalDistanceM<0)throw Error("Invalid saved altitude or distance");
    t.origin={lat:data.origin.lat,lon:wrapLon(data.origin.lon)};
    t.x=data.x;t.z=data.z;t.yaw=data.yaw;t.altitudeM=data.altitudeM;
    t.targetAltitudeM=data.targetAltitudeM;t.totalDistanceM=data.totalDistanceM;
    t.jumpY=Number.isFinite(data.jumpY)?Math.max(0,data.jumpY):0;
    t.jumpV=Number.isFinite(data.jumpV)?data.jumpV:0;
    if(data.moveTarget && Number.isFinite(data.moveTarget.x)&&Number.isFinite(data.moveTarget.z)){
      t.moveTarget={x:data.moveTarget.x,z:data.moveTarget.z};
    }
    const here=geoOffset(t.origin.lat,t.origin.lon,t.x,t.z,terrain.planet.radiusM);
    t.lat=here.lat;t.lon=here.lon;
    return t;
  }
}