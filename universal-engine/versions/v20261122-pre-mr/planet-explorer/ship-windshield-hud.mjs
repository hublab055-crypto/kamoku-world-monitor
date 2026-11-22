/** Flight data and transparent windscreen symbology for gravity-zone piloting.
 * Shared by DOM/desktop canvas and mesh-native WebXR cockpit instruments.
 * All coordinates are ship-relative, with north=0 and east=90 degrees.
 */
export const WINDSHIELD_GRAVITY_STATUSES=Object.freeze([
 "docked","landed","ascent","entry","atmosphere","vtol","touchdown"
]);
const rad=Math.PI/180;
const clamp=(n,min,max)=>Math.min(max,Math.max(min,n));
const finite=n=>Number.isFinite(n);
export const compassNames=Object.freeze(["N","NE","E","SE","S","SW","W","NW"]);
export const normalizeHeading=n=>((n%360)+360)%360;
/** Departure attitude uses the launch body, arrival the destination body. */
export function windshieldBodyId(v){
 return ["docked","ascent"].includes(v?.status)?v?.originId:(v?.destinationId||v?.originId);
}
export function compassLabel(heading){
 if(!finite(heading))return "—";
 return compassNames[Math.round(normalizeHeading(heading)/45)%8];
}
/** Local east/north offsets are metres on the CURRENT planetary radius.
 * Never invent a position when the saved pad or body radius is unavailable.
 */
export function shipGeodeticPosition(site,east=0,north=0,radiusM=null){
 if(!site||![site.lat,site.lon,east,north,radiusM].every(finite)||radiusM<=0||
  Math.abs(site.lat)>90||Math.abs(site.lon)>180)return null;
 const latitude=site.lat+north/radiusM/rad;
 if(latitude>90||latitude< -90)return null;
 const cosine=Math.cos(site.lat*rad);
 if(Math.abs(cosine)<1e-7&&Math.abs(east)>.001)return null;
 const longitude=site.lon+(Math.abs(cosine)<1e-7?0:east/(radiusM*cosine)/rad);
 return {lat:latitude,lon:((longitude+180)%360+360)%360-180};
}
export function windshieldTelemetry(v,{body=null,height=null}={}){
 if(!v||!WINDSHIELD_GRAVITY_STATUSES.includes(v.status))return null;
 const status=v.status,grounded=["docked","landed","touchdown"].includes(status);
 const heading=normalizeHeading(finite(v.attitudeYawDeg)?v.attitudeYawDeg:0);
 const pitch=finite(v.pitchDeg)?v.pitchDeg:0;
 const altitude=grounded?0:finite(height)?Math.max(0,height):
  finite(v.airAltitude)?Math.max(0,v.airAltitude):null;
 // The simplified ascent/entry animation does not simulate true m/s.
 const speed=["ascent","entry"].includes(status)?null:
  grounded?0:finite(v.airSpeed)?Math.max(0,v.airSpeed):null;
 const landing=["entry","atmosphere","vtol","touchdown","landed"].includes(status);
 const site=landing?v.landingSite:(v.launchSite||v.landingSite);
 const localFlight=["atmosphere","vtol"].includes(status);
 const east=localFlight&&finite(v.airEast)?v.airEast:0;
 const north=localFlight&&finite(v.airNorth)?v.airNorth:0;
 const coords=site&&(!body?.id||site.bodyId===body.id)?
  shipGeodeticPosition(site,east,north,body?.radiusM):null;
 return {headingDeg:heading,direction:compassLabel(heading),pitchDeg:pitch,rollDeg:finite(v.rollDeg)?v.rollDeg:0,
  altitudeM:altitude,speedMps:speed,lat:coords?.lat??null,lon:coords?.lon??null};
}
export function formatLatitude(lat){
 return finite(lat)?Math.abs(lat).toFixed(4)+"°"+(lat<0?"S":"N"):"—";
}
export function formatLongitude(lon){
 return finite(lon)?Math.abs(lon).toFixed(4)+"°"+(lon<0?"W":"E"):"—";
}
/** Match the static 3D ladder: aircraft reference W stays centered while the
 * horizon and angle graduations travel DOWN when the nose pitches up.
 */
