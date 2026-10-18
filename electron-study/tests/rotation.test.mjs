import {test} from 'node:test';
import assert from 'node:assert/strict';
import {angleDelta,rotationValue,rotationRing,ringAvailable,ringPoint,ringProjection,ringSegments} from '../src/interaction.mjs';
const points=[[-200,-100],[0,-100],[200,-100],[-200,0],[200,0],[-200,100],[0,100],[200,100]].map(([x,y])=>({x,y}));
test('ring gaps use maximum possible tool zone, not current pointer speed',()=>{
  const ring=rotationRing({x:0,y:0},points),near=ringPoint(ring,Math.atan2(-100,200));
  assert.equal(ring.clearance,16+28+8);assert.equal(ringAvailable(ring,near),false);
  assert.equal(ringProjection(ring,near).available,false);
  for(const segment of ringSegments(ring,null)){assert.ok(ringAvailable(ring,segment.a));assert.ok(ringAvailable(ring,segment.b));}
  const small=rotationRing({x:0,y:0},points.map(p=>({x:p.x*.001,y:p.y*.001})));
  assert.ok(ringSegments(small,null).length>0);
});
test('line distance fade is local and cannot fill the entire ring',()=>{
  const ring=rotationRing({x:0,y:0},points),pointer=ringPoint(ring,0);
  const far=ringSegments(ring,null),hover=ringSegments(ring,pointer);
  assert.equal(far.length,hover.length);assert.ok(far.every(s=>s.opacity===.14));
  assert.ok(hover.some(s=>s.opacity>.8));assert.ok(hover.some(s=>s.opacity===.14));
  assert.equal(ringProjection(ring,{x:pointer.x+9,y:pointer.y}).distance,9);
});
test('rotation crosses the branch cut continuously and accumulates full turns',()=>{
  const radians=n=>n*Math.PI/180;
  assert.ok(Math.abs(angleDelta(radians(179),radians(-179))-radians(2))<1e-9);
  assert.ok(Math.abs(angleDelta(radians(-179),radians(179))+radians(2))<1e-9);
  let sum=0,previous=0;for(let i=1;i<=100;i++){const current=Math.atan2(Math.sin(i*.1),Math.cos(i*.1));sum+=angleDelta(previous,current);previous=current;}
  assert.ok(Math.abs(sum-10)<1e-9);
});
test('rotation uses 15 degree snapping and Ctrl precision without changing the center',()=>{
  assert.equal(rotationValue(10,Math.PI/2),100);assert.equal(rotationValue(10,Math.PI/2,{ctrl:true}),19);
  assert.equal(rotationValue(10,Math.PI/2,{shift:true}),105);
});
