import React,{useLayoutEffect,useRef,useEffect} from 'react';
const duration=380,easing='cubic-bezier(.2,.7,.25,1)';
function fade(el,from,to,finished){const animation=el.animate([{opacity:from},{opacity:to}],{duration,easing});animation.onfinish=()=>{animation.cancel();finished?.();};return animation;}
export function SignalFade({prefix,node,owner,animations=true}){
 const group=useRef(),live=useRef(),previous=useRef(),active=useRef(),ghosts=useRef(new Set());
 useLayoutEffect(()=>{const href='#'+prefix+'-'+node,old=previous.current,enabled=animations&&!matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(old&&old!==href&&enabled){const opacity=Number(getComputedStyle(live.current).opacity),ghost=document.createElementNS('http://www.w3.org/2000/svg','use');ghost.setAttribute('href',old);ghost.dataset.signalGhost='true';ghost.setAttribute('pointer-events','none');ghost.setAttribute('opacity','0');group.current.append(ghost);ghosts.current.add(ghost);fade(ghost,opacity,0,()=>{ghost.remove();ghosts.current.delete(ghost);});active.current?.cancel();active.current=fade(live.current,0,1);}
  else if(!enabled){active.current?.cancel();for(const ghost of ghosts.current)ghost.remove();ghosts.current.clear();}previous.current=href;
 },[prefix,node,animations]);
 useEffect(()=>()=>{active.current?.cancel();for(const ghost of ghosts.current)ghost.remove();},[]);
 return <g ref={group} data-graph-output={owner} data-graph-prefix={prefix} data-display-node={node}><use ref={live} data-signal-current href={'#'+prefix+'-'+node}/></g>;
}
export function SignalFrame({identity,box,visible,animations=true,immediate=false,measured=false}){
 const group=useRef(),rect=useRef(),previous=useRef(),active=useRef(),geometry=useRef(),ghosts=useRef(new Set());
 useLayoutEffect(()=>{
  const old=previous.current,enabled=animations&&!matchMedia('(prefers-reduced-motion: reduce)').matches;
  const shown=!!(visible&&box),keys=['x','y','width','height'];
  const drawn=geometry.current&&rect.current?Object.fromEntries(keys.map(k=>[k,getComputedStyle(rect.current)[k]])):null;
  const changed=old?.shown&&shown&&keys.some(k=>old.box[k]!==box[k]),modeChange=old&&old.measured!==measured;
  if(!enabled||immediate&&changed&&!modeChange){geometry.current?.cancel();geometry.current=null;}
  else if(changed){
   // Retarget from the currently drawn rectangle, including interrupted transitions.
   const from=drawn??Object.fromEntries(keys.map(k=>[k,old.box[k]+'px']));
   geometry.current?.cancel();
   const animation=rect.current.animate([from,Object.fromEntries(keys.map(k=>[k,box[k]+'px']))],{duration:280,easing});
   geometry.current=animation;
   animation.onfinish=()=>{animation.cancel();if(geometry.current===animation)geometry.current=null;};
  }
  if(old&&(old.identity!==identity||old.shown!==shown)&&enabled){
   if(old.snapshot){const ghost=old.snapshot.cloneNode(true);if(drawn)for(const k of keys)ghost.setAttribute(k,drawn[k]);ghost.dataset.signalFrameGhost='true';ghost.setAttribute('opacity','0');group.current.append(ghost);ghosts.current.add(ghost);fade(ghost,1,0,()=>{ghost.remove();ghosts.current.delete(ghost);});}
   active.current?.cancel();if(rect.current)active.current=fade(rect.current,0,1);
  }else if(!enabled){active.current?.cancel();for(const ghost of ghosts.current)ghost.remove();ghosts.current.clear();}
  previous.current={identity,shown,measured,box:box?{...box}:null,snapshot:rect.current?.cloneNode(true)};
 });
 useEffect(()=>()=>{active.current?.cancel();geometry.current?.cancel();for(const ghost of ghosts.current)ghost.remove();},[]);
 return <g ref={group} className={visible&&box?'selection':'selection-transition'} pointerEvents="none">{visible&&box&&<rect ref={rect} {...box} fill="none" stroke="#39d3df" strokeWidth="1.3" vectorEffect="non-scaling-stroke"/>}</g>;
}
