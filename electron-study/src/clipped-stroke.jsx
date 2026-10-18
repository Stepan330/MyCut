import React,{useId} from 'react';
import {BrushPaint} from './brush-renderer.jsx';
import {strokePath} from './tools.mjs';
export function ClippedStroke({stroke:s,color}){
 const xs=s.points.map(p=>p.x),ys=s.points.map(p=>p.y),pad=Math.max(1,s.size*2),bounds=xs.length?{x:Math.min(...xs)-pad,y:Math.min(...ys)-pad,width:Math.max(...xs)-Math.min(...xs)+pad*2,height:Math.max(...ys)-Math.min(...ys)+pad*2}:{x:0,y:0,width:1,height:1};
 const id='stroke-clip-'+useId().replace(/[^\w-]/g,''),clip=s.selectionClip;
 const artwork=s.brush?<BrushPaint points={s.points} size={s.size} opacity={s.opacity??1} brush={s.brush} color={color}/>:<path d={strokePath(s.points)} fill="none" stroke={color} strokeWidth={s.size} strokeOpacity={s.opacity??1} strokeLinecap="round" strokeLinejoin="round"/>;
 return clip?<><defs><mask id={id} maskUnits="userSpaceOnUse" {...bounds} style={{maskType:'alpha'}}><image href={clip.src} width={clip.width} height={clip.height} transform={`matrix(${clip.matrix.join(' ')})`}/></mask></defs><g mask={`url(#${id})`}>{artwork}</g></>:artwork;
}
