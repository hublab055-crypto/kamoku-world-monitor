/**
 * A real WebGL2 framebuffer for the compositor-owned XRProjectionLayer textures.
 * VR-only alternative to XRWebGLLayer's opaque framebuffer. A projection layer
 * is available without the optional "layers" session feature in WebXR Layers.
 * Never keep sub-images or their textures beyond the current XR frame.
 */
export function canUseXRProjection(globalObject=globalThis){
 return typeof globalObject.XRWebGLBinding==="function";
}
export function createXRProjection(session,gl,XRWebGLBindingClass=globalThis.XRWebGLBinding){
 if(typeof XRWebGLBindingClass!=="function")throw Error("XRWebGLBinding unavailable");
 const binding=new XRWebGLBindingClass(session,gl);
 // texture (TEXTURE_2D) avoids Quest Browser's texture-array path pitfalls.
 const layer=binding.createProjectionLayer({
  textureType:"texture",depthFormat:gl.DEPTH_COMPONENT24,scaleFactor:.85
 });
 const framebuffer=gl.createFramebuffer();
 if(!framebuffer)throw Error("XRProjectionLayer framebuffer allocation failed");
 try{session.updateRenderState({layers:[layer]});}
 catch(e){gl.deleteFramebuffer(framebuffer);throw e;}
 return {binding,layer,framebuffer};
}
export function projectionReady(session,p){
 return Boolean(p&&session?.renderState?.layers?.includes(p.layer));
}
export function bindXRProjectionView(gl,p,view){
 const sub=p.binding.getViewSubImage(p.layer,view);
 if(!sub?.colorTexture||!sub?.viewport)throw Error("XRProjectionLayer sub-image missing");
 gl.bindFramebuffer(gl.FRAMEBUFFER,p.framebuffer);
 gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,
  gl.TEXTURE_2D,sub.colorTexture,0);
 // Depth may be absent on some runtimes. The attachment must not remain
 // attached from the previous eye's texture when absent.
 gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,
  gl.TEXTURE_2D,sub.depthStencilTexture||null,0);
 const status=gl.checkFramebufferStatus(gl.FRAMEBUFFER);
 if(status!==gl.FRAMEBUFFER_COMPLETE){
  const msg="XRProjectionLayer framebuffer 0x"+Number(status).toString(16);
  throw Error(msg);
 }
 return sub.viewport;
}
export function destroyXRProjection(gl,p){
 if(p?.framebuffer)gl.deleteFramebuffer(p.framebuffer);
}
