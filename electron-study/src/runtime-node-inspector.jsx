import React from 'react';
import {sharedDefinitions} from './engine-runtime.mjs';
import {nodeFields} from './lab-editors.mjs';
export function RuntimeNodeInspector({graph,selected,change,connect,disabled=false,prefix='Behavior'}){
 const node=graph.nodes.find(n=>n.id===selected);if(!node)return null;const spec=sharedDefinitions.get(node.type),fields=nodeFields[node.type]??{};
 return <div className="lab-graph-inspector"><strong>{node.label??node.type} · {spec.output}</strong>
  {Object.entries(fields).map(([key,field])=><label key={key}>{key}{field.options?<select aria-label={prefix+' '+key} disabled={disabled} value={node.params?.[key]??field.options[0]} onChange={e=>change(node.id,key,e.target.value)}>{field.options.map(o=><option key={o}>{o}</option>)}</select>:<input aria-label={prefix+' '+key} disabled={disabled} type={field.type==='boolean'?'checkbox':'number'} min={field.min} max={field.max} step={field.step} checked={field.type==='boolean'?!!node.params?.[key]:undefined} value={field.type==='boolean'?undefined:node.params?.[key]??field.default??0} onChange={e=>change(node.id,key,field.type==='boolean'?e.target.checked:+e.target.value)}/>}</label>)}
  {Object.entries(spec.inputs).map(([port,type])=><label key={port}>{port} ({type})<select aria-label={prefix+' input '+port} disabled={disabled} value={graph.edges.find(e=>e.to===node.id&&e.port===port)?.from??''} onChange={e=>connect(node.id,port,e.target.value)}><option value="" disabled>Not connected</option>{graph.nodes.filter(n=>n.id!==node.id&&sharedDefinitions.get(n.type)?.output===type).map(n=><option key={n.id} value={n.id}>{n.label??n.id}</option>)}</select></label>)}
  {!Object.keys(fields).length&&!Object.keys(spec.inputs).length&&<span>Этот узел читает контекст, у него нет постоянных параметров.</span>}
 </div>;
}
