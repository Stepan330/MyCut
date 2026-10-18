import React from 'react';
import {NodeFields} from './node-fields.jsx';
import {nodeSpec} from './generator-nodes.mjs';
import {graphOperations} from './blend-modes.mjs';
export function GraphNodeDetails({node,owner,graph,changeOperation,changeParameter,locked,Icon,begin,finish,cancel}){
  const spec=nodeSpec(node.type),operation=graphOperations.includes(node.type),connections=graph.edges.filter(e=>e.to===node.id);
  return <section className="graph-node-details" aria-label="Selected node parameters"><h3><Icon name={node.type==='NodeInput'?'cube':'settings'} size={22}/>{node.type}</h3><p className="muted">Graph: {owner.name}</p>{spec&&<fieldset><legend>{spec.label}</legend><NodeFields owner={owner} node={node} graph={graph} expanded hideToggle labelPrefix="Node" locked={locked} begin={begin} finish={finish} cancel={cancel} change={changeParameter}/></fieldset>}{operation&&<fieldset><legend>Blending operation</legend><div className="node-operation-choices" role="radiogroup" aria-label="Node operation">{graphOperations.map(type=><button key={type} className="button" role="radio" aria-checked={node.type===type} disabled={locked} onClick={()=>changeOperation(type)}>{type}</button>)}</div></fieldset>}<details open><summary>Connections</summary><div className="properties">{connections.length?connections.map(e=><p key={e.port}>{e.port}: {graph.nodes.find(n=>n.id===e.from)?.type??e.from}</p>):<p className="muted">No incoming connections</p>}</div></details></section>;
}
