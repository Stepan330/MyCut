import {graphFor,removeGraphNode,validateGraph} from './graph-model.mjs';
// Remove deleted sources, bypass their automatic operators and compact indices
// without changing the identity of any surviving object or downstream effect.
export function pruneDeletedSignals(item,removed){
 const inputs=item.nodeInputs??[],kept=inputs.map((s,index)=>({s,index})).filter(({s})=>!removed.has(s.sourceId));if(kept.length===inputs.length)return item;
 const next={...item,nodeInputs:kept.map(({s})=>s)};if(!item.graph)return next;
 let graph=graphFor(item);for(let i=inputs.length-1;i>=0;i--)if(removed.has(inputs[i].sourceId)){graph=removeGraphNode(graph,`signal-op-${i}`);graph=removeGraphNode(graph,`signal-${i}`);}
 const indices=new Map(kept.map(({index},i)=>[index,i])),rename=id=>{const m=/^signal-(op-)?(\d+)$/.exec(id);return m&&indices.has(+m[2])?`signal-${m[1]??''}${indices.get(+m[2])}`:id;};
 const removedIds=(graph.removed??[]).filter(id=>{const m=/^signal-(?:op-)?(\d+)$/.exec(id);return !m||indices.has(+m[1]);}).map(rename);
 next.graph=validateGraph({...graph,nodes:graph.nodes.map(n=>({...n,id:rename(n.id),...(n.type==='NodeInput'?{index:indices.get(n.index)}:null)})),edges:graph.edges.map(e=>({...e,from:rename(e.from),to:rename(e.to)})),removed:[...new Set(removedIds)]});return next;
}
