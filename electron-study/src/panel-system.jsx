import React,{useId,useState} from 'react';

// Reusable, state-preserving tab host for arbitrary panels, not tool-specific UI.
export function PanelTabs({tabs,label,initial}){
  const [active,setActive]=useState(initial??tabs[0]?.id),prefix=useId();
  const current=tabs.some(t=>t.id===active)?active:tabs[0]?.id;
  return <div className="panel-tabs"><div role="tablist" aria-label={label}>{tabs.map((t,i)=><button key={t.id} role="tab" id={`${prefix}-${t.id}`} aria-controls={`${prefix}-page-${t.id}`} aria-selected={current===t.id} tabIndex={current===t.id?0:-1} onClick={()=>setActive(t.id)} onKeyDown={e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const index=e.key==='Home'?0:e.key==='End'?tabs.length-1:(i+(e.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;setActive(tabs[index].id);e.currentTarget.parentElement.children[index].focus();}}>{t.icon}{t.label}</button>)}</div>{tabs.map(t=><div key={t.id} role="tabpanel" id={`${prefix}-page-${t.id}`} aria-labelledby={`${prefix}-${t.id}`} hidden={current!==t.id}>{t.content}</div>)}</div>;
}
export function swallowGesture(){
  const names=['pointermove','pointerup','pointercancel','mousedown','mouseup','click','contextmenu'];let timer;
  const cleanup=()=>{clearTimeout(timer);for(const name of names)window.removeEventListener(name,stop,true);};
  const stop=e=>{e.preventDefault();e.stopImmediatePropagation();if(['pointerup','pointercancel','click'].includes(e.type)){clearTimeout(timer);timer=setTimeout(cleanup,0);}};
  for(const name of names)window.addEventListener(name,stop,true);timer=setTimeout(cleanup,2000);
}