export function pitchLadderOffset(currentPitchDeg,tickDeg,scale){
 return (currentPitchDeg-tickDeg)*scale;
}
export function paintWindshieldHUD(ctx,w,h,t){
 if(!ctx||!t||!finite(w)||!finite(h)||w<=0||h<=0)return;
 const scale=Math.max(.62,Math.min(w/960,h/540)),cx=w*.5,cy=h*.49;
 const font=n=>Math.max(10,Math.round(n*scale));
 const line="#8be9df",strong="#ddfff1";
 ctx.save();ctx.clearRect(0,0,w,h);
 ctx.lineCap="round";ctx.lineJoin="round";ctx.shadowColor="#00bdbb";ctx.shadowBlur=5*scale;
 // Graduated horizon and pitch ladder fill the usable windshield width.
 const degreesPerHeight=h/56;
 ctx.save();ctx.translate(cx,cy);ctx.rotate((t.rollDeg||0)*rad);ctx.translate(-cx,-cy);
 for(let deg=-90;deg<=90;deg+=5){
  const y=cy+pitchLadderOffset(t.pitchDeg,deg,degreesPerHeight);
  if(y<h*.20||y>h*.77)continue;
  const major=deg%10===0,isHorizon=deg===0;
  const end=isHorizon?w*.45:major?w*.23:w*.15;
  const gap=isHorizon?w*.06:w*.075;
  ctx.strokeStyle=isHorizon?strong:line;ctx.globalAlpha=isHorizon?.90:major?.75:.48;
  ctx.lineWidth=(isHorizon?2:1.4)*scale;
  ctx.beginPath();ctx.moveTo(cx-end,y);ctx.lineTo(cx-gap,y);
  ctx.moveTo(cx+gap,y);ctx.lineTo(cx+end,y);ctx.stroke();
  ctx.font="600 "+font(14)+"px ui-monospace,monospace";
  ctx.fillStyle=line;ctx.textBaseline="middle";
  ctx.textAlign="left";ctx.fillText(String(deg)+"°",cx+end+9*scale,y);
  if(major){ctx.textAlign="right";ctx.fillText(String(deg)+"°",cx-end-9*scale,y);}
 }
 ctx.restore();ctx.globalAlpha=1;
 // Fixed boresight symbol (not an aircraft attitude line): W shaped flight reference.
 ctx.strokeStyle=strong;ctx.lineWidth=2.6*scale;ctx.beginPath();
 ctx.moveTo(cx-29*scale,cy-9*scale);ctx.lineTo(cx-17*scale,cy+7*scale);
 ctx.lineTo(cx-5*scale,cy-3*scale);ctx.lineTo(cx+5*scale,cy+7*scale);
 ctx.lineTo(cx+17*scale,cy-9*scale);ctx.lineTo(cx+29*scale,cy-9*scale);ctx.stroke();
 ctx.font="700 "+font(12)+"px ui-monospace,monospace";ctx.fillStyle=strong;ctx.textAlign="center";
 ctx.fillText((Math.round(t.pitchDeg*10)/10).toFixed(1)+"°",cx,cy-22*scale);
 // Heading tape is at the top of the canopy; north, NW etc. follow current yaw.
 const tapeY=h*.115,pxPerDegree=w*.55/120;
 ctx.textBaseline="middle";
 for(let a=-90;a<=90;a+=15){
  const relative=Math.round(t.headingDeg/15)*15+a-t.headingDeg;
  const x=cx+relative*pxPerDegree;
  if(x<w*.12||x>w*.88)continue;
  const heading=normalizeHeading(Math.round(t.headingDeg/15)*15+a);
  ctx.strokeStyle=line;ctx.lineWidth=1.2*scale;ctx.globalAlpha=.75;
  ctx.beginPath();ctx.moveTo(x,tapeY+9*scale);ctx.lineTo(x,tapeY+(a%45===0?23:15)*scale);ctx.stroke();
  if(Math.round(heading)%45===0){
   ctx.font="700 "+font(14)+"px ui-monospace,monospace";ctx.fillStyle=strong;ctx.textAlign="center";
   ctx.fillText(compassLabel(heading),x,tapeY-5*scale);
  }
 }
 ctx.globalAlpha=1;ctx.strokeStyle=strong;ctx.lineWidth=2*scale;ctx.beginPath();
 ctx.moveTo(cx-7*scale,tapeY+25*scale);ctx.lineTo(cx,tapeY+33*scale);
 ctx.lineTo(cx+7*scale,tapeY+25*scale);ctx.stroke();
 ctx.font="700 "+font(13)+"px ui-monospace,monospace";ctx.fillStyle=strong;
 ctx.fillText(t.direction+" "+Math.round(t.headingDeg).toString().padStart(3,"0")+"°",cx,tapeY+49*scale);
 // Speed/altitude are deliberately spaced away from the pilot's central aim.
 ctx.font="700 "+font(18)+"px ui-monospace,monospace";ctx.textBaseline="middle";
 ctx.textAlign="left";ctx.fillText("SPD",w*.12,cy-15*scale);
 ctx.fillText(t.speedMps===null?"—":Math.round(t.speedMps)+" m/s",w*.12,cy+13*scale);
 ctx.textAlign="right";ctx.fillText("ALT",w*.88,cy-15*scale);
 ctx.fillText(t.altitudeM===null?"—":Math.round(t.altitudeM).toLocaleString("en-US")+" m",w*.88,cy+13*scale);
 ctx.font="600 "+font(13)+"px ui-monospace,monospace";ctx.textAlign="center";ctx.fillStyle=line;
 ctx.fillText("LAT "+formatLatitude(t.lat)+"    LON "+formatLongitude(t.lon),cx,h*.745);
 ctx.restore();
}
