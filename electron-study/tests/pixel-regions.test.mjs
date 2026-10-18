import {test} from 'node:test';
import assert from 'node:assert/strict';
import {colorRegion,combineMasks,rectangleMask} from '../src/pixel-regions.mjs';
import {shapePoints,moveShapeControl,vectorShapePath} from '../src/vector-shapes.mjs';
import {evaluateScene,transformPoint} from '../src/scene-transform.mjs';
test('wand distinguishes connected regions, tolerance and alpha',()=>{
  const data=Uint8ClampedArray.from([10,20,30,255,200,0,0,255,10,20,30,255,10,20,30,0]);
  assert.deepEqual([...colorRegion(data,4,1,0,0,0,true)],[255,0,0,0]);
  assert.deepEqual([...colorRegion(data,4,1,0,0,0,false)],[255,0,255,0]);
  assert.deepEqual([...colorRegion(data,4,1,-1,0)], [0,0,0,0]);
  assert.equal(colorRegion(data,4,1,0,0,255,true).filter(Boolean).length,4);
});
test('rectangular selection and boolean modes',()=>{
  const a=rectangleMask(4,3,{x:1,y:1},{x:3,y:3});assert.equal(a.filter(Boolean).length,4);
  const b=rectangleMask(4,3,{x:2,y:0},{x:4,y:2});
  assert.equal(combineMasks(a,b,'Add').filter(Boolean).length,7);
  assert.equal(combineMasks(a,b,'Subtract').filter(Boolean).length,3);
  assert.equal(combineMasks(a,b,'Intersect').filter(Boolean).length,1);
});
test('line endpoint edits keep opposite endpoint fixed under transformed parent',()=>{
  const parent={id:'p',kind:'Layer',x:60,y:30,sx:2,sy:.7,rotation:28,width:400,height:300};
  const line={id:'l',kind:'Shape',shape:'line',parentId:'p',x:20,y:50,sx:1.4,sy:.6,rotation:32,width:100,height:80};
  const before=transformPoint(evaluateScene([parent,line]).get('l').world,shapePoints(line,100,80)[1]);
  const next={...line,...moveShapeControl(line,100,80,0,{x:-30,y:26})};
  assert.deepEqual(transformPoint(evaluateScene([parent,next]).get('l').world,shapePoints(next,100,80)[1]),before);
  assert.notEqual(vectorShapePath(line,100,80),vectorShapePath(next,100,80));
});
test('vertex, heart lobe and callout tail controls alter actual geometry',()=>{
  for(const shape of ['triangle','diamond','pentagon','hexagon','star','polygon','heart','callout']){
    const item={shape},next={...item,...moveShapeControl(item,100,80,0,{x:20,y:120})};
    assert.notEqual(vectorShapePath(item,100,80),vectorShapePath(next,100,80),shape);
  }
});
