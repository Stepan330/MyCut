// Scene picking is separate from Outliner selection and transform hit testing.
export class CanvasPick {
  constructor(){this.last=null;}
  reset(){this.last=null;}
  // Movement ends the click-to-drill sequence, not the selected editing scope.
  moved(point){if(this.last&&Math.hypot(point.x-this.last.x,point.y-this.last.y)>4)this.last.moved=true;}
  pick(scene,hitId,point,selectedId=this.last?.target){
    const map=new Map(scene.map(n=>[n.id,n])),chain=[],seen=new Set();let node=map.get(hitId);
    while(node&&!seen.has(node.id)){seen.add(node.id);chain.unshift(node.id);node=map.get(node.parentId);}
    if(!chain.length)return null;
    const selectedIndex=chain.indexOf(selectedId);
    const repeat=!this.last?.moved&&this.last?.target===selectedId&&this.last?.hitId===hitId&&Math.hypot(point.x-this.last.x,point.y-this.last.y)<=4;
    const index=repeat?Math.min(selectedIndex+1,chain.length-1):Math.max(0,selectedIndex),target=chain[index];
    this.last={...point,hitId,index,target};return target;
  }
}
