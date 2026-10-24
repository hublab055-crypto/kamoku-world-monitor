/**
 * Small, bounded depth grid for MR occlusion. Values are meters from the
 * camera plane. CPU WebXR coordinates are top-left; WebGL textures are
 * sampled from the bottom-left. Never persist environmental depth frames.
 */
export const DEPTH_GRID_WIDTH=40;
export const DEPTH_GRID_HEIGHT=30;
export function sampleXRDepth(info,{width=DEPTH_GRID_WIDTH,height=DEPTH_GRID_HEIGHT}={}){
 if(!info||typeof info.getDepthInMeters!=="function")return null;
 if(!Number.isInteger(width)||width<1||width>256||
    !Number.isInteger(height)||height<1||height>256)throw RangeError("Invalid depth sampling grid");
 const pixels=new Float32Array(width*height);
 let valid=0;
 for(let row=0;row<height;row++)for(let col=0;col<width;col++){
  const u=(col+.5)/width,v=1-(row+.5)/height;
  let meters=0;
  try{meters=info.getDepthInMeters(u,v);}catch(_){meters=0;}
  if(!Number.isFinite(meters)||meters<=0.02||meters>80)meters=0;
  else valid++;
  pixels[row*width+col]=meters;
 }
 return {width,height,pixels,valid,available:valid>0};
}
export function canRequestXRDepth(mode,enabled=true){
 return mode==="immersive-ar"&&Boolean(enabled);
}
export function depthFeatureOptions(mode){
 if(mode!=="immersive-ar")return {};
 return {
  // Depth is optional; failing to provide it never prevents MR startup.
  optionalFeature:"depth-sensing",
  depthSensing:{
   usagePreference:["cpu-optimized"],
   dataFormatPreference:["luminance-alpha","float32"]
  }
 };
}
