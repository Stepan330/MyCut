import React,{useEffect,useRef,useState} from 'react';
import {scrubValue} from './scrub-value.mjs';
import {commandForKey} from './editor-commands.mjs';
export function ScrubNumber({label,value,onChange,begin,finish,cancel,step=1,min=-Infinity,max=Infinity,disabled=false,roundDrag=step>=1}){
  const [draft,setDraft]=useState(String(value)),focused=useRef(false),gesture=useRef(null),editing=useRef(false),cfg=useRef();cfg.current={value,onChange,begin,finish,cancel};
  useEffect(()=>{if(!focused.current&&!gesture.current?.drag)setDraft(String(value));},[value]);
  function abort(){const g=gesture.current;if(!g?.drag)return;gesture.current=null;cfg.current.cancel();setDraft(String(g.value));}
  useEffect(()=>{const keys=e=>{if(gesture.current?.drag&&(e.key==='Escape'||commandForKey(e)==='undo')){e.preventDefault();e.stopImmediatePropagation();abort();}};window.addEventListener('keydown',keys,true);window.addEventListener('blur',abort);return()=>{window.removeEventListener('keydown',keys,true);window.removeEventListener('blur',abort);};},[]);
  return <input className="scrub-number" type="text" inputMode="decimal" role="spinbutton" aria-valuenow={value} aria-valuemin={Number.isFinite(min)?min:undefined} aria-valuemax={Number.isFinite(max)?max:undefined} aria-label={label} disabled={disabled} value={draft} title="Drag horizontally to change · double-click to type · Shift: ×10 · Ctrl: ×0.1 · Escape: cancel"
    onFocus={()=>{focused.current=true;begin();}} onBlur={()=>{focused.current=false;editing.current=false;finish();setDraft(String(cfg.current.value));}}
    onChange={e=>{setDraft(e.target.value);if(e.target.value.trim()&&Number.isFinite(Number(e.target.value)))onChange(Math.max(min,Math.min(max,Number(e.target.value))));}}
    onDoubleClick={e=>{editing.current=true;e.currentTarget.focus();e.currentTarget.select();}}
    onPointerDown={e=>{if(e.button!==0||editing.current)return;e.preventDefault();gesture.current={x:e.clientX,value:cfg.current.value,drag:false};e.currentTarget.setPointerCapture(e.pointerId);}}
    onPointerMove={e=>{const g=gesture.current;if(!g)return;const dx=e.clientX-g.x;if(!g.drag&&Math.abs(dx)<3)return;if(!g.drag){g.drag=true;if(focused.current)finish();begin();}const next=scrubValue(g.value,dx,step,e,min,max,roundDrag);setDraft(String(next));onChange(next);}}
    onPointerUp={e=>{const g=gesture.current;gesture.current=null;if(!g)return;if(g.drag)finish();else {e.currentTarget.focus();e.currentTarget.select();}}}
    onPointerCancel={abort} onLostPointerCapture={abort}
    onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();cancel();e.currentTarget.blur();}if(e.key==='Enter')e.currentTarget.blur();if(e.key==='ArrowUp'||e.key==='ArrowDown'){e.preventDefault();const next=scrubValue(value,e.key==='ArrowUp'?1:-1,step,e,min,max);setDraft(String(next));onChange(next);}}}/>;
}
