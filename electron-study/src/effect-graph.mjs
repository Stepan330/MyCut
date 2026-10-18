import {graphFor} from './graph-model.mjs';
export function effectNodes(item){
  const nodes=[{id:'input',type:'Input'}];
  for(const channel of ['paint','erasures'])for(const [index] of (item?.[channel]??[]).entries())nodes.push({id:`${channel}-op-${index}`,type:channel==='paint'?'Add':'Subtract'},{id:`${channel}-${index}`,type:'Paint_Mask',channel,index});
  for(const [index,input] of (item?.nodeInputs??[]).entries())nodes.push({id:`signal-op-${index}`,type:input.operation??'Add'},{id:`signal-${index}`,type:'NodeInput',channel:'nodeInputs',index,sourceId:input.sourceId});
  return [...nodes,{id:'output',type:'Output'}];
}
export function isDescendant(scene,id,parentId){const seen=new Set();let node=scene.find(n=>n.id===id);while(node?.parentId&&!seen.has(node.id)){if(node.parentId===parentId)return true;seen.add(node.id);node=scene.find(n=>n.id===node.parentId);}return false;}
export function attachSignal(scene,ownerId,sourceId,{combine=true,position}={}){
  const owner=scene.find(n=>n.id===ownerId);if(!owner||!isDescendant(scene,sourceId,ownerId))return scene;const existing=owner.nodeInputs?.findIndex(n=>n.sourceId===sourceId)??-1;if(existing>=0){if(!combine||!owner.graph?.removed?.includes(`signal-op-${existing}`))return scene;const graph=graphFor(owner),op=`signal-op-${existing}`,base=graph.edges.find(e=>e.to==='output')?.from??'input';return scene.map(n=>n.id===ownerId?{...n,graph:{...graph,removed:graph.removed.filter(id=>id!==op),nodes:[...graph.nodes,{id:op,type:'Add',x:330,y:40}],edges:[...graph.edges.filter(e=>e.to!=='output'),{from:base,to:op,port:'base'},{from:`signal-${existing}`,to:op,port:'mask'},{from:op,to:'output',port:'base'}]}}:n);}
  return scene.map(n=>{if(n.id!==ownerId)return n;const index=n.nodeInputs?.length??0,next={...n,nodeInputs:[...(n.nodeInputs??[]),{sourceId,operation:'Add',opacity:1,enabled:true}]};if(!combine){const graph=graphFor(n);next.graph={...graph,nodes:[...graph.nodes,{id:`signal-${index}`,type:'NodeInput',channel:'nodeInputs',index,sourceId,x:position?.x??120,y:position?.y??460}],removed:[...(graph.removed??[]),`signal-op-${index}`]};}return next;});
}
export function signalSources(scene){const roots=scene.flatMap(n=>(n.nodeInputs??[]).filter(s=>scene.some(child=>child.id===s.sourceId)&&isDescendant(scene,s.sourceId,n.id)).map(s=>s.sourceId));return new Set(scene.filter(n=>roots.some(id=>n.id===id||isDescendant(scene,n.id,id))).map(n=>n.id));}
