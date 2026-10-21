// Existing projects keep their Render-derived behavior until explicitly wired.
// Newly created graphs provide exact source Selection/Geometry by default.
export const outputRoles=['base','selection','geometry'];
export function outputSource(graph,role='base'){
 if(!graph)return 'input';
 return graph.edges.find(e=>e.to==='output'&&e.port===role)?.from??graph.edges.find(e=>e.to==='output'&&e.port==='base')?.from??'output';
}
export function interactionSource(owner,role,preview){
 if(preview&&preview!=='output')return preview;
 return outputSource(owner?.graph,role);
}
export function graphForRole(graph,role){
 if(!graph?.edges.some(e=>e.to==='output'&&e.port===role))return graph;
 return {...graph,edges:[...graph.edges.filter(e=>e.to!=='output'),{from:outputSource(graph,role),to:'output',port:'base'}]};
}
