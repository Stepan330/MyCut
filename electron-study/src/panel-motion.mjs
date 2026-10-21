import {HardGeometry} from './engine-runtime.mjs';
import {samplePanelCurve} from './panel-curves.mjs';

// Two bodies conceptually, one writer: the pointer supplies a soul/target;
// the material solver supplies inertia. Curves blend them in absolute time.
export class PanelMotion{
 constructor(box){this.body=new HardGeometry(box);this.actual={...box};this.velocity={...this.body.velocity};this.target={...box};this.phase='idle';this.follow=0;}
 setTarget(box){this.body.setTarget(box);Object.assign(this.target,box);}
 beginGrab(now){
  this.body.place(this.actual);Object.assign(this.body.velocity,this.velocity);
  this.anchor={...this.actual};this.target={...this.actual};this.phase='grab';this.started=now;
 }
 release(now,target){
  this.body.place(this.actual);Object.assign(this.body.velocity,this.velocity);
  this.target={...target};this.body.setTarget(target);this.phase='release';this.started=now;this.releaseStart={...this.actual};this.releaseOffset=null;
 }
 step(dt,{now,curves,motion=true,frequency=14,damping=.75}={}){
  const phase=this.phase,curve=phase==='idle'?null:curves[phase],elapsed=curve?Math.max(0,now-this.started):0;
  this.body.setTarget(phase==='grab'?this.anchor:this.target);
  const inertia=this.body.step(dt,{motion,frequency,damping}),previous=this.actual,next={...inertia};
  this.follow=motion&&curve?samplePanelCurve(curve,elapsed):phase==='grab'?1:0;
  if(curve&&motion){
   if(phase==='release'&&!this.releaseOffset){const start=samplePanelCurve(curve,0);this.releaseOffset=Object.fromEntries(Object.keys(next).map(k=>[k,this.releaseStart[k]-(this.releaseStart[k]+(this.target[k]-this.releaseStart[k])*start)]));}
   const fade=phase==='release'?Math.max(0,1-elapsed/curve.duration):0;
   for(const k in next)next[k]=inertia[k]+(this.target[k]-inertia[k])*this.follow+(this.releaseOffset?.[k]??0)*fade;
  }else if(phase==='grab')Object.assign(next,this.target);
  next.width=Math.max(.001,next.width);next.height=Math.max(.001,next.height);if('elevation' in next)next.elevation=Math.max(0,next.elevation);
  this.actual=next;for(const k in next)this.velocity[k]=dt>0?(next[k]-previous[k])/dt:0;
  if(phase==='release'&&(!motion||elapsed>=curve.duration)){this.phase='idle';this.follow=0;this.body.place(next);Object.assign(this.body.velocity,this.velocity);}
  return {...this.actual};
 }
 hitTest(p){const b=this.actual;return p.x>=b.x&&p.x<=b.x+b.width&&p.y>=b.y&&p.y<=b.y+b.height;}
}
