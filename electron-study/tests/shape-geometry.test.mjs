import {test} from 'node:test';
import assert from 'node:assert/strict';
import {shapeMetrics,cornerControlInset} from '../src/shape-geometry.mjs';
import {interactionDefaults} from '../src/interaction.mjs';
test('rounding controls have screen-space clearance including outline and remain distinct on small shapes',()=>{
  for(const scale of [.25,1,3]){
    const p=cornerControlInset({cornerRadius:0,strokeWidth:22},1000,1000,[2,0,0,.5,0,0],scale,interactionDefaults);
    assert.ok(Math.abs(p.x*2*scale-(52+11*scale))<1e-8);
    if(scale>=1)assert.ok(Math.abs(p.y*.5*scale-(52+11*scale))<1e-8);
  }
  const p=cornerControlInset({cornerRadius:500},30,20,[1,0,0,1,0,0],1,interactionDefaults);assert.equal(p.x,10);assert.equal(p.y,20/3);
});
test('rounded corners remain circular in document space after nonuniform scale and rotation',()=>{const angle=.7,c=Math.cos(angle),s=Math.sin(angle),m=shapeMetrics({cornerRadius:40},140,90,[c*3,s*3,-s*1.5,c*1.5,10,20]);assert.ok(Math.abs(m.rx*3-40)<1e-8);assert.ok(Math.abs(m.ry*1.5-40)<1e-8);});
test('corner radius clamps to visible dimensions and handles mirrored or degenerate scales',()=>{const m=shapeMetrics({cornerRadius:500},100,80,[-2,0,0,1,0,0]);assert.equal(m.radius,40);assert.equal(m.rx,20);assert.equal(m.ry,40);assert.equal(shapeMetrics({cornerRadius:-1},100,80).radius,0);assert.ok(Number.isFinite(shapeMetrics({cornerRadius:30},100,80,[0,0,0,0,0,0]).rx));});
