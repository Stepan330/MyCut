import React from 'react';
import {filterDefaults} from './filter-nodes.mjs';
export function FilterPrimitives({node}){
  const p={...filterDefaults(node.type),...node.params},a=p.amount;
  const matrix=values=><feColorMatrix type="matrix" values={values.join(' ')}/>;
  const rgb=props=><feComponentTransfer>{['R','G','B'].map(c=>React.createElement('feFunc'+c,{key:c,...props}))}</feComponentTransfer>;
  const linear=(slope,intercept=0)=>rgb({type:'linear',slope,intercept});
  const kernel=(values,bias=0)=> <feConvolveMatrix order="3" kernelMatrix={values.join(' ')} divisor="1" bias={bias} preserveAlpha="true" edgeMode="duplicate"/>;
  switch(node.type){
    case 'Blur':return <feGaussianBlur stdDeviation={p.radius}/>;
    case 'DirectionalBlur':return <feGaussianBlur stdDeviation={`${p.x} ${p.y}`}/>;
    case 'Sharpen':return kernel([0,-a,0,-a,1+4*a,-a,0,-a,0]);
    case 'UnsharpMask':return <><feGaussianBlur in="SourceGraphic" stdDeviation={p.radius} result="soft"/><feComposite in="SourceGraphic" in2="soft" operator="arithmetic" k2={1+a} k3={-a}/></>;
    case 'Emboss':return kernel([-2*a,-a,0,-a,1,a,0,a,2*a],.5);
    case 'EdgeDetect':return kernel([0,-a,0,-a,4*a,-a,0,-a,0]);
    case 'Brightness':return linear(a);
    case 'Contrast':return linear(a,.5*(1-a));
    case 'Saturation':return <feColorMatrix type="saturate" values={a}/>;
    case 'HueRotate':return <feColorMatrix type="hueRotate" values={p.angle}/>;
    case 'Grayscale':return <feColorMatrix type="saturate" values={1-a}/>;
    case 'Sepia':{const m=[.393,.769,.189,0,0,.349,.686,.168,0,0,.272,.534,.131,0,0,0,0,0,1,0];return matrix(m.map((v,i)=>a*v+(1-a)*([0,6,12,18].includes(i)?1:0)));}
    case 'Invert':return linear(1-2*a,a);
    case 'Exposure':return linear(2**p.stops);
    case 'Gamma':return rgb({type:'gamma',amplitude:1,exponent:1/a,offset:0});
    case 'Threshold':return <><feColorMatrix type="saturate" values="0"/>{rgb({type:'discrete',tableValues:Array.from({length:256},(_,i)=>i/255>=a?1:0).join(' ')})}</>;
    case 'Posterize':return rgb({type:'discrete',tableValues:Array.from({length:p.levels},(_,i)=>i/(p.levels-1)).join(' ')});
    case 'Colorize':{const c=[1,3,5].map(i=>parseInt(p.color.slice(i,i+2),16)/255);return matrix([1-a,0,0,0,c[0]*a,0,1-a,0,0,c[1]*a,0,0,1-a,0,c[2]*a,0,0,0,1,0]);}
    case 'Temperature':return matrix([1,0,0,0,a*.16,0,1,0,0,0,0,0,1,0,-a*.16,0,0,0,1,0]);
    case 'Tint':return matrix([1,0,0,0,a*.1,0,1,0,0,-a*.15,0,0,1,0,a*.1,0,0,0,1,0]);
    case 'Opacity':return <feComponentTransfer><feFuncA type="linear" slope={a}/></feComponentTransfer>;
    case 'AlphaThreshold':return <feComponentTransfer><feFuncA type="discrete" tableValues={Array.from({length:256},(_,i)=>i/255>=a?1:0).join(' ')}/></feComponentTransfer>;
    case 'Dilate':case 'Erode':return <feMorphology operator={node.type==='Dilate'?'dilate':'erode'} radius={p.radius}/>;
    case 'Offset':return <feOffset dx={p.x} dy={p.y}/>;
    case 'DropShadow':case 'InnerShadow':case 'Glow':return <><feGaussianBlur in="SourceAlpha" stdDeviation={p.radius} result="soft"/><feOffset in="soft" dx={p.x??0} dy={p.y??0} result="shift"/>{node.type==='InnerShadow'&&<feComposite in="SourceAlpha" in2="shift" operator="out" result="shift"/>}<feFlood floodColor={p.color} floodOpacity={a} result="ink"/><feComposite in="ink" in2="shift" operator="in" result="shadow"/>{node.type==='InnerShadow'?<feMerge><feMergeNode in="SourceGraphic"/><feMergeNode in="shadow"/></feMerge>:<feMerge><feMergeNode in="shadow"/><feMergeNode in="SourceGraphic"/></feMerge>}</>;
    case 'Displace':return <><feTurbulence type="fractalNoise" baseFrequency={p.frequency} numOctaves="2" seed={p.seed} result="noise"/><feDisplacementMap in="SourceGraphic" in2="noise" scale={a} xChannelSelector="R" yChannelSelector="G"/></>;
    case 'Turbulence':return <><feTurbulence type="fractalNoise" baseFrequency={p.frequency} numOctaves="2" seed={p.seed} result="noise"/><feComposite in="noise" in2="SourceGraphic" operator="in" result="clipped"/><feComposite in="clipped" in2="SourceGraphic" operator="arithmetic" k2={a} k3={1-a}/></>;
    default:return null;
  }
}
