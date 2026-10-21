import {sharedDefinitions,validateRuntimeGraph} from './engine-runtime.mjs';
export const nodeFields={
 Float:{value:{min:-10,max:10,step:.01}},Time:{speed:{min:0,max:10,step:.1}},
 Spring:{frequency:{min:.5,max:30,step:.5},damping:{min:.05,max:.99,step:.01}},
 Remap:{inMin:{min:-10,max:10,step:.01},inMax:{min:-10,max:10,step:.01},outMin:{min:-10,max:10,step:.01},outMax:{min:-10,max:10,step:.01},clamp:{type:'boolean'}},
 MaterialScale:{amplitude:{min:0,max:5,step:.1,default:1}},MaterialSkew:{amplitude:{min:0,max:5,step:.1,default:1}},
 Noise2D:{kind:{options:['ValueNoise','PerlinNoise','WorleyNoise','FractalNoise']},seed:{min:0,max:1000000,step:1},scale:{min:.1,max:300,step:.1},roughness:{min:0,max:1,step:.01,default:.5},octaves:{min:1,max:8,step:1,default:4},contrast:{min:.1,max:5,step:.1,default:1}},
};
export function editRuntimeNode(graph,id,key,value){
 const node=graph.nodes.find(n=>n.id===id),field=nodeFields[node?.type]?.[key];if(!field)throw Error('Node parameter is not editable');
 if(field.options?!field.options.includes(value):field.type==='boolean'?typeof value!=='boolean':!Number.isFinite(value)||value<field.min||value>field.max||field.step===1&&!Number.isInteger(value))throw Error('Node parameter outside range');
 const next={...graph,nodes:graph.nodes.map(n=>n.id===id?{...n,params:{...n.params,[key]:value}}:n)};
 if(node.type==='Remap'){const p=next.nodes.find(n=>n.id===id).params;if(p.inMin===p.inMax)throw Error('Remap range cannot be zero');}
 return validateRuntimeGraph(next);
}
export function connectRuntimeNode(graph,to,port,from){
 const target=graph.nodes.find(n=>n.id===to),source=graph.nodes.find(n=>n.id===from);if(!target||!source||sharedDefinitions.get(target.type)?.inputs[port]!==sharedDefinitions.get(source.type)?.output)throw Error('Incompatible node input');
 return validateRuntimeGraph({...graph,edges:[...graph.edges.filter(e=>e.to!==to||e.port!==port),{from,to,port}]});
}
