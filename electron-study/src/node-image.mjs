import {layerPng} from './project-assets.jsx';
export async function nodeImage(owner,nodeId){
 const svg=document.querySelector('.artboard>svg');if(!svg||!owner)throw Error('No composition to preview');
 const prefix=svg.querySelector(`[data-graph-output="${CSS.escape(owner.id)}"]`)?.dataset.graphPrefix,target=prefix?prefix+'-'+nodeId:null;
 if(!target&& !['input','output'].includes(nodeId))throw Error('Open the object graph to preview this node');
 return layerPng(svg,new Set([owner.id]),{opaqueLayer:true,outputFrom:target,world:(()=>{const m=nodeWorld(owner);return [m.a,m.b,m.c,m.d,m.e,m.f];})(),inputOnly:!target&&nodeId==='input'});
}
export function nodeWorld(owner){const svg=document.querySelector('.artboard>svg'),node=svg?.querySelector(`[data-object="${CSS.escape(owner.id)}"]`)??svg?.querySelector(`[data-graph-output="${CSS.escape(owner.id)}"]`);return svg&&node?svg.getScreenCTM().inverse().multiply(node.getScreenCTM()):new DOMMatrix();}
