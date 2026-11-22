/** Universal Engine integration point; host provides avatar equipment/effect hooks. */
export function mountHenshinWorkshop({container,url,onAction=()=>{},onProject=()=>{},onError=()=>{},onReady=()=>{}}){
 if(!container)throw Error('container required');const target=new URL(url,location.href);if(!['https:','http:'].includes(target.protocol))throw Error('HTTP(S) URL required');
 const frame=document.createElement('iframe');frame.src=target.href;frame.title='変身工房';frame.allow='xr-spatial-tracking; microphone; fullscreen';frame.style.cssText='width:100%;height:100%;border:0;min-height:720px';
 const send=data=>frame.contentWindow?.postMessage(data,target.origin);
 function receive(event){if(event.source!==frame.contentWindow||event.origin!==target.origin)return;const data=event.data;if(data?.type==='henshin:ready')onReady();if(data?.type==='henshin:action'&&['activate','insert','transform','attack'].includes(data.action))onAction(data);if(data?.type==='henshin:project')onProject(data.project);if(data?.type==='henshin:error')onError(data.message);}
 window.addEventListener('message',receive);frame.addEventListener('load',()=>send({type:'henshin:connect'}));container.append(frame);
 return {frame,loadProject:project=>send({type:'henshin:load-project',project}),getProject:()=>send({type:'henshin:get-project'}),dispose(){window.removeEventListener('message',receive);frame.remove();}};
}
