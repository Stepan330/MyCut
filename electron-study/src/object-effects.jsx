import React,{useState} from 'react';
import {graphFor} from './graph-model.mjs';
import {nodeSpec} from './generator-nodes.mjs';
import {effectPresets,parameterSpec,parameterValue,setExposedValue,removeObjectEffect,addObjectEffect} from './object-effects.mjs';
import {PropertyRow} from './property-row.jsx';
import {ScrubNumber} from './scrub-number.jsx';
import {GradientEditor} from './gradient-editor.jsx';
export function ObjectEffects({owner,update,locked,begin,finish,cancel,Icon}){
 const [error,setError]=useState('');
 const graph=graphFor(owner),parameters=owner.exposedParameters??[],effects=owner.objectEffects??[];
 const rename=(p,patch,record=false)=>update({...owner,exposedParameters:parameters.map(v=>v.id===p.id?{...v,...patch}:v)},record);
 const value=(p,v,record=true)=>{try{update(setExposedValue(owner,p.id,v),record);}catch(e){setError(e.message);}};
 function control(p){
  const spec=parameterSpec(graph,p.targets[0])??nodeSpec(graph.nodes.find(n=>n.id===p.parameterNode)?.type)?.parameters[0];if(!spec)return null;
  const specs=p.targets.map(t=>parameterSpec(graph,t)),min=specs.length?Math.max(...specs.map(p=>p?.min??-1e7)):(spec.min??-1e7),max=specs.length?Math.min(...specs.map(p=>p?.max??1e7)):(spec.max??1e7),v=parameterValue(graph,p);
  const options=graph.nodes.filter(n=>!n.type.endsWith('Parameter')).flatMap(n=>(nodeSpec(n.type)?.parameters??[]).filter(s=>s.type===spec.type&&['number','color','checkbox','select'].includes(s.type)&&(!s.options||JSON.stringify(s.options)===JSON.stringify(spec.options))&&!p.targets.some(t=>t.node===n.id&&t.key===s.id)).map(s=>({node:n.id,key:s.id,label:n.type+' · '+s.label})));
  return <div key={p.id} className="exposed-parameter" data-exposed-parameter={p.id} data-parameter-id={owner.id+'/'+(p.parameterNode??p.id)}>
   <PropertyRow label={p.name}>{spec.type==='stops'?<GradientEditor value={v} disabled={locked} onChange={v=>value(p,v)}/>:spec.type==='number'?<ScrubNumber label={'Effect '+p.name} value={v} min={min} max={max} step={spec.step} disabled={locked} begin={begin} finish={finish} cancel={cancel} onChange={v=>value(p,v,false)}/>:spec.type==='select'?<select aria-label={'Effect '+p.name} disabled={locked} value={v} onChange={e=>value(p,e.target.value)}>{spec.options.map(o=><option key={o}>{o}</option>)}</select>:spec.type==='checkbox'?<input type="checkbox" aria-label={'Effect '+p.name} disabled={locked} checked={!!v} onChange={e=>value(p,e.target.checked)}/>:<input type={spec.type==='color'?'color':'text'} aria-label={'Effect '+p.name} disabled={locked} value={v} onChange={e=>value(p,e.target.value)}/>}</PropertyRow>
   <details className="parameter-binding"><summary>{p.targets.length>1?p.targets.length+' linked settings':'Parameter settings'}</summary>
    <label>Name<input aria-label={'Parameter name '+p.id} disabled={locked} value={p.name} onFocus={begin} onBlur={finish} onChange={e=>rename(p,{name:e.target.value})}/></label>
    <label>Group<input aria-label={'Parameter group '+p.id} disabled={locked} defaultValue={p.group} onFocus={begin} onBlur={e=>{rename(p,{group:e.target.value});finish();}}/></label>
    <select aria-label={'Link parameter '+p.name} disabled={locked} value="" onChange={e=>{if(!e.target.value)return;const t=options[+e.target.value],other=parameters.find(v=>v.id!==p.id&&v.targets.some(x=>x.node===t.node&&x.key===t.key)),next={...owner,exposedParameters:parameters.filter(v=>v.id!==other?.id).map(v=>v.id===p.id?{...v,targets:[...v.targets,...(other?.targets??[{node:t.node,key:t.key}])]}:v)};try{update(setExposedValue(next,p.id,v));setError('');}catch(e){setError(e.message);}}}><option value="">Link another node setting…</option>{options.map((o,i)=><option value={i} key={o.node+o.key}>{o.label}</option>)}</select>
    <button className="button" disabled={locked} onClick={()=>update({...owner,exposedParameters:parameters.filter(v=>v.id!==p.id)})}>Unexpose parameter</button>
   </details>
  </div>;
 }
 const groups=[...new Set(parameters.filter(p=>!p.effect).map(p=>p.group))];
 return <section className="object-effects" aria-label="Object effects"><h3><Icon name="settings"/> Effects & Parameters</h3>{error&&<p role="status">{error}</p>}
  <select aria-label="Add object effect" value="" disabled={locked} onChange={e=>{if(e.target.value)try{update(addObjectEffect(owner,e.target.value));setError('');}catch(error){setError(error.message);}}}><option value="">Add effect…</option>{effectPresets.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}</select>
  {effects.map(effect=><details key={effect.id} className="effect-tree-row" data-disabled={effect.enabled===false} data-object-effect={effect.id}><summary><button className="effect-eye" aria-label={'Toggle effect '+effect.name} aria-pressed={effect.enabled!==false} disabled={locked} onClick={e=>{e.preventDefault();const enabled=effect.enabled===false;update({...owner,objectEffects:effects.map(v=>v.id===effect.id?{...v,enabled}:v),graph:{...graph,nodes:graph.nodes.map(n=>(effect.functionId?n.id===effect.functionId:effect.nodes.includes(n.id))?{...n,enabled}:n)}});}}><Icon name="eye"/></button><Icon name="chevron" size={12}/><Icon name="settings"/><span>{effect.name}</span><button className="effect-remove" disabled={locked} aria-label={'Remove effect '+effect.name} onClick={e=>{e.preventDefault();update(removeObjectEffect(owner,effect.id));}}><Icon name="close" size={13}/></button></summary><div className="properties adaptive-properties">{parameters.filter(p=>p.effect===effect.id).map(control)}</div></details>)}
  {groups.map(group=><details key={group} open><summary>{group||'Parameters'}</summary><div className="properties adaptive-properties">{parameters.filter(p=>!p.effect&&p.group===group).map(control)}</div></details>)}
 </section>;
}
