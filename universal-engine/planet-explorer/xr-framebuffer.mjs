/**
 * WebXR opaque framebuffer recovery policy.
 *
 * XRWebGLLayer framebuffers are only complete while running the session's
 * XRAnimationFrame callback. Never probe an opaque layer outside that frame.
 *
 * This module has no WebXR globals so Node tests can verify the state machine.
 */
export const XR_VR_LAYER_CONFIGS=Object.freeze([
 Object.freeze({alpha:false,depth:true,stencil:false,antialias:true,framebufferScaleFactor:1}),
 Object.freeze({alpha:false,depth:true,stencil:false,antialias:false,framebufferScaleFactor:.75}),
 Object.freeze({alpha:false,depth:false,stencil:false,antialias:false,framebufferScaleFactor:.65})
]);

export function xrFramebufferStatusLabel(gl,status){
 const codes=[
  ["FRAMEBUFFER_COMPLETE","complete"],
  ["FRAMEBUFFER_UNDEFINED","undefined"],
  ["FRAMEBUFFER_INCOMPLETE_ATTACHMENT","incomplete-attachment"],
  ["FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT","missing-attachment"],
  ["FRAMEBUFFER_INCOMPLETE_MULTISAMPLE","incomplete-multisample"],
  ["FRAMEBUFFER_UNSUPPORTED","unsupported"]
 ];
 return codes.find(([key])=>typeof gl[key]==="number"&&gl[key]===status)?.[1]||
  "0x"+Number(status).toString(16);
}

/**
 * Must only be called from XRSession.requestAnimationFrame. Leaves framebuffer
 * bound and does not inspect XR framebuffer attachments (which are opaque).
 */
export function probeXRFramebuffer(gl,layer){
 if(!layer||!layer.framebuffer)return {ok:false,label:"missing-layer",status:null};
 gl.bindFramebuffer(gl.FRAMEBUFFER,layer.framebuffer);
 const status=gl.checkFramebufferStatus(gl.FRAMEBUFFER);
 const label=xrFramebufferStatusLabel(gl,status);
 const width=layer.framebufferWidth||0,height=layer.framebufferHeight||0;
 const ok=status===gl.FRAMEBUFFER_COMPLETE&&width>0&&height>0;
 return {ok,label:ok?label:width<=0||height<=0?label+"/zero-size":label,status,width,height};
}

/** Zero means primary layer; 1/2 enable increasingly conservative layers. */
export function xrNextLayerIndex(current){
 return Number.isInteger(current)&&current>=0&&current+1<XR_VR_LAYER_CONFIGS.length?
  current+1:null;
}
