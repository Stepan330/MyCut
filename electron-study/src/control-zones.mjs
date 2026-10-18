import {AdaptiveZones,interactionDefaults} from './interaction.mjs';
// Screen-space picking shared by effect handles and editable shape points.
export class ControlZones {
  pick(points,pointer,time=performance.now(),settings=interactionDefaults) {
    const last=this.last,dt=last?Math.max(.001,(time-last.time)/1000):.016;
    const speed=last?Math.min(10000,Math.hypot(pointer.x-last.x,pointer.y-last.y)/dt):0;
    this.last={...pointer,time};
    if(!this.zones||this.zones.extra.length!==points.length)this.zones=new AdaptiveZones(points.length);
    const distances=points.map(p=>Math.hypot(p.x-pointer.x,p.y-pointer.y));
    const radii=this.zones.update(speed,distances,dt,settings);
    let best=null;
    points.forEach((p,i)=>{
      const spacing=Math.min(Infinity,...points.filter((_,j)=>j!==i).map(q=>Math.hypot(p.x-q.x,p.y-q.y)));
      const radius=Math.max(4,Math.min(radii[i],spacing*.45));
      if(distances[i]<=radius&&(!best||distances[i]<best.distance))best={index:i,distance:distances[i],radius};
    });
    return best;
  }
}
