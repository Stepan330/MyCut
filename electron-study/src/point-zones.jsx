import {useEffect,useRef,useState} from 'react';
import {ControlZones} from './control-zones.mjs';
import {interactionDefaults} from './interaction.mjs';
// One screen-space hit test and animated feedback for all editable point tools.
export function usePointZones({points,settings=interactionDefaults,animations=true,enabled=true,identity}){
 const cfg=useRef();cfg.current={points,settings,animations,enabled};
 const zones=useRef(new ControlZones()),pointer=useRef(null),frame=useRef(0),last=useRef(0),visual=useRef({index:-1,radius:0,opacity:0}),[hover,setHover]=useState(null);
 function schedule(){if(!frame.current)frame.current=requestAnimationFrame(tick);}
 function tick(now){frame.current=0;const c=cfg.current,dt=Math.min(.05,last.current?(now-last.current)/1000:.016);last.current=now;const hit=c.enabled&&pointer.current?zones.current.pick(c.points(),pointer.current,now,c.settings):null,v=visual.current,target=hit?.radius??v.radius,alpha=hit?0.16:0,amount=c.animations?1-Math.exp(-dt/.07):1;if(hit)v.index=hit.index;v.radius+=(target-v.radius)*amount;v.opacity+=(alpha-v.opacity)*amount;setHover(v.opacity>.002?{...v}:null);if(zones.current.zones?.extra.some(x=>x>.01)&&pointer.current||Math.abs(v.opacity-alpha)>.002||Math.abs(v.radius-target)>.05)schedule();}
 function pick(e){if(!cfg.current.enabled)return null;pointer.current={x:e.clientX,y:e.clientY};const hit=zones.current.pick(cfg.current.points(),pointer.current,performance.now(),cfg.current.settings);schedule();return hit;}
 function clear(){pointer.current=null;schedule();}
 useEffect(()=>{zones.current=new ControlZones();pointer.current=null;visual.current={index:-1,radius:0,opacity:0};setHover(null);},[identity,enabled]);
 useEffect(()=>{const blur=()=>clear();window.addEventListener('blur',blur);return()=>{window.removeEventListener('blur',blur);cancelAnimationFrame(frame.current);frame.current=0;};},[]);
 return {pick,clear,hover};
}
