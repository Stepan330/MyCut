// UI-independent stroke pipeline. PhotoCraft research: docs/brush-research.md.
const clamp=(n,a,b,f)=>Number.isFinite(Number(n))?Math.max(a,Math.min(b,Number(n))):f;
export const MAX_DABS=6000;
export function brushSettings(v={}){return {
  tip:['Round','Soft','Flat'].includes(v.tip)?v.tip:'Round',
  hardness:clamp(v.hardness,0,1,1),flow:clamp(v.flow,.01,1,1),
  spacing:clamp(v.spacing,.05,2,.15),roundness:clamp(v.roundness,.1,1,1),angle:clamp(v.angle,-180,180,0),
  smoothing:clamp(v.smoothing,0,Infinity,.1),stabilizer:['Off','Smooth','Pulled string'].includes(v.stabilizer)?v.stabilizer:'Smooth',
  pressure:v.pressure==='Size'?'Size':'Off',
};}
// Smoothing is sampled by travelled distance, not display refresh rate.
export class BrushStroke {
  constructor(settings,size,first){this.settings=brushSettings(settings);this.size=clamp(size,.01,100000,18);this.points=[];this.last=null;this.push(first);}
  push(p,finish=false){
    if(!p||!Number.isFinite(p.x)||!Number.isFinite(p.y)||this.points.length>=10000)return false;
    const sample={x:p.x,y:p.y,pressure:clamp(p.pressure,0,1,1)},last=this.last,s=this.settings;
    if(last&&!finish&&s.stabilizer!=='Off'&&s.smoothing>0){
      const distance=Math.hypot(p.x-last.x,p.y-last.y),radius=Math.min(s.smoothing,Number.MAX_VALUE/40)*40;
      const alpha=s.stabilizer==='Pulled string'?Math.max(0,1-radius/Math.max(.0001,distance)):1-Math.exp(-distance/Math.max(.01,radius*.35));
      sample.x=last.x+(p.x-last.x)*alpha;sample.y=last.y+(p.y-last.y)*alpha;
    }
    if(last&&Math.hypot(sample.x-last.x,sample.y-last.y)<.01)return false;
    this.points.push(sample);this.last=sample;return true;
  }
}
// Uniform arc-length stepping carries the remainder across segments. Event batching
// therefore cannot create extra paint at segment boundaries. Bounded SVG workload.
export function brushDabs(points,size,settings){
  const s=brushSettings(settings),length=(points??[]).slice(1).reduce((sum,p,i)=>sum+Math.hypot(p.x-points[i].x,p.y-points[i].y),0);
  const step=Math.max(.5,size*s.spacing,length/(MAX_DABS-2)),out=[];
  const emit=p=>out.push({...p,r:size/2*(s.pressure==='Size'?Math.max(.05,p.pressure??1):1)});
  if(!points?.length)return out;emit(points[0]);let remaining=step;
  for(let i=1;i<points.length&&out.length<MAX_DABS;i++){
    const a=points[i-1],b=points[i],length=Math.hypot(b.x-a.x,b.y-a.y);if(!Number.isFinite(length)||length===0)continue;
    let walked=0;
    while(length-walked>=remaining&&out.length<MAX_DABS){walked+=remaining;const t=walked/length;emit({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,pressure:(a.pressure??1)+((b.pressure??1)-(a.pressure??1))*t});remaining=step;}
    remaining-=length-walked;
  }
  return out;
}
export function brushExtent(size,settings){return size/2*(settings?.tip==='Flat'?Math.SQRT2:1);}
