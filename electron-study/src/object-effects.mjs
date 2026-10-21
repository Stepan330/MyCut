import {graphFor,arrangeGraph,nodeCardHeight,validateGraph,removeGraphNode} from './graph-model.mjs';
import {nodeSpec,nodeDefaults} from './generator-nodes.mjs';
import {isParameter,parameterKinds,parameterPort,wrapFunction,expandedEdges} from './parameter-graph.mjs';
export const effectPresets=[
 {id:'shadow',name:'Shadow',nodes:[['DropShadow',{radius:12,x:10,y:10,color:'#000000',amount:.65}]],controls:[['Blur',0,'radius'],['Strength',0,'amount'],['Offset X',0,'x'],['Offset Y',0,'y'],['Color',0,'color']]},
 {id:'correction',name:'Color correction',nodes:[['Brightness',{amount:1}],['Contrast',{amount:1}],['Saturation',{amount:1}]],controls:[['Brightness',0,'amount'],['Contrast',1,'amount'],['Saturation',2,'amount']]},
 {id:'glow',name:'Glow',nodes:[['Glow',{radius:10,color:'#39c9ed',amount:.7}]],controls:[['Blur',0,'radius'],['Strength',0,'amount'],['Color',0,'color']]},
 {id:'soften',name:'Soft blur',nodes:[['Blur',{radius:5}]],controls:[['Blur',0,'radius']]}
];
export const parameterSpec=(graph,target)=>target&&nodeSpec(graph.nodes.find(n=>n.id===target.node)?.type)?.parameters.find(p=>p.id===target.key);
const typeFor=kind=>Object.keys(parameterKinds).find(t=>parameterKinds[t]===kind);
function addParameterNode(graph,control){
 const spec=parameterSpec(graph,control.targets[0]);if(!spec)throw Error('Cannot expose this input');
 const target=graph.nodes.find(n=>n.id===control.targets[0].node),value={...nodeDefaults(target.type),...target.params}[control.targets[0].key];
 const source={id:crypto.randomUUID(),type:typeFor(spec.type),label:control.name,x:target.x-290,y:target.y+380,params:{value}};
 if(!source.type)throw Error('Unsupported parameter type');
 return {control:{...control,parameterNode:source.id},graph:validateGraph({...graph,nodes:[...graph.nodes,source],edges:[...graph.edges.filter(e=>!control.targets.some(t=>t.node===e.to&&parameterPort(t.key)===e.port)),...control.targets.map(t=>({from:source.id,to:t.node,port:parameterPort(t.key)}))]})};
}
export function exposeParameter(owner,node,key){
 const graph=graphFor(owner),target={node,key},spec=parameterSpec(graph,target);if(!spec)throw Error('This field cannot be exposed');
 if(owner.exposedParameters?.some(p=>p.targets.some(t=>t.node===node&&t.key===key)))return owner;
 const added=addParameterNode(graph,{id:crypto.randomUUID(),name:spec.label,group:'Parameters',targets:[target]});
 return {...owner,graph:added.graph,exposedParameters:[...(owner.exposedParameters??[]),added.control]};
}
export function parameterValue(graph,p){const source=graph.nodes.find(n=>n.id===p.parameterNode);if(source)return source.params.value;const t=p.targets[0],n=graph.nodes.find(n=>n.id===t?.node);return {...nodeDefaults(n?.type),...n?.params}[t?.key];}
export function setExposedValue(owner,id,value){
 const p=owner.exposedParameters?.find(p=>p.id===id);if(!p)return owner;const graph=graphFor(owner);
 for(const t of p.targets){const spec=parameterSpec(graph,t);if(!spec)throw Error('Parameter target is missing');if(spec.type==='number'&&(!Number.isFinite(value)||value<spec.min||value>spec.max))throw Error('Value is outside a linked parameter range');}
 const edges=p.parameterNode?[...graph.edges.filter(e=>!p.targets.some(t=>t.node===e.to&&parameterPort(t.key)===e.port)),...p.targets.map(t=>({from:p.parameterNode,to:t.node,port:parameterPort(t.key)}))]:graph.edges;
 return {...owner,graph:validateGraph({...graph,edges,nodes:graph.nodes.map(n=>{if(n.id===p.parameterNode)return {...n,params:{value}};const targets=p.targets.filter(t=>t.node===n.id);return targets.length?{...n,params:{...nodeDefaults(n.type),...n.params,...Object.fromEntries(targets.map(t=>[t.key,value]))}}:n;})})};
}
export function syncExposedGraph(owner,graph){
 let next={...owner,graph};
 const before=graphFor(owner);
 for(const p of owner.exposedParameters??[]){
  if(p.parameterNode)continue;
  const changed=p.targets.find(t=>{const a=before.nodes.find(n=>n.id===t.node),b=graph.nodes.find(n=>n.id===t.node);return a&&b&&JSON.stringify({...nodeDefaults(a.type),...a.params}[t.key])!==JSON.stringify({...nodeDefaults(b.type),...b.params}[t.key]);});
  if(changed){const n=graph.nodes.find(n=>n.id===changed.node);next=setExposedValue(next,p.id,{...nodeDefaults(n.type),...n.params}[changed.key]);}
 }
 const ids=new Set(next.graph.nodes.map(n=>n.id));
 return {...next,exposedParameters:(next.exposedParameters??[]).map(p=>({...p,targets:p.parameterNode?expandedEdges(next.graph).filter(e=>e.from===p.parameterNode&&e.port.startsWith('param:')).map(e=>({node:e.to,key:e.port.slice(6)})):p.targets.filter(t=>ids.has(t.node)&&parameterSpec(next.graph,t))})).filter(p=>p.parameterNode?ids.has(p.parameterNode):p.targets.length),objectEffects:(next.objectEffects??[]).map(e=>({...e,nodes:e.nodes.filter(id=>ids.has(id)),...(e.functionId?{enabled:next.graph.nodes.find(n=>n.id===e.functionId)?.enabled!==false}:null)})).filter(e=>e.nodes.length)};
}
export function addObjectEffect(owner,presetId){
 const preset=effectPresets.find(p=>p.id===presetId);if(!preset)throw Error('Unknown effect');
 let graph=graphFor(owner);
 const composite=['shadow','glow'].includes(presetId);
 const recipe=composite?[['ConvertToAlphaMask',{}],['SolidColor',{color:presetId==='shadow'?'#000000':'#39c9ed'}],['AlphaMultiply',{}],['Blur',{radius:12}],['Offset',{x:presetId==='shadow'?10:0,y:presetId==='shadow'?10:0}],['Opacity',{amount:.65}],['Add',{}]]:preset.nodes;
 const nodes=recipe.map(([type,params])=>({id:crypto.randomUUID(),type,params,x:0,y:0}));
 let previous=graph.edges.find(e=>e.to==='output'&&e.port==='base')?.from??'input',edges=graph.edges.filter(e=>e.to!=='output'||e.port!=='base');
 if(composite){const source=previous;
  for(const [from,to,port] of [[source,nodes[0].id,'base'],[nodes[1].id,nodes[2].id,'base'],[nodes[0].id,nodes[2].id,'mask'],[nodes[2].id,nodes[3].id,'base'],[nodes[3].id,nodes[4].id,'base'],[nodes[4].id,nodes[5].id,'base'],[nodes[5].id,nodes[6].id,'base'],[source,nodes[6].id,'mask']])edges.push({from,to,port});previous=nodes[6].id;
 }else for(const n of nodes){edges.push({from:previous,to:n.id,port:'base'});previous=n.id;}
 edges.push({from:previous,to:'output',port:'base'});
 graph=validateGraph(arrangeGraph({...graph,nodes:[...graph.nodes,...nodes],edges},true));
 const effect={id:crypto.randomUUID(),name:preset.name,nodes:nodes.map(n=>n.id)};
 const controls=composite?[['Blur',3,'radius'],['Strength',5,'amount'],['Offset X',4,'x'],['Offset Y',4,'y'],['Color',1,'color']]:preset.controls,parameters=[];
 for(const [name,index,key] of controls){const added=addParameterNode(graph,{id:crypto.randomUUID(),name,group:preset.name,effect:effect.id,targets:[{node:nodes[index].id,key}]});graph=added.graph;parameters.push(added.control);}
 graph=arrangeGraph(graph,true);const rows=new Map();graph={...graph,nodes:graph.nodes.map(n=>{const p=parameters.find(p=>p.parameterNode===n.id),target=p&&graph.nodes.find(n=>n.id===p.targets[0].node);if(!target)return n;const row=rows.get(target.id)??0;rows.set(target.id,row+1);return {...n,x:target.x,y:target.y+nodeCardHeight(target)+60+row*190};})};const wrapped=wrapFunction(graph,[...nodes.map(n=>n.id),...parameters.map(p=>p.parameterNode)],preset.name);graph=validateGraph(wrapped.graph);
 const hidden=new Set(graph.nodes.filter(n=>n.type==='Function').flatMap(n=>n.members)),visible=graph.nodes.filter(n=>!hidden.has(n.id)),visibleIds=new Set(visible.map(n=>n.id)),layout=arrangeGraph({...graph,nodes:visible,edges:graph.edges.filter(e=>visibleIds.has(e.from)&&visibleIds.has(e.to))},true),positions=new Map(layout.nodes.map(n=>[n.id,n]));graph={...graph,nodes:graph.nodes.map(n=>positions.has(n.id)?{...n,x:positions.get(n.id).x,y:positions.get(n.id).y}:n)};
 effect.nodes=[wrapped.node.id,...wrapped.node.members];effect.functionId=wrapped.node.id;
 return {...owner,graph,objectEffects:[...(owner.objectEffects??[]),effect],exposedParameters:[...(owner.exposedParameters??[]),...parameters]};
}
export function removeObjectEffect(owner,id){
 const effect=owner.objectEffects?.find(e=>e.id===id);if(!effect)return owner;
 const graph=effect.nodes.reduce((g,id)=>g.nodes.some(n=>n.id===id)?removeGraphNode(g,id):g,graphFor(owner));
 const next={...owner,objectEffects:owner.objectEffects.filter(e=>e.id!==id),exposedParameters:(owner.exposedParameters??[]).filter(p=>p.effect!==id)};
 return syncExposedGraph(next,graph);
}
export function validateObjectEffects(owner){
 const effects=owner.objectEffects??[],parameters=owner.exposedParameters??[],graph=graphFor(owner),ids=new Set(graph.nodes.map(n=>n.id)),seen=new Set(),bound=new Set();
 const text=v=>typeof v==='string'&&v.length<=100;
 if(!Array.isArray(effects)||effects.length>64||!Array.isArray(parameters)||parameters.length>512)throw Error('Invalid exposed parameters');
 for(const e of effects){if(!e||!text(e.id)||seen.has(e.id)||!text(e.name)||!Array.isArray(e.nodes)||!e.nodes.length||e.nodes.some(id=>!ids.has(id)||['input','output'].includes(id)))throw Error('Invalid object effect');seen.add(e.id);}
 const names=new Set();
 for(const p of parameters){
  if(!p||!text(p.id)||names.has(p.id)||!text(p.name)||!text(p.group)||p.effect!==undefined&&!seen.has(p.effect)||!Array.isArray(p.targets)||!p.targets.length&&!p.parameterNode||p.targets.length>64)throw Error('Invalid parameter binding');names.add(p.id);
  if(p.parameterNode&&!isParameter(graph.nodes.find(n=>n.id===p.parameterNode)))throw Error('Missing parameter node');
  let type=null;
  for(const t of p.targets){const spec=t&&parameterSpec(graph,t),key=t?.node+':'+t?.key;if(!spec||bound.has(key)||type&&type!==spec.type)throw Error('Invalid linked setting');bound.add(key);type=spec.type;}
 }
 return owner;
}
