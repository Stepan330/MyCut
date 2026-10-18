// Position-based hover gesture: neutral center re-arms it; holding an edge never
// cycles repeatedly. Dwell rejects incidental passes through the header.
export class HoverTabGesture {
  constructor(dwell=110){this.dwell=dwell;this.reset();}
  reset(){this.candidate=null;this.since=0;this.latched=false;this.progress=0;}
  update({tabs,active,u,time,buttons=0}){
    if(buttons||tabs.length<2||!Number.isFinite(u)||!Number.isFinite(time)||u<0||u>1){this.reset();return active;}
    const direction=u<.28?-1:u>.72?1:0;if(!direction){this.reset();return active;}
    if(this.latched)return active;
    const index=tabs.indexOf(active);if(index<0)return active;
    const target=tabs[Math.max(0,Math.min(tabs.length-1,index+direction))];
    if(target===active){this.candidate=null;this.progress=0;return active;}
    if(this.candidate!==target){this.candidate=target;this.since=time;}
    this.progress=Math.min(1,Math.max(0,(time-this.since)/this.dwell));
    if(this.progress<1)return active;this.latched=true;this.candidate=null;this.progress=0;return target;
  }
}

// Ordered up / across / down trajectory. Speed-independent inside the zone;
// a distant excursion is remembered briefly so returning can finish the arc.
export class ArcTabGesture {
  constructor(returnGrace=1500){this.returnGrace=returnGrace;this.reset();}
  reset(){this.start=null;this.previous=null;this.latched=false;this.direction=0;this.outsideSince=null;}
  update({tabs,active,x,y,width,height,buttons=0,allowStart=true,time=0}){
    if(buttons||tabs.length<2||![x,y,width,height].every(Number.isFinite)||width<=0||height<=0){this.reset();return active;}
    const margin=Math.max(24,Math.min(48,height)),inside=x>=0&&x<=width&&y>=0&&y<=height,previous=this.previous;
    this.previous={x,y};
    if(this.outsideSince!==null&&time-this.outsideSince>this.returnGrace){this.start=null;this.direction=0;this.outsideSince=null;return active;}
    const distant=x < -margin||x>width+margin||y < -margin||y>height+margin;
    if(distant){
      if(this.start&&(y<0||this.outsideSince!==null)){this.outsideSince??=time;this.start.top=Math.min(this.start.top,y);const dx=x-this.start.x,across=Math.max(28,Math.min(64,width*.13));if(!this.direction&&Math.abs(dx)>=across)this.direction=Math.sign(dx);return active;}
      this.start=null;this.direction=0;this.latched=false;return active;
    }
    if(this.latched){
      if(!(inside&&previous?.y>height))return active;
      this.latched=false;
    }
    if(!this.start){
      // Enter from below, or begin inside; entering from above is not an arc.
      if(!inside||!allowStart||previous&&previous.y<0)return active;
      this.start={x,y,top:y};this.direction=0;this.outsideSince=null;return active;
    }
    const s=this.start,rise=Math.max(12,height*.3),across=Math.max(28,Math.min(64,width*.13));
    if(y<s.top)s.top=y;
    if(s.y-s.top<rise)return active;
    const dx=x-s.x;
    if(!this.direction&&Math.abs(dx)>=across&&y<=s.y-rise*.5)this.direction=Math.sign(dx);
    if(this.direction&&dx*this.direction<across*.5){this.start=null;this.direction=0;return active;}
    if(!this.direction||y-s.top<rise||y<s.y-rise*.25||dx*this.direction<across)return active;
    const index=tabs.indexOf(active),next=tabs[Math.max(0,Math.min(tabs.length-1,index+this.direction))];
    this.start=null;this.outsideSince=null;this.latched=true;return index<0?active:next;
  }
}
