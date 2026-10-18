import React,{memo,useId,useMemo} from 'react';
import {brushDabs,brushSettings} from './brush-engine.mjs';
export const BrushPaint=memo(function BrushPaint({points,size,color,opacity=1,brush,...props}){
  const id='brush-'+useId().replace(/[^a-zA-Z0-9_-]/g,''),s=brushSettings(brush);
  const dabs=useMemo(()=>brushDabs(points,size,brush),[points,size,brush]);
  const hard=s.tip==='Soft'?Math.min(.8,s.hardness):s.hardness,soft=hard<1;
  return <g {...props} opacity={opacity} data-brush-tip={s.tip} data-brush-smoothing={s.smoothing} data-dab-count={dabs.length}>
    {soft&&<defs><radialGradient id={id}><stop offset="0" stopColor={color}/><stop offset={`${hard*100}%`} stopColor={color}/><stop offset="100%" stopColor={color} stopOpacity="0"/></radialGradient></defs>}
    <g fill={soft?`url(#${id})`:color}>{dabs.map((d,i)=><g key={i} transform={`translate(${d.x} ${d.y}) rotate(${s.angle}) scale(1 ${s.roundness})`} opacity={s.flow}>{s.tip==='Flat'?<rect x={-d.r} y={-d.r} width={d.r*2} height={d.r*2}/>:<circle r={d.r}/>}</g>)}</g>
  </g>;
});
