import {expandedEdges,isParameter} from './parameter-graph.mjs';
// Stable identity, never a label/value comparison. Displaying this relation
// must not select a node, focus a field, change geometry or mutate a document.
export function parameterIdentity(owner,graph,node,key){
 if(!owner||!node)return undefined;
 const source=isParameter(node)?node.id:expandedEdges(graph??{nodes:[],edges:[]}).find(e=>e.to===node.id&&e.port==='param:'+key)?.from;
 const exposed=owner.exposedParameters?.find(p=>source?p.parameterNode===source:p.targets.some(t=>t.node===node.id&&t.key===key));
 return owner.id+'/'+(source??exposed?.id??node.id+'/'+key);
}
