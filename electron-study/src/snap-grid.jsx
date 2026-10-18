import React,{useEffect,useId,useRef,useState} from 'react';
export function SnapGrid({value,animations=true}){
 const id='snap-grid-'+useId().replace(/[^\w-]/g,''),last=useRef(null),progress=useRef(0),[amount,setAmount]=useState(0);
 if(value?.active)last.current=value;
 useEffect(()=>{
  let frame,time=performance.now();
  const target=value?.active?1:0,enabled=animations&&!matchMedia('(prefers-reduced-motion: reduce)').matches;
  const tick=now=>{const dt=Math.min(.05,(now-time)/1000);time=now;progress.current+= (target-progress.current)*(enabled?1-Math.exp(-dt/(target?.075:.1)):1);
   if(Math.abs(target-progress.current)<.005)progress.current=target;setAmount(progress.current);
   if(progress.current!==target)frame=requestAnimationFrame(tick);
  };
  frame=requestAnimationFrame(tick);return()=>cancelAnimationFrame(frame);
 },[value?.active,animations]);
 const grid=last.current;if(!grid||amount<=0)return null;
 const radius=grid.radius*amount,{x,y}=grid.point,step=grid.step;
 return <g data-snap-grid data-grid-step={step} data-grid-radius={radius} pointerEvents="none" opacity={amount}>
  <defs>
   <pattern id={id+'-lines'} width={step} height={step} patternUnits="userSpaceOnUse" patternTransform={`matrix(${grid.space.join(' ')})`}>
    <path d={`M ${step} 0 H 0 V ${step}`} fill="none" stroke="#8dd9e9" strokeOpacity=".55" strokeWidth=".7" vectorEffect="non-scaling-stroke"/>
   </pattern>
   <radialGradient id={id+'-fade'}><stop offset="0" stopColor="white" stopOpacity=".85"/><stop offset=".65" stopColor="white" stopOpacity=".55"/><stop offset="1" stopColor="white" stopOpacity="0"/></radialGradient>
   <mask id={id+'-mask'} maskUnits="userSpaceOnUse" x={x-radius} y={y-radius} width={radius*2} height={radius*2}><circle cx={x} cy={y} r={radius} fill={`url(#${id}-fade)`}/></mask>
  </defs>
  <rect x={x-radius} y={y-radius} width={radius*2} height={radius*2} fill={`url(#${id}-lines)`} mask={`url(#${id}-mask)`}/>
 </g>;
}
