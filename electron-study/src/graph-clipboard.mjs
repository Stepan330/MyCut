import {validateGraph} from './graph-model.mjs';
let clipboard=null,count=0;
export function copyGraphNodes(owner,graph,ids){
 const selected=new Set(ids);for(let i=0;i<64;i++)for(const n of graph.nodes)if(selected.has(n.id)&&n.type==='Function')for(const id of n.members)selected.add(id);const nodes=graph.nodes.filter(n=>selected.has(n.id)&&!['Input','Output'].includes(n.type));
 if(!nodes.length)return false;
 const keep=new Set(nodes.map(n=>n.id));
 clipboard=structuredClone({owner:owner.id,nodes,edges:graph.edges.filter(e=>keep.has(e.from)&&keep.has(e.to))});count=0;
 return true;
}
export function pasteGraphNodes(owner,graph,makeId=()=>crypto.randomUUID()){
 if(!clipboard)throw Error('Copy one or more effect nodes first');
 if(clipboard.owner!==owner.id&&clipboard.nodes.some(n=>['Paint_Mask','NodeInput'].includes(n.type)))throw Error('Object-source and paint nodes can only be pasted into their original graph');
 if(graph.nodes.length+clipboard.nodes.length>64)throw Error('Graph node limit reached');
 const offset=32*(count+1),ids=new Map(clipboard.nodes.map(n=>[n.id,makeId()])),clamp=v=>Math.max(-20000,Math.min(20000,v));
 const nodes=clipboard.nodes.map(n=>({...structuredClone(n),id:ids.get(n.id),x:clamp(n.x+offset),y:clamp(n.y+offset),...(n.type==='Function'?{members:n.members.map(id=>ids.get(id)),output:ids.get(n.output),inputs:n.inputs.map(p=>({...p,targets:p.targets.map(t=>({...t,node:ids.get(t.node)}))}))}:null)}));
 const edges=clipboard.edges.map(e=>({...e,from:ids.get(e.from),to:ids.get(e.to)}));
 const next=validateGraph({...graph,nodes:[...graph.nodes,...nodes],edges:[...graph.edges,...edges]});count++;
 return {graph:next,nodes};
}
