import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initialScene, updateItem, filteredItems, moveLayer, resetTransform, transaction } from '../src/model.mjs';
test('filter and sort do not reorder or mutate scene IDs', () => {
  const scene = initialScene(), ids = scene.map(i=>i.id);
  assert.equal(filteredItems(scene, ' IMAGE ')[0].id, 'card');
  assert.equal(filteredItems(scene, '', {key:'name',direction:1})[0].id, 'background');
  assert.deepEqual(scene.map(i=>i.id),ids);
});
test('visibility and transforms update only their owner', () => {
  const scene=initialScene(), changed=updateItem(scene,'card',{visible:false,x:42});
  assert.equal(changed[1].visible,false);assert.equal(changed[1].x,42);assert.equal(scene[1].x,120);assert.equal(changed[0],scene[0]);
});
test('nonfinite input rejected, opacity constrained, transform reset independent',()=>{
  const scene=initialScene();assert.equal(updateItem(scene,'card',{x:NaN}),scene);
  assert.equal(updateItem(scene,'card',{opacity:8})[1].opacity,1);
  const reset=resetTransform(scene,'card');assert.equal(reset[1].rotation,0);assert.equal(reset[0],scene[0]);
});
test('history ignores no-op, clears redo and retains independent snapshots',()=>{
  const scene=initialScene(), h={past:[],future:[scene]};assert.equal(transaction(h,scene,scene),h);
  const result=transaction(h,scene,updateItem(scene,'card',{x:20}));assert.equal(result.past.length,1);assert.equal(result.future.length,0);
  scene[1].x=99;assert.equal(result.past[0][1].x,120);
});
test('layer moves work both ways with stable IDs and unchanged item data',()=>{
  const scene=initialScene();
  const up=moveLayer(scene,'ellipse','title','before');
  assert.deepEqual(up.map(i=>i.id),['ellipse','title','card','background']);
  const down=moveLayer(up,'ellipse','card','after');
  assert.deepEqual(down.map(i=>i.id),scene.map(i=>i.id));
  assert.equal(up[0],scene[2]);assert.equal(scene[2].id,'ellipse');
  assert.deepEqual(moveLayer(scene,'title','background','after').map(i=>i.id),['card','ellipse','background','title']);
});
test('self, adjacent no-op and invalid drops preserve scene and history',()=>{
  const scene=initialScene(),history={past:[],future:[]};
  for(const [source,target,side] of [['title','title','before'],['title','card','before'],['card','title','after'],['missing','title','after'],['title','missing','before'],['title','card','invalid']]){
    const moved=moveLayer(scene,source,target,side);assert.equal(moved,scene);assert.equal(transaction(history,scene,moved),history);
  }
});
test('one layer drop creates one reversible history transaction',()=>{
  const scene=initialScene(),next=moveLayer(scene,'card','title','before');
  const h=transaction({past:[],future:[]},scene,next);
  assert.equal(h.past.length,1);assert.deepEqual(h.past[0],scene);assert.equal(next[0].id,'card');
});
