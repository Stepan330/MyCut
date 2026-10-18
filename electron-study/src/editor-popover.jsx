import React,{useEffect,useLayoutEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
// Shared top-level surface: never clipped/scaled by a dock or canvas ancestor.
export function EditorPopover({anchor,title,close,children}){
 const ref=useRef(),[position,setPosition]=useState({left:8,top:8});
 useLayoutEffect(()=>{const place=()=>{const a=anchor.current?.getBoundingClientRect(),r=ref.current?.getBoundingClientRect();if(!a||!r)return;setPosition({left:Math.max(8,Math.min(a.left,innerWidth-r.width-8)),top:Math.max(8,Math.min(a.bottom+6,innerHeight-r.height-8))});};place();const observer=new ResizeObserver(place);if(ref.current)observer.observe(ref.current);window.addEventListener('resize',place);return()=>{observer.disconnect();window.removeEventListener('resize',place);};},[]);
 useEffect(()=>{const before=document.activeElement;ref.current?.focus({preventScroll:true});const outside=e=>{if(ref.current?.contains(e.target)||anchor.current?.contains(e.target))return;close();};document.addEventListener('pointerdown',outside,true);return()=>{document.removeEventListener('pointerdown',outside,true);if(before?.isConnected)before.focus({preventScroll:true});};},[]);
 return createPortal(<section ref={ref} className="editor-popover" role="dialog" aria-label={title} tabIndex={-1} style={position} onPointerDown={e=>e.stopPropagation()} onKeyDown={e=>{e.stopPropagation();if(e.key==='Escape'){e.preventDefault();close();}}}><header><strong>{title}</strong><button type="button" aria-label={`Close ${title}`} onClick={close}>×</button></header>{children}</section>,document.body);
}
