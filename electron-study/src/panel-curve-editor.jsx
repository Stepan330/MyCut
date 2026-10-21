import React,{useEffect,useRef,useState} from 'react';
import {curveTangents,defaultPanelCurve,samplePanelCurve} from './panel-curves.mjs';
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v)),plot={x:44,y:18,width:420,height:150};
export function PanelCurveEditor({phase,curve,change,disabled=false}){
 const [draft,setDraft]=useState(curve),[selected,setSelected]=useState(curve.keys[0].id),drag=useRef(),svg=useRef();
 useEffect(()=>{if(!drag.current)setDraft(curve);},[curve]);
 const title=phase==='grab'?'Grab':'Release',index=draft.keys.findIndex(k=>k.id===selected),key=draft.keys[Math.max(0,index)],keyIndex=Math.max(0,index),slopes=curveTangents(draft,keyIndex),x=t=>plot.x+t*plot.width,y=value=>plot.y+(1-value)*plot.height;
 function commit(next){setDraft(next);change(next);}
 function updateKey(values){const next={...draft,keys:draft.keys.map(k=>k.id===key.id?{...k,...values}:k)};commit(next);}
 function point(e){const p=new DOMPoint(e.clientX,e.clientY).matrixTransform(svg.current.getScreenCTM().inverse());return {t:clamp((p.x-plot.x)/plot.width),value:clamp(1-(p.y-plot.y)/plot.height)};}
 function start(e,id,handle){if(disabled||e.button!==0)return;e.preventDefault();e.stopPropagation();setSelected(id);drag.current={id,handle,before:draft,next:draft,pointer:e.pointerId};svg.current.setPointerCapture(e.pointerId);svg.current.focus({preventScroll:true});}
 function move(e){const d=drag.current;if(!d)return;const p=point(e),i=d.before.keys.findIndex(k=>k.id===d.id),k=d.before.keys[i];let changed;
  if(d.handle){const dx=d.handle==='in'?Math.min(-.005,p.t-k.t):Math.max(.005,p.t-k.t),slope=clamp((p.value-k.value)/dx,-20,20),old=curveTangents(d.before,i);changed={...k,mode:'free',inTangent:old.in,outTangent:old.out,[d.handle+'Tangent']:slope};}
  else changed={...k,t:i===0?0:i===d.before.keys.length-1?1:clamp(p.t,d.before.keys[i-1].t+.001,d.before.keys[i+1].t-.001),value:p.value};
  d.next={...d.before,keys:d.before.keys.map(n=>n.id===d.id?changed:n)};setDraft(d.next);
 }
 function stop(cancel=false){const d=drag.current;if(!d)return;drag.current=null;if(svg.current.hasPointerCapture(d.pointer))svg.current.releasePointerCapture(d.pointer);if(cancel)setDraft(d.before);else commit(d.next);}
 function add(e){if(disabled||draft.keys.length>=64)return;const p=point(e);if(p.t<.005||p.t>.995||draft.keys.some(k=>Math.abs(k.t-p.t)<.003))return;const id=crypto.randomUUID();commit({...draft,keys:[...draft.keys,{id,t:p.t,value:p.value,mode:'smooth'}].sort((a,b)=>a.t-b.t)});setSelected(id);}
 const path=Array.from({length:161},(_,i)=>`${i?'L':'M'}${x(i/160)} ${y(samplePanelCurve(draft,draft.duration*i/160))}`).join(' '),handle=(side,slope)=>{const dx=(side==='in'?-.08:.08),ht=clamp(key.t+dx),hy=clamp(key.value+(ht-key.t)*slope);return <g key={side}><line x1={x(key.t)} y1={y(key.value)} x2={x(ht)} y2={y(hy)}/><circle aria-label={title+' '+side+' tangent'} role="button" cx={x(ht)} cy={y(hy)} r="4" onPointerDown={e=>start(e,key.id,side)}/></g>;};
 return <section className="panel-curve-editor" aria-label={title+' curve editor'}><header><strong>{title==='Grab'?'Захват / отрыв':'Отпускание / посадка'}</strong><label>Длительность, с<input aria-label={title+' curve duration'} type="number" min=".02" max="30" step=".05" disabled={disabled} value={draft.duration} onChange={e=>{const n=+e.target.value;if(n>=.02&&n<=30)commit({...draft,duration:n});}}/></label></header>
  <svg ref={svg} viewBox="0 0 488 202" role="application" tabIndex="0" aria-label={title+' curve canvas'} onDoubleClick={add} onPointerMove={move} onPointerUp={()=>stop()} onPointerCancel={()=>stop(true)} onLostPointerCapture={()=>stop(true)} onKeyDown={e=>{if(e.key==='Escape'&&drag.current){e.preventDefault();e.stopPropagation();stop(true);}}}>
   <rect x={plot.x} y={plot.y} width={plot.width} height={plot.height} className="curve-plot"/>
   {[0,.25,.5,.75,1].map(t=><g key={t} className="curve-grid"><line x1={x(t)} x2={x(t)} y1={plot.y} y2={plot.y+plot.height}/><line x1={plot.x} x2={plot.x+plot.width} y1={y(t)} y2={y(t)}/><text x={x(t)} y="190" textAnchor="middle">{(t*draft.duration).toFixed(2)}s</text><text x="34" y={y(t)+4} textAnchor="end">{t}</text></g>)}
   <path d={path} className="curve-line"/>
   {!disabled&&!['hold','linear'].includes(key.mode)&&<g className="curve-tangents">{key.t>0&&handle('in',slopes.in)}{key.t<1&&handle('out',slopes.out)}</g>}
   {draft.keys.map(k=><circle key={k.id} role="button" aria-label={title+' key '+k.id} aria-pressed={k.id===selected} cx={x(k.t)} cy={y(k.value)} r={k.id===selected?6:5} className="curve-key" onPointerDown={e=>start(e,k.id)} onClick={()=>setSelected(k.id)}/>)}
  </svg>
  <div className="curve-key-fields"><label>Время, с<input aria-label={title+' key time'} type="number" step=".01" min="0" max={draft.duration} value={+(key.t*draft.duration).toFixed(4)} disabled={disabled||keyIndex===0||keyIndex===draft.keys.length-1} onChange={e=>updateKey({t:clamp(+e.target.value/draft.duration,draft.keys[keyIndex-1].t+.001,draft.keys[keyIndex+1].t-.001)})}/></label><label>Следование<input aria-label={title+' key value'} type="number" min="0" max="1" step=".05" value={+key.value.toFixed(4)} disabled={disabled} onChange={e=>updateKey({value:clamp(+e.target.value)})}/></label><label>Сегмент<select aria-label={title+' key interpolation'} value={key.mode} disabled={disabled} onChange={e=>updateKey({mode:e.target.value})}><option value="hold">Hold</option><option value="linear">Linear</option><option value="smooth">Smooth</option><option value="free">Free tangents</option></select></label>
   {key.mode==='free'&&['in','out'].map(side=><label key={side}>{side} tangent<input aria-label={title+' '+side+' tangent value'} type="number" min="-20" max="20" step=".1" value={+slopes[side].toFixed(4)} disabled={disabled} onChange={e=>updateKey({[side+'Tangent']:clamp(+e.target.value,-20,20)})}/></label>)}
   <button disabled={disabled||keyIndex===0||keyIndex===draft.keys.length-1} onClick={()=>{commit({...draft,keys:draft.keys.filter(k=>k.id!==key.id)});setSelected(draft.keys[0].id);}}>Удалить точку</button><button disabled={disabled} onClick={()=>{commit(defaultPanelCurve(phase));setSelected('start');}}>Сброс</button></div>
  <p>0 — инерция / прежнее место · 1 — позиция души. Двойной клик добавляет точку; точки и касательные можно тянуть.</p>
 </section>;
}
