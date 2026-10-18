import {snapMove} from './transform-snap.mjs';
import React,{useEffect,useRef} from 'react';
import {bounds,inverse,transformPoint} from './scene-transform.mjs';
import {usePointZones} from './point-zones.jsx';
import {shapeControls,moveShapeControl} from './vector-shapes.mjs';
export function ShapeControls({item,world,controller,begin,change,finish,cancel,snap,settings,animations}){
  const group=useRef(),drag=useRef(),current=useRef();current.current={item,world,begin,change,finish,cancel};
  const [w,h]=bounds(item),points=shapeControls(item,w,h);
  const zones=usePointZones({identity:item.id+item.shape,settings,animations,enabled:!item.locked&&item.visible,points:()=>{const matrix=group.current?.ownerSVGElement.getScreenCTM();return matrix?points.map(p=>{const q=transformPoint(world,p);return new DOMPoint(q.x,q.y).matrixTransform(matrix);}):[];}});
  const pick=e=>zones.pick(e);
  const stop=abort=>{if(!drag.current)return false;drag.current=null;abort?current.current.cancel():current.current.finish();return true;};
  controller.current={
    down:e=>{if(e.button!==0||item.locked||!item.visible)return false;const matrix=group.current?.ownerSVGElement.getScreenCTM();if(!matrix||!inverse(world))return false;const near=pick(e);if(!near)return false;e.preventDefault();e.stopPropagation();begin();const q=new DOMPoint(e.clientX,e.clientY).matrixTransform(matrix.inverse()),p=transformPoint(inverse(world),q);drag.current={item,world,index:near.index,offset:{x:points[near.index].x-p.x,y:points[near.index].y-p.y}};e.currentTarget.focus({preventScroll:true});e.currentTarget.setPointerCapture(e.pointerId);return true;},
    move:e=>{pick(e);const d=drag.current;if(!d)return false;const q=new DOMPoint(e.clientX,e.clientY).matrixTransform(group.current.ownerSVGElement.getScreenCTM().inverse()),p=transformPoint(inverse(d.world),q);change(d.item.id,moveShapeControl(d.item,...bounds(d.item),d.index,snapMove({x:p.x+d.offset.x,y:p.y+d.offset.y},snap,e.ctrlKey),e.shiftKey),false);e.stopPropagation();return true;},
    up:e=>{if(!drag.current)return false;e.stopPropagation();return stop(false);},cancel:()=>{zones.clear();return stop(true);},leave:()=>{if(!drag.current)zones.clear();}
  };
  useEffect(()=>{const key=e=>{if(drag.current&&(e.key==='Escape'||(e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z')){e.preventDefault();e.stopImmediatePropagation();stop(true);}},blur=()=>stop(true);window.addEventListener('keydown',key,true);window.addEventListener('blur',blur);return()=>{controller.current=null;window.removeEventListener('keydown',key,true);window.removeEventListener('blur',blur);};},[]);
  const matrix=group.current?.ownerSVGElement.getScreenCTM(),scale=Math.max(.001,matrix?Math.hypot(matrix.a,matrix.b):1),zone=zones.hover,zonePoint=zone&&points[zone.index]&&transformPoint(world,points[zone.index]);
  return <g ref={group} data-shape-controls={item.shape} className="selection">{zonePoint&&<circle data-point-zone={zone.index} cx={zonePoint.x} cy={zonePoint.y} r={zone.radius/scale} fill="#39d3df" fillOpacity={zone.opacity} stroke="#39d3df" strokeOpacity={zone.opacity*2} vectorEffect="non-scaling-stroke" pointerEvents="none"/>}{item.shape==='arrow'&&<path d={points.map((p,i)=>{const q=transformPoint(world,p);return `${i?'L':'M'}${q.x} ${q.y}`;}).join(' ')} fill="none" stroke="#39d3df" strokeWidth="1" vectorEffect="non-scaling-stroke" pointerEvents="none"/>}{points.map((p,i)=>{const q=transformPoint(world,p);return <circle key={i} data-shape-point={i} aria-label={`Edit ${item.shape} point ${i+1}`} cx={q.x} cy={q.y} r={5/scale} fill="#143d49" stroke="#39d3df" strokeWidth="2" vectorEffect="non-scaling-stroke" style={{cursor:'crosshair'}}/>;})}</g>;
}
