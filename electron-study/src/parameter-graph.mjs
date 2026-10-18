import {nodeSpec,nodeDefaults,validNodeValue} from './generator-nodes.mjs';
export const parameterKinds={NumberParameter:'number',ColorParameter:'color',BooleanParameter:'checkbox',ChoiceParameter:'select',GradientParameter:'stops'};
export const isParameter=n=>!!parameterKinds[n?.type];
export const parameterPort=key=>'param:'+key;
export const fieldSpec=(node,port)=>port?.startsWith('param:')?nodeSpec(node.type)?.parameters.find(p=>p.id===port.slice(6)):null;
export function outputKind(node,nodes,seen=new Set()){if(seen.has(node?.id))return 'invalid';seen.add(node?.id);return isParameter(node)?parameterKinds[node.type]:node?.type==='Function'?outputKind(nodes?.find(n=>n.id===node.output),nodes,seen):'signal';}
export function expandedEdges(graph){
 const edges=[...graph.edges];
 for(let pass=0;pass<graph.nodes.filter(n=>n.type==='Function').length+1;pass++)for(const fn of graph.nodes.filter(n=>n.type==='Function'))for(const input of fn.inputs??[]){
  const source=edges.find(e=>e.to===fn.id&&e.port===input.port);if(!source)continue;
  for(const t of input.targets)if(!edges.some(e=>e.to===t.node&&e.port===t.port))edges.push({from:source.from,to:t.node,port:t.port});
 }
 return edges;
}
export function resolveParameters(graph){
 const nodes=new Map(graph.nodes.map(n=>[n.id,n])),overrides=new Map();
 for(const e of expandedEdges(graph)){
  if(!e.port.startsWith('param:'))continue;const source=nodes.get(e.from),target=nodes.get(e.to);if(!isParameter(source)||!target)continue;
  overrides.set(target.id,{...overrides.get(target.id),[e.port.slice(6)]:structuredClone(source.params.value)});
 }
 return {...graph,nodes:graph.nodes.map(n=>overrides.has(n.id)?{...n,params:{...nodeDefaults(n.type),...n.params,...overrides.get(n.id)}}:n)};
}
export function validTypedEdge(graph,e){
 const source=graph.nodes.find(n=>n.id===e.from),target=graph.nodes.find(n=>n.id===e.to),kind=outputKind(source,graph.nodes);
 const spec=fieldSpec(target,e.port),input=target?.type==='Function'?target.inputs?.find(p=>p.port===e.port):null;
 if(spec)return kind===spec.type&&validNodeValue(target.type,spec.id,source?.params?.value);
 if(input)return kind===input.kind&&(kind==='signal'||input.targets.every(t=>{const n=graph.nodes.find(n=>n.id===t.node);return !!n&&validNodeValue(n.type,t.port.slice(6),source?.params?.value);}));
 return kind==='signal';
}
export function wrapFunction(graph,ids,label='Function'){
 const members=graph.nodes.filter(n=>ids.includes(n.id)&&!['Input','Output'].includes(n.type));
 if(!members.length)throw Error('Select effect nodes to group');
 const set=new Set(members.map(n=>n.id)),outputs=graph.edges.filter(e=>set.has(e.from)&&!set.has(e.to)),terminals=[...new Set(outputs.map(e=>e.from))];
 if(terminals.length!==1||outputKind(members.find(n=>n.id===terminals[0]),graph.nodes)!=='signal')throw Error('A function needs one image output; include the final combining node');
 const id=crypto.randomUUID(),inputs=[],incoming=graph.edges.filter(e=>!set.has(e.from)&&set.has(e.to));
 for(const e of incoming){
  let input=inputs.find(p=>p.source===e.from);
  if(!input){input={port:inputs.length?'in-'+inputs.length:'base',kind:outputKind(graph.nodes.find(n=>n.id===e.from),graph.nodes),source:e.from,targets:[]};inputs.push(input);}
  input.targets.push({node:e.to,port:e.port});
 }
 const fn={id,type:'Function',label,members:[...set],output:terminals[0],inputs:inputs.map(({source,...p})=>p),x:Math.min(...members.filter(n=>!isParameter(n)).map(n=>n.x)),y:Math.min(...members.map(n=>n.y))};
 const edges=graph.edges.filter(e=>!incoming.includes(e)&&!outputs.includes(e));
 for(const input of inputs)edges.push({from:input.source,to:id,port:input.port});
 for(const e of outputs)edges.push({...e,from:id});
 return {graph:{...graph,nodes:[...graph.nodes,fn],edges},node:fn};
}
