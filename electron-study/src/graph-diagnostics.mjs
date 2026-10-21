import {noiseTypes} from './procedural-noise.mjs';
import {validateGraph} from './graph-model.mjs';
import {expandedEdges} from './parameter-graph.mjs';
export function diagnoseGraph(graph){
 const messages=[];try{validateGraph(graph);}catch(error){return [{code:'InvalidGraph',severity:'error',message:error.message}];}
 const edges=expandedEdges(graph),nodes=new Map(graph.nodes.map(n=>[n.id,n])),used=new Set();
 function visit(id){if(used.has(id))return;used.add(id);const n=nodes.get(id);if(n?.type==='Function')visit(n.output);for(const e of edges.filter(e=>e.to===id))visit(e.from);}
 visit('output');
 if(!edges.some(e=>e.to==='output'&&e.port==='base'))messages.push({code:'EmptyOutput',severity:'warning',node:'output',message:'Render has no input. Selection/Geometry connections do not create an exported image.'});
 for(const n of graph.nodes){
  if(n.enabled===false)messages.push({code:'Bypassed',severity:'info',node:n.id,message:(n.label??n.type)+' is bypassed; its settings are retained.'});
  if(!used.has(n.id)&&!['input','output'].includes(n.id))messages.push({code:'Unused',severity:'info',node:n.id,message:(n.label??n.type)+' is not connected to any Output channel.'});
  if(used.has(n.id)&&!['Input','Output','Function','NodeInput','Paint_Mask','Gradient','SolidColor','RectangleMask','BitmapMask',...noiseTypes].includes(n.type)&&!n.type.endsWith('Parameter')&&!edges.some(e=>e.to===n.id&&e.port==='base'))messages.push({code:'MissingInput',severity:'warning',node:n.id,message:n.type+' has no image connected to base.'});
 }
 if(!messages.length)messages.push({code:'Ready',severity:'ok',message:'Graph connections are valid. Render, Selection and Geometry are traced independently.'});
 return messages;
}
