import {test} from 'node:test';
import assert from 'node:assert/strict';
import {AdaptiveZones,expansion,handles,interactionDefaults,resizeItem,worldPoint} from '../src/interaction.mjs';
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
const item={id:'card',x:120,y:238,sx:1,sy:1,rotation:-28,locked:false},size=[420,250];
test('all eight rotated/mirrored handles retain opposite anchor without grab jump',()=>{
  for(const sx of [1,-1])for(let index=0;index<8;index++){
    const startItem={...item,sx},[u,v]=handles[index],handle=worldPoint(startItem,size,u,v);
    const start={x:handle.x+12,y:handle.y-8};
    const same=resizeItem(startItem,size,index,start,start);
    for(const key of ['x','y','sx','sy'])close(same[key],startItem[key]);
    const anchor=worldPoint(startItem,size,1-u,1-v);
    const patch=resizeItem(startItem,size,index,start,{x:start.x+70,y:start.y+30});
    const after=worldPoint({...startItem,...patch},size,1-u,1-v);close(anchor.x,after.x);close(anchor.y,after.y);
  }
});
test('corner proportion, Shift free, edge single-axis and Alt center',()=>{
  const original={...item,rotation:0},start=worldPoint(original,size,1,1),end={x:start.x+84,y:start.y+10};
  const uniform=resizeItem(original,size,7,start,end);close(uniform.sx,uniform.sy);
  const free=resizeItem(original,size,7,start,end,{shift:true});assert.notEqual(free.sx,free.sy);
  const edgeStart=worldPoint(original,size,1,.5),edge=resizeItem(original,size,4,edgeStart,{x:edgeStart.x+84,y:edgeStart.y+50});close(edge.sy,1);close(edge.sx,1.2);
  const centered=resizeItem(original,size,7,start,end,{alt:true});
  const before=worldPoint(original,size,.5,.5),after=worldPoint({...original,...centered},size,.5,.5);close(before.x,after.x);close(before.y,after.y);
});
test('crossing anchor stays finite and tiny; locked objects reject resize',()=>{
  const start=worldPoint(item,size,1,1),patch=resizeItem(item,size,7,start,{x:-10000,y:-10000});
  for(const v of Object.values(patch))assert.ok(Number.isFinite(v));assert.ok(patch.sx>=.02);assert.ok(patch.sy>=.02);
  assert.deepEqual(resizeItem({...item,locked:true},size,7,start,start),{});
});
test('adaptive law respects speed, distance, maximum and shrink inertia',()=>{
  assert.equal(expansion(100,0),0);assert.equal(expansion(10000,1000),0);
  assert.equal(expansion(10000,0),interactionDefaults.expansion);
  assert.ok(expansion(1000,20)>expansion(1000,120));
  const zones=new AdaptiveZones();zones.update(10000,Array(8).fill(0),.016);
  const radii=zones.update(0,Array(8).fill(Infinity),.05);
  close(radii[0],16+28-88*.05);
  for(let i=0;i<20;i++)zones.update(0,Array(8).fill(Infinity),.05);
  close(zones.extra[0],0);
});
