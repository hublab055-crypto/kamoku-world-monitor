/**
 * Mutually exclusive WebXR render-state paths.
 * XRProjectionLayer is installed through {layers:[projection]}.
 * XRWebGLLayer is installed through either {baseLayer:legacy} or
 * {layers:[legacy]}, never both in one updateRenderState call.
 */
export function xrLayersEnabled(session){
 const features=session?.enabledFeatures;
 if(!features)return null;
 if(typeof features.has==="function")return features.has("layers");
 if(typeof features.includes==="function")return features.includes("layers");
 return Array.from(features).includes("layers");
}
export function installLegacyXRLayer(session,layer,{preferLayers=false}={}){
 const modes=preferLayers?["layers","baseLayer"]:["baseLayer","layers"];
 let previous=null;
 for(const mode of modes){
  try{
   session.updateRenderState(mode==="layers"?{layers:[layer]}:{baseLayer:layer});
   return mode;
  }catch(error){previous=error;}
 }
 throw previous||Error("XRWebGLLayer install failed");
}
export function activeLegacyXRLayer(session){
 const state=session?.renderState;
 if(state?.baseLayer)return state.baseLayer;
 return Array.from(state?.layers||[]).find(layer=>
  layer&&typeof layer.getViewport==="function"&&layer.framebuffer)||null;
}
