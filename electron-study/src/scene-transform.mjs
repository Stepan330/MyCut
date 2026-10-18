// Affine scene math shared by hierarchy, drawing and pointer interaction.
export const identity=()=>[1,0,0,1,0,0];
export function multiply(a,b){return [a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];}
export function inverse(m){const d=m[0]*m[3]-m[1]*m[2];if(!Number.isFinite(d)||Math.abs(d)<1e-12)return null;return [m[3]/d,-m[1]/d,-m[2]/d,m[0]/d,(m[2]*m[5]-m[3]*m[4])/d,(m[1]*m[4]-m[0]*m[5])/d];}
export function transformPoint(m,p){return {x:m[0]*p.x+m[2]*p.y+m[4],y:m[1]*p.x+m[3]*p.y+m[5]};}
export function bounds(item){const fallback=item.kind==='Text'?[640,120]:item.kind==='Image'?[420,250]:item.kind==='Shape'?[144,144]:[960,600];return [item.width??fallback[0],item.height??fallback[1]];}
export function localMatrix(item){
  const [w,h]=bounds(item),sx=item.sx??1,sy=item.sy??1,a=(item.rotation??0)*Math.PI/180,c=Math.cos(a),s=Math.sin(a),cx=w*sx/2,cy=h*sy/2;
  return [c*sx,s*sx,-s*sy,c*sy,(item.x??0)+cx-c*cx+s*cy,(item.y??0)+cy-s*cx-c*cy];
}
export function evaluateScene(scene){
  const nodes=new Map(scene.map(n=>[n.id,n])),result=new Map(),visiting=new Set();
  function visit(id){
    if(result.has(id))return result.get(id);
    if(visiting.has(id))throw new Error('Cyclic scene hierarchy');
    const node=nodes.get(id);if(!node)return {world:identity(),opacity:1};
    // parentOffset is the keep-world binding (parent inverse), not a baked
    // copy of descendants. It preserves affine shear on reparenting as well.
    visiting.add(id);const parent=visit(node.parentId),space=multiply(parent.world,node.parentOffset??identity());
    const value={space,world:multiply(space,localMatrix(node)),opacity:parent.opacity*(node.opacity??1)};
    visiting.delete(id);result.set(id,value);return value;
  }
  scene.forEach(n=>visit(n.id));return result;
}
