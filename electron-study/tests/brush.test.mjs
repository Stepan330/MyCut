import {test} from 'node:test';
import assert from 'node:assert/strict';
import {BrushStroke,brushDabs,brushSettings,MAX_DABS} from '../src/brush-engine.mjs';
import {compactStroke,toolById,toolParameterGroups} from '../src/tools.mjs';
import {ownBox} from '../src/content-bounds.mjs';
test('brush options are shared tool metadata and validated',()=>{
  const t=toolById('brush');for(const key of ['tip','hardness','flow','spacing','stabilizer','smoothing','roundness','angle','pressure'])assert.ok(t.parameters.some(p=>p.id===key));
  assert.equal(t.validate('tip','bad'),undefined);assert.equal(t.validate('smoothing',2),2);assert.equal(brushSettings({flow:NaN}).flow,1);
});
test('spacing is carried across segments and independent of batching',()=>{
  const points=[{x:0,y:0},{x:100,y:0}],dense=Array.from({length:101},(_,x)=>({x,y:0}));
  assert.deepEqual(brushDabs(points,20,{spacing:.5}),brushDabs(dense,20,{spacing:.5}));assert.equal(brushDabs(points,20,{spacing:.5}).length,11);
});
test('stabilizer suppresses jitter, can be disabled, finishes at pointer',()=>{
  const s=new BrushStroke({stabilizer:'Pulled string',smoothing:1},20,{x:0,y:0});s.push({x:3,y:2});assert.equal(s.points.length,1);s.push({x:100,y:0});assert.equal(s.last.x,60);s.push({x:100,y:0},true);assert.equal(s.last.x,100);
  const off=new BrushStroke({stabilizer:'Off'},20,{x:0,y:0});off.push({x:3,y:2});assert.equal(off.last.x,3);off.push({x:NaN,y:4});assert.equal(off.points.length,2);
  const smooth=new BrushStroke({stabilizer:'Smooth',smoothing:1},20,{x:0,y:0});smooth.push({x:3,y:2});assert.ok(smooth.last.y>0&&smooth.last.y<2);
});
test('pressure affects size only when enabled and compacting preserves samples',()=>{
  const p=[{x:0,y:0,pressure:.2}];assert.equal(brushDabs(p,20,{pressure:'Size'})[0].r,2);assert.equal(brushDabs(p,20,{pressure:'Off'})[0].r,10);assert.equal(compactStroke(p,20).points[0].pressure,.2);
});
test('manual smoothing above one is retained and increases real stabilization',()=>{
  assert.equal(brushSettings({smoothing:3.75}).smoothing,3.75);assert.equal(toolById('brush').validate('smoothing',3.75),3.75);assert.equal(toolById('brush').validate('smoothing',Infinity),undefined);
  const weak=new BrushStroke({smoothing:1},20,{x:0,y:0}),strong=new BrushStroke({smoothing:3.75},20,{x:0,y:0});weak.push({x:10,y:5});strong.push({x:10,y:5});assert.ok(strong.last.x<weak.last.x);assert.ok(Number.isFinite(strong.last.y));
});
test('basic parameters stay in grouped settings when advanced parameters are added',()=>{
  const tool=toolById('brush'),basic=toolParameterGroups(tool),expanded=toolParameterGroups(tool,true),ids=gs=>gs.flatMap(g=>g.parameters.map(p=>p.id));assert.deepEqual(new Set(ids(basic)),new Set(tool.primaryParameters));for(const id of ids(basic))assert.ok(ids(expanded).includes(id));assert.equal(expanded.find(g=>g.label==='Smoothing').parameters.length,2);assert.ok(tool.parameters.every(p=>p.group&&p.icon));
});
test('flat rotated tip bounds cover corners, empty input safe, workload bounded without truncating tail',()=>{
  const brush={tip:'Flat'},p=[{x:0,y:0},{x:100000,y:0}],d=brushDabs(p,1,{spacing:.05});assert.ok(d.length<=MAX_DABS);assert.ok(d.at(-1).x>99900);assert.deepEqual(brushDabs([],20,{}),[]);
  const box=ownBox({kind:'Layer',paint:[{points:[{x:0,y:0}],size:20,brush}]});assert.ok(box.width>=20*Math.SQRT2);assert.equal(compactStroke([{x:0,y:0}],20,brush).width,box.width);
});
