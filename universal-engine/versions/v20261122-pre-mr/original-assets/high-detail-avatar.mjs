/** Original procedural high-detail human GLB builder (CC0). Self contained: no downloads. */
const JOINTS=[
["pelvis",null,[0,.94,0]],["waist","pelvis",[0,.07,0]],["torso","waist",[0,.18,0]],
["neck","torso",[0,.60,0]],["head","neck",[0,.14,0]],
["leftShoulder","torso",[-.265,.48,0]],["leftElbow","leftShoulder",[0,-.38,0]],
["leftWrist","leftElbow",[0,-.32,0]],["leftHand","leftWrist",[0,-.07,0]],
["rightShoulder","torso",[.265,.48,0]],["rightElbow","rightShoulder",[0,-.38,0]],
["rightWrist","rightElbow",[0,-.32,0]],["rightHand","rightWrist",[0,-.07,0]],
["leftHip","pelvis",[-.14,-.07,0]],["leftKnee","leftHip",[0,-.40,0]],
["leftAnkle","leftKnee",[0,-.39,0]],["leftFoot","leftAnkle",[0,-.075,.045]],
["rightHip","pelvis",[.14,-.07,0]],["rightKnee","rightHip",[0,-.40,0]],
["rightAnkle","rightKnee",[0,-.39,0]],["rightFoot","rightAnkle",[0,-.075,.045]]];
const PI=Math.PI;
const hex=s=>[1,3,5].map(i=>parseInt(s.slice(i,i+2),16)/255);
const norm=(x,y,z)=>{const l=Math.hypot(x,y,z)||1;return [x/l,y/l,z/l];};
const gauss=(x,y,cx,cy,sx,sy)=>Math.exp(-(((x-cx)/sx)**2)-(((y-cy)/sy)**2));
const clamp=(x,a=0,b=1)=>Math.min(b,Math.max(a,x));
const quatX=a=>[Math.sin(a/2),0,0,Math.cos(a/2)];
const quatZ=a=>[0,0,Math.sin(a/2),Math.cos(a/2)];
function makeGLB(sex="male",quality="high"){
 if(!["male","female"].includes(sex)||!["high","mobile"].includes(quality))throw Error("Invalid avatar");
 const female=sex==="female",high=quality==="high";
 const res=(v,lo)=>high?Math.max(lo,Math.round(v*.73)):lo;
 const skin=hex(female?"#d9a880":"#bd906f"),shade=hex("#945e4e"),eye=hex(female?"#586b55":"#627486");
 const hair=hex(female?"#5a3d30":"#382d26"),lip=hex("#a46b63"),white=hex("#efece0"),dark=hex("#1a2724");
 const jacket=hex(female?"#58877c":"#426d65"),trim=hex("#2d5a53"),pants=hex("#303b42"),boot=hex("#644531"),gold=hex("#aa9362");
 const groups=new Map(),fragment={face:0};
 function add(pivot,name,c,r,lat,lon,color,warp){
  let g=groups.get(pivot);
  if(!g){g={pivot,name:"rig_"+pivot,pos:[],norm:[],color:[],idx:[]};groups.set(pivot,g);}
  const start=g.pos.length/3;
  for(let i=0;i<=lat;i++){
   const theta=PI*i/lat,st=Math.sin(theta),ct=Math.cos(theta);
   for(let j=0;j<=lon;j++){
    const phi=-PI+2*PI*j/lon,dx=st*Math.cos(phi),dy=ct,dz=st*Math.sin(phi);
    let x=c[0]+r[0]*dx,y=c[1]+r[1]*dy,z=c[2]+r[2]*dz;
    if(warp)z=warp(x,y,z,dz);
    g.pos.push(x,y,z);
    g.norm.push(...norm(dx/r[0],dy/r[1],dz/r[2]));
    g.color.push(...color);
   }
  }
  for(let i=0;i<lat;i++)for(let j=0;j<lon;j++){
   const a=start+i*(lon+1)+j,b=a+lon+1;
   g.idx.push(a,a+1,b,b,a+1,b+1);
  }
  if(pivot==="head")fragment.face+=lat*lon*2;
 }
 const headWarp=(x,y,z,dz)=>{
  const Y=y-.055,front=clamp((dz+.20)/.65);
  return z+front*(.039*gauss(x,Y,0,.008,.038,.073)
    +.017*gauss(x,Y,0,-.036,.027,.023)
    -.012*(gauss(x,Y,-.068,.066,.030,.021)+gauss(x,Y,.068,.066,.030,.021))
    +.007*gauss(x,Y,0,-.104,.072,.035));
 };
 add("head","sculpted_face",[0,.055,.004],[female?.117:.125,.173,.124],high?124:28,high?124:32,skin,headWarp);
 add("head","nose",[0,.002,.152],[.029,.030,.026],res(17,7),res(20,10),skin);
 for(const side of [-1,1]){
  add("head","ear",[side*.125,.011,.008],[.020,.044,.029],res(15,7),res(20,10),skin);
  add("head","eye_white",[side*.065,.088,.133],[.035,.023,.012],res(18,7),res(28,12),white);
  add("head","eye_iris",[side*.066,.089,.144],[.013,.015,.006],res(12,6),res(18,9),eye);
  add("head","eye_pupil",[side*.067,.089,.151],[.006,.010,.004],res(10,5),res(15,8),dark);
  add("head","brow",[side*.065,.128,.129],[.042,.009,.008],res(10,5),res(20,9),hair);
 }
 add("head","upper_lip",[0,-.063,.129],[.047,.009,.011],res(10,5),res(22,10),lip);
 add("head","lower_lip",[0,-.074,.129],[.042,.008,.013],res(9,5),res(22,10),lip);
 add("head","mouth_gap",[0,-.069,.140],[.031,.003,.003],res(7,5),res(20,10),shade);
 add("head","hair_cap",[0,.170,-.010],[.126,.087,.129],res(27,12),res(68,25),hair);
 for(let i=0;i<(female?12:10);i++){
  const x=-.105+i*.21/(female?11:9);
  add("head","fringe",[x,.135,.099],[.019,.039+(i%3)*.006,.028],res(9,5),res(15,8),hair);
 }
 if(female)for(const side of [-1,1]){
  add("head","long_hair",[side*.108,-.050,-.044],[.046,.168,.068],res(25,11),res(32,16),hair);
  add("head","side_lock",[side*.127,-.104,.043],[.026,.119,.034],res(19,8),res(25,13),hair);
 }
 add("neck","neck",[0,.06,0],[.062,.103,.064],res(17,8),res(27,12),skin);
 add("torso","body",[0,.108,0],[female?.235:.258,.340,.126],res(38,16),res(65,25),jacket);
 add("torso","collar",[0,.410,.035],[.183,.075,.131],res(18,8),res(42,17),trim);
 add("pelvis","waistcoat",[0,.024,0],[.219,.153,.120],res(23,10),res(48,19),jacket);
 add("pelvis","belt",[0,.025,0],[.222,.046,.130],res(17,8),res(50,18),boot);
 add("pelvis","clasp",[0,.026,.137],[.043,.030,.014],res(8,5),res(20,10),gold);
 add("pelvis","satchel",[female?-.21:.21,-.08,.119],[.102,.128,.063],res(13,6),res(22,12),boot);
 for(const side of [-1,1]){
  const prefix=side<0?"left":"right";
  add(prefix+"Shoulder","upperArm",[0,-.17,0],[.091,.216,.088],res(24,10),res(43,19),jacket);
  add(prefix+"Elbow","elbow",[0,-.01,0],[.076,.080,.077],res(13,6),res(25,12),trim);
  add(prefix+"Elbow","forearm",[0,-.17,0],[.066,.18,.072],res(23,10),res(40,17),skin);
  add(prefix+"Wrist","glove",[0,-.083,0],[.057,.092,.056],res(17,8),res(31,12),boot);
  for(let i=0;i<4;i++)add(prefix+"Hand","finger",[(i-1.5)*.019,-.042,.018],[.012,.061,.018],res(8,5),res(12,7),skin);
  add(prefix+"Hip","thigh",[0,-.183,0],[.118,.224,.115],res(24,10),res(42,17),pants);
  add(prefix+"Knee","knee",[0,-.01,0],[.096,.077,.098],res(13,7),res(23,12),pants);
  add(prefix+"Knee","shin",[0,-.18,0],[.092,.205,.092],res(25,10),res(41,17),pants);
  add(prefix+"Ankle","boot",[0,-.084,.021],[.105,.115,.120],res(18,8),res(33,14),boot);
  add(prefix+"Foot","toe",[0,-.015,.075],[.102,.067,.157],res(18,8),res(34,14),boot);
 }
 const chunks=[],views=[],acc=[],W={SCALAR:1,VEC3:3,VEC4:4},nodes=[{name:"frontier_"+sex+"_"+quality,children:[]}],meshes=[],pivots=new Map();
 let binLength=0;
 function put(values,type,component=5126,target){
  while(binLength%4){chunks.push(new Uint8Array(1));binLength++;}
  const bytes=new Uint8Array(component===5126?new Float32Array(values).buffer:component===5125?new Uint32Array(values).buffer:new Uint16Array(values).buffer);
  views.push({buffer:0,byteOffset:binLength,byteLength:bytes.byteLength,...(target?{target}:{})});
  chunks.push(bytes);binLength+=bytes.byteLength;
  const a={bufferView:views.length-1,componentType:component,type,count:values.length/W[type]};
  if(type==="VEC3"&&target===34962){
   a.min=[Infinity,Infinity,Infinity];a.max=[-Infinity,-Infinity,-Infinity];
   for(let i=0;i<values.length;i+=3)for(let j=0;j<3;j++){
    a.min[j]=Math.min(a.min[j],values[i+j]);a.max[j]=Math.max(a.max[j],values[i+j]);
   }
  }
  acc.push(a);return acc.length-1;
 }
 for(const [name,parent,translation] of JOINTS){
  const i=nodes.length;pivots.set(name,i);
  nodes.push({name,translation,rotation:[0,0,0,1],children:[]});
  nodes[parent?pivots.get(parent):0].children.push(i);
 }
 let triangles=0;
 for(const g of groups.values()){
  const pos=put(g.pos,"VEC3",5126,34962),normal=put(g.norm,"VEC3",5126,34962),colors=put(g.color,"VEC3",5126,34962);
  const i32=g.pos.length/3>65535,indices=put(g.idx,"SCALAR",i32?5125:5123,34963);
  const mesh=meshes.length;meshes.push({name:g.name,primitives:[{attributes:{POSITION:pos,NORMAL:normal,COLOR_0:colors},indices,material:0,mode:4}]});
  const ni=nodes.length;nodes.push({name:g.name,mesh});
  nodes[pivots.get(g.pivot)].children.push(ni);triangles+=g.idx.length/3;
 }
 function pose(name,joint,t){
  const wave=Math.sin(2*PI*t),pulse=Math.sin(PI*t);
  if(name==="walk"){
   if(joint==="leftHip"||joint==="rightHip")return quatX((joint==="leftHip"?1:-1)*.40*wave);
   if(joint==="leftShoulder"||joint==="rightShoulder")return quatX((joint==="leftShoulder"?-1:1)*.30*wave);
   if(joint==="leftKnee"||joint==="rightKnee")return quatX(.24*Math.max(0,(joint==="leftKnee"?-1:1)*wave));
  }
  if(["sword","axe","mine"].includes(name)){
   if(joint==="rightShoulder")return quatX(-.7-.8*pulse);
   if(joint==="rightElbow")return quatX(-.4+.8*pulse);
   if(name==="axe"&&joint==="leftShoulder")return quatX(-.6-.7*pulse);
  }
  if(name==="talk"&&joint==="rightElbow")return quatX(-.24*Math.sin(4*PI*t)**2);
  if(name==="jump"&&(joint.endsWith("Knee")||joint.endsWith("Shoulder")))return quatX((joint.endsWith("Knee")?.26:-.4)*pulse);
  if(name==="idle"&&joint==="waist")return quatZ(.012*wave);
  return [0,0,0,1];
 }
 const animations=[];
 for(const name of ["idle","walk","sword","axe","mine","talk","jump"]){
  const samples=7,times=Array.from({length:samples},(_,i)=>i/(samples-1)),input=put(times,"SCALAR");
  const samplers=[],channels=[];
  for(const joint of ["waist","neck","leftShoulder","rightShoulder","leftElbow","rightElbow","leftHip","rightHip","leftKnee","rightKnee"]){
   const output=put(times.flatMap(t=>pose(name,joint,t)),"VEC4"),sampler=samplers.length;
   samplers.push({input,output,interpolation:"LINEAR"});
   channels.push({sampler,target:{node:pivots.get(joint),path:"rotation"}});
  }
  animations.push({name,samplers,channels});
 }
 const json={asset:{version:"2.0",generator:"UniversalENGINE original procedural human v2"},scene:0,scenes:[{nodes:[0]}],nodes,meshes,
  materials:[{name:"Original vertex colors",doubleSided:true,pbrMetallicRoughness:{baseColorFactor:[1,1,1,1],metallicFactor:0,roughnessFactor:.86}}],
  buffers:[{byteLength:binLength}],bufferViews:views,accessors:acc,animations,
  extras:{license:"CC0-1.0",kind:"original",sex,quality}};
 const encoded=unescape(encodeURIComponent(JSON.stringify(json)));
 const jsonLen=(encoded.length+3)&~3,binLen=(binLength+3)&~3,total=12+8+jsonLen+8+binLen;
 const bytes=new Uint8Array(total),dv=new DataView(bytes.buffer);
 dv.setUint32(0,0x46546c67,true);dv.setUint32(4,2,true);dv.setUint32(8,total,true);
 dv.setUint32(12,jsonLen,true);dv.setUint32(16,0x4e4f534a,true);
 bytes.fill(32,20,20+jsonLen);for(let i=0;i<encoded.length;i++)bytes[20+i]=encoded.charCodeAt(i);
 const at=20+jsonLen;dv.setUint32(at,binLen,true);dv.setUint32(at+4,0x004e4942,true);
 let off=at+8;for(const c of chunks){bytes.set(c,off);off+=c.length;}
 return {bytes,stats:{sex,quality,triangles,faceTriangles:fragment.face,meshes:meshes.length,bytes:total,clips:animations.map(a=>a.name)}};
}

export {makeGLB};
