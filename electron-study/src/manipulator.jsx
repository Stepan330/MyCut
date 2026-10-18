import React,{useEffect,useRef,useState} from 'react';
import {SnapGrid} from './snap-grid.jsx';
import {snapActive,snapMove,snapRotation} from './transform-snap.mjs';
import {commandForKey} from './editor-commands.mjs';
import {bounds} from './model.mjs';
import {AdaptiveZones,handles,resizeItem,worldPoint,rotationRing,ringProjection,ringSegments,angleDelta,rotationValue} from './interaction.mjs';
import {inverse,transformPoint,localMatrix} from './scene-transform.mjs';

export function useManipulator(config){
  const cfg=useRef(config);cfg.current=config;
  const drag=useRef(null),pointer=useRef(null),motion=useRef({speed:0,time:0}),zones=useRef(new AdaptiveZones(9));
  const frame=useRef(0),last=useRef(0),visual=useRef({radius:0,opacity:0,x:0,y:0}),host=useRef();
  const [overlay,setOverlay]=useState(null),[cursor,setCursor]=useState(null),[points,setPoints]=useState([]);
  const [ringLines,setRingLines]=useState([]),[snapGrid,setSnapGrid]=useState(null);
  const hideGrid=()=>setSnapGrid(old=>old?.active?{...old,active:false}:old);
  function canvasPoint(point){return new DOMPoint(point.x,point.y).matrixTransform(cfg.current.svg.current.getScreenCTM().inverse());}
  function space(item=cfg.current.item){return cfg.current.spaceFor(item?.id);}
  function box(item=cfg.current.item){return cfg.current.boxFor?.(item?.id)??(item?{x:0,y:0,width:bounds(item)[0],height:bounds(item)[1]}:null);}
  function scenePoint(point,item=cfg.current.item){return transformPoint(inverse(space(item)),canvasPoint(point));}
  function geometry(){
    const {item,svg}=cfg.current;if(!item||item.locked||!item.visible||!svg.current)return [];
    const matrix=svg.current.getScreenCTM(),rect=box();if(!matrix||!inverse(space())||!rect)return [];
    return handles.map(([u,v],index)=>{const world=worldPoint(item,bounds(item),u,v,rect),canvas=transformPoint(space(),world),screen=new DOMPoint(canvas.x,canvas.y).matrixTransform(matrix);return {index,world,screen};});
  }
  function nearest(points,radii){
    if(!pointer.current)return null;
    // A tiny dot's entire interior must not become overlapping resize zones.
    if(points.length===8&&Math.min(Math.hypot(points[2].screen.x-points[0].screen.x,points[2].screen.y-points[0].screen.y),Math.hypot(points[5].screen.x-points[0].screen.x,points[5].screen.y-points[0].screen.y))<cfg.current.settings.base*2){
      const inv=inverse(localMatrix(cfg.current.item)),rect=box(),p=inv&&transformPoint(inv,scenePoint(pointer.current));
      if(p&&p.x>rect.x+rect.width*.2&&p.x<rect.x+rect.width*.8&&p.y>rect.y+rect.height*.2&&p.y<rect.y+rect.height*.8)return null;
    }
    return points.map((p,i)=>({...p,distance:Math.hypot(p.screen.x-pointer.current.x,p.screen.y-pointer.current.y),radius:radii[i]})).filter(p=>p.distance<=p.radius).sort((a,b)=>a.distance-b.distance)[0]||null;
  }
  function ringFor(points){
    if(points.length!==8)return null;
    const {item,svg,settings}=cfg.current;if(!item)return null;const center=transformPoint(space(),worldPoint(item,bounds(item),.5,.5,box()));
    const screen=new DOMPoint(center.x,center.y).matrixTransform(svg.current.getScreenCTM());
    return rotationRing(screen,points.map(p=>p.screen),settings);
  }
  function rotationHit(ring,radius,force=false){
    if(!ring)return null;const projection=ringProjection(ring,pointer.current);
    return projection&&(force||projection.available&&projection.distance<=radius)?{type:'rotate',world:scenePoint(projection.point),radius}:null;
  }
  function clearTransfer(){const d=drag.current;if(d?.previewElement){d.previewElement.style.opacity=d.previewOpacity;delete d.previewElement.dataset.panelTransfer;d.previewElement=null;}}
  function cancelDrag(){hideGrid();if(drag.current){clearTransfer();drag.current=null;cfg.current.cancel();}schedule();}
  function schedule(){if(!frame.current)frame.current=requestAnimationFrame(tick);}
  function tick(now){
    frame.current=0;const dt=Math.min(.05,last.current?(now-last.current)/1000:.016);last.current=now;
    const points=geometry(),settings=cfg.current.settings;setPoints(points);
    const ring=ringFor(points),projection=ring&&ringProjection(ring,pointer.current);
    const distances=Array.from({length:8},(_,i)=>points[i]&&pointer.current?Math.hypot(points[i].screen.x-pointer.current.x,points[i].screen.y-pointer.current.y):Infinity);
    distances.push(projection?.available?projection.distance:Infinity);
    const speed=motion.current.speed*Math.exp(-(now-motion.current.time)/60);
    const radii=zones.current.update(speed,distances,dt,settings);
    const active=drag.current?.type==='resize'?points[drag.current.index]:null;
    const hit=drag.current?.type==='rotate'?rotationHit(ring,radii[8],true):active?{...active,radius:radii[active.index]}:nearest(points,radii)||rotationHit(ring,radii[8]);
    setRingLines(ring?ringSegments(ring,pointer.current).map(segment=>({...segment,a:canvasPoint(segment.a),b:canvasPoint(segment.b)})):[]);
    const target=hit?{x:hit.world.x,y:hit.world.y,radius:hit.radius,opacity:.2}:{...visual.current,radius:visual.current.radius,opacity:0};
    const matrix=cfg.current.svg.current?.getScreenCTM(),screenScale=matrix?Math.hypot(matrix.a,matrix.b):1;
    const v=visual.current,amount=cfg.current.animations?1-Math.exp(-dt/.085):1;
    if(hit){v.x=target.x;v.y=target.y;}
    v.radius+=(target.radius-v.radius)*amount;v.opacity+=(target.opacity-v.opacity)*amount;
    const canvas=transformPoint(space(),v);
    setOverlay(v.opacity>.001?{x:canvas.x,y:canvas.y,radius:v.radius/screenScale,opacity:v.opacity,type:hit?.type==='rotate'?'rotate':'resize'}:null);
    if(hit?.type==='rotate')setCursor(drag.current?.type==='rotate'?'grabbing':'grab');
    else if(hit){
      const center=transformPoint(space(),worldPoint(cfg.current.item,bounds(cfg.current.item),.5,.5,box())),point=transformPoint(space(),hit.world);
      const angle=(Math.atan2(point.y-center.y,point.x-center.x)*180/Math.PI+180)%180;
      setCursor(['ew-resize','nwse-resize','ns-resize','nesw-resize'][Math.round(angle/45)%4]);
    }else setCursor(null);
    if(zones.current.extra.some(x=>x>.01)||Math.abs(target.opacity-v.opacity)>.001||Math.abs(target.radius-v.radius)>.05)schedule();
  }
  function resize(event){const d=drag.current;if(!d)return;
    if(d.type==='move'&&Math.hypot(event.clientX-d.screen.x,event.clientY-d.screen.y)>4)d.moved=true;
    if(d.type==='move'&&cfg.current.allowPanelTransfer!==false){
      const panel=document.elementsFromPoint(event.clientX,event.clientY).map(el=>el.closest('[data-dock-group]')).find(Boolean);
      if(panel&&Math.hypot(event.clientX-d.screen.x,event.clientY-d.screen.y)>5){
        d.overPanel=panel;if(!d.previewElement){d.previewElement=cfg.current.svg.current.querySelector(`[data-object="${CSS.escape(d.item.id)}"]`);if(d.previewElement){d.previewOpacity=d.previewElement.style.opacity;d.previewElement.style.opacity='.45';d.previewElement.dataset.panelTransfer='true';}cfg.current.change(d.item.id,{x:d.item.x,y:d.item.y},false);}return;
      }
      if(d.overPanel){d.overPanel=null;clearTransfer();}
    }
    if(!inverse(space(d.item))){cancelDrag();return;}
    let p=scenePoint({x:event.clientX,y:event.clientY},d.item);
    const side=d.type==='resize'&&handles[d.index]?.includes(.5),moveGrid=side&&snapActive(cfg.current.snap,'move',event.ctrlKey);
    if(moveGrid){const handle=worldPoint(d.item,bounds(d.item),...handles[d.index],d.box),target=snapMove({x:handle.x+p.x-d.start.x,y:handle.y+p.y-d.start.y},cfg.current.snap,event.ctrlKey);p={x:target.x-handle.x+d.start.x,y:target.y-handle.y+d.start.y};}
    if((d.type==='move'&&d.moved||d.type==='resize'&&side)&&snapActive(cfg.current.snap,'move',event.ctrlKey)){
      const matrix=cfg.current.svg.current.getScreenCTM(),point=canvasPoint({x:event.clientX,y:event.clientY});
      setSnapGrid({active:true,point,space:space(d.item),step:cfg.current.snap?.moveStep??10,radius:190/Math.max(.001,Math.hypot(matrix.a,matrix.b))});
    }else hideGrid();
    if(d.type==='resize')cfg.current.change(d.item.id,resizeItem(d.item,bounds(d.item),d.index,d.start,p,{shift:event.shiftKey,alt:event.altKey,snapStep:!moveGrid&&cfg.current.snap&&snapActive(cfg.current.snap,'scale',event.ctrlKey)?cfg.current.snap.scaleStep??.1:0},d.box),false);
    else if(d.type==='rotate'){
      const center=worldPoint(d.item,bounds(d.item),.5,.5,d.box),angle=Math.atan2(p.y-center.y,p.x-center.x);
      d.total+=angleDelta(d.lastAngle,angle);d.lastAngle=angle;
      const rotation=snapRotation(rotationValue(d.item.rotation,d.total,{shift:event.shiftKey,ctrl:cfg.current.snap?false:event.ctrlKey}),cfg.current.snap,event.ctrlKey&&!!cfg.current.snap),nextCenter=worldPoint({...d.item,rotation},bounds(d.item),.5,.5,d.box);
      cfg.current.change(d.item.id,{rotation,x:d.item.x+center.x-nextCenter.x,y:d.item.y+center.y-nextCenter.y},false);
    }
    else cfg.current.change(d.item.id,snapMove({x:d.item.x+p.x-d.start.x,y:d.item.y+p.y-d.start.y},cfg.current.snap,event.ctrlKey&&!!cfg.current.snap),false);
    schedule();
  }
  useEffect(()=>{
    const keys=e=>{
      if(drag.current&&commandForKey(e)==='undo'){e.preventDefault();e.stopImmediatePropagation();cancelDrag();return;}
      if(e.key==='Escape'){cancelDrag();return;}
      if(drag.current&&pointer.current&&['Shift','Alt','Control'].includes(e.key))resize({...pointer.current,clientX:pointer.current.x,clientY:pointer.current.y,shiftKey:e.shiftKey,altKey:e.altKey,ctrlKey:e.ctrlKey});
    };
    const blur=()=>{pointer.current=null;cancelDrag();};
    const observer=new ResizeObserver(schedule);if(cfg.current.svg.current)observer.observe(cfg.current.svg.current);
    window.addEventListener('keydown',keys);window.addEventListener('keyup',keys);window.addEventListener('blur',blur);
    return()=>{observer.disconnect();cancelAnimationFrame(frame.current);window.removeEventListener('keydown',keys);window.removeEventListener('keyup',keys);window.removeEventListener('blur',blur);};
  },[]);
  useEffect(()=>{zones.current=new AdaptiveZones(9);schedule();},[config.item?.id,config.item?.locked,config.item?.visible,config.zoom,config.settings]);
  useEffect(()=>{schedule();},[config.item]);
  function start(event,item,index){
    if(event.button!==0||item.locked||!inverse(space(item)))return;event.preventDefault();event.stopPropagation();
    host.current.focus({preventScroll:true});cfg.current.begin();
    drag.current={type:index===undefined?'move':'resize',item:structuredClone(item),box:box(item),index,start:scenePoint({x:event.clientX,y:event.clientY},item),screen:{x:event.clientX,y:event.clientY}};
    if(index==='rotate'){
      const center=worldPoint(item,bounds(item),.5,.5,drag.current.box),p=drag.current.start;
      Object.assign(drag.current,{type:'rotate',lastAngle:Math.atan2(p.y-center.y,p.x-center.x),total:0});
    }
    host.current.setPointerCapture(event.pointerId);schedule();
  }
  const bind={ref:host,style:{cursor:cursor||undefined},'data-resize-hover':!!cursor,
    onPointerDownCapture:event=>{
      pointer.current={x:event.clientX,y:event.clientY};
      const points=geometry(),radii=zones.current.extra.map(x=>cfg.current.settings.base+x);
      const hit=nearest(points,radii)||rotationHit(ringFor(points),radii[8]);
      if(hit&&event.button===0){start(event,cfg.current.item,hit.type==='rotate'?'rotate':hit.index);return true;}return false;
    },
    onPointerMove:event=>{const now=performance.now(),p=pointer.current;
      motion.current={speed:p?Math.min(10000,Math.hypot(event.clientX-p.x,event.clientY-p.y)/Math.max(.001,(now-motion.current.time)/1000)):0,time:now};
      pointer.current={x:event.clientX,y:event.clientY};resize(event);schedule();
    },
    onPointerLeave:()=>{if(!drag.current){pointer.current=null;schedule();}},
    onPointerUp:()=>{hideGrid();if(drag.current){const d=drag.current;clearTransfer();drag.current=null;if(d.overPanel){cfg.current.cancel();const graph=d.overPanel.querySelector('.effects-graph');if(graph?.getClientRects().length)graph.dispatchEvent(new CustomEvent('mycut-canvas-reference',{detail:{id:d.item.id}}));}else {cfg.current.finish();if(d.type==='move'&&!d.moved)cfg.current.onClickItem?.(d.item);}schedule();}},
    onPointerCancel:cancelDrag,onLostPointerCapture:cancelDrag,
  };
  return {bind,startMove:(e,item)=>{cfg.current.select(item.id);if(!item.locked)start(e,item);else e.stopPropagation();},
    overlay:<g className="transform-overlay" pointerEvents="none"><SnapGrid value={snapGrid} animations={config.animations}/>
      <g data-rotation-ring="true" data-screen-x={ringFor(points)?.center.x} data-screen-y={ringFor(points)?.center.y} data-screen-radius={ringFor(points)?.radius}>{ringLines.map((line,i)=><line key={i} x1={line.a.x} y1={line.a.y} x2={line.b.x} y2={line.b.y} stroke="white" strokeOpacity={line.opacity} strokeWidth="1.2" strokeLinecap="round" vectorEffect="non-scaling-stroke"/>)}</g>
      {overlay&&<circle data-zone={overlay.type} cx={overlay.x} cy={overlay.y} r={overlay.radius} fill="#39d3df" fillOpacity={overlay.opacity} stroke="#39d3df" strokeOpacity={overlay.opacity*2} vectorEffect="non-scaling-stroke"/>}
      {points.map(p=>{const matrix=config.svg.current?.getScreenCTM(),size=7/(matrix?Math.hypot(matrix.a,matrix.b):1),canvas=transformPoint(space(),p.world);return <rect key={p.index} {...(config.handleAttribute?{[config.handleAttribute]:p.index}:null)} data-handle={p.index} x={canvas.x-size/2} y={canvas.y-size/2} width={size} height={size} fill="#39d3df"/>;})}
    </g>};
}
