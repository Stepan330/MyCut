import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initialScene,transaction} from '../src/model.mjs';
import {canModify,createNode,deleteLayers,effectiveState,groupLayers,moveLayers,orderedScene,rangeSelection,treeRows} from '../src/hierarchy.mjs';
const folder=(id='folder',name='Folder')=>({id,name,kind:'Folder',visible:true,locked:false});
test('locked layers cannot be moved, deleted or grouped through model calls',()=>{
  const s=initialScene();assert.equal(canModify(s,['background']),false);
  assert.equal(moveLayers(s,['background'],'title','before'),s);assert.equal(deleteLayers(s,['background']),s);
  assert.equal(groupLayers(s,['card','background'],folder()),s);
});
test('grouping creates real parent links, one Undo and unchanged child transforms',()=>{
  const s=initialScene(),next=groupLayers(s,['title','card'],folder());
  assert.deepEqual(orderedScene(next).map(n=>n.id),['folder','title','card','ellipse','background']);
  assert.equal(next.find(n=>n.id==='card').parentId,'folder');assert.equal(next.find(n=>n.id==='card').rotation,-8);
  assert.equal(transaction({past:[],future:[]},s,next).past.length,1);
  assert.deepEqual(s.map(n=>n.id),['title','card','ellipse','background']);
});
test('folder move includes descendants; cycles and ancestor-lock bypass are rejected',()=>{
  const s=groupLayers(initialScene(),['title','card'],folder());
  const moved=moveLayers(s,['folder'],'ellipse','after');assert.deepEqual(orderedScene(moved).map(n=>n.id),['ellipse','folder','title','card','background']);
  assert.equal(moveLayers(s,['folder'],'card','before'),s);
  const nested=createNode(s,folder('nested'),'folder');assert.equal(moveLayers(nested,['folder'],'nested','inside'),nested);
  const locked=s.map(n=>n.id==='card'?{...n,locked:true}:n);
  assert.equal(canModify(locked,['folder']),false);assert.equal(deleteLayers(locked,['folder']),locked);
});
test('folder visibility and lock propagate; deletion removes whole unlocked subtree',()=>{
  const s=groupLayers(initialScene(),['title','card'],folder());
  const hidden=s.map(n=>n.id==='folder'?{...n,visible:false,locked:true}:n);
  assert.equal(effectiveState(hidden,'card','visible'),false);assert.equal(effectiveState(hidden,'card','locked'),true);
  assert.equal(createNode(hidden,folder('another'),'folder'),hidden);
  assert.deepEqual(deleteLayers(s,['folder']).map(n=>n.id),['ellipse','background']);
});
test('collapse/filter/sort preserve hierarchy and shift ranges use visible rows',()=>{
  const s=groupLayers(initialScene(),['title','card'],folder());
  assert.deepEqual(treeRows(s,'',null,new Set(['folder'])).map(n=>n.id),['folder','ellipse','background']);
  const found=treeRows(s,'Studio');assert.deepEqual(found.map(n=>n.id),['folder','card']);assert.equal(found[1].depth,1);
  const sorted=treeRows(s,'',{key:'name',direction:1});assert.equal(sorted[0].id,'background');
  assert.deepEqual(rangeSelection(treeRows(s),'title','ellipse'),['title','card','ellipse']);
  assert.deepEqual(rangeSelection(treeRows(s),'missing','card'),['card']);
});
test('batch move keeps relative order and rejects mixed locked selection atomically',()=>{
  const s=initialScene(),moved=moveLayers(s,['card','title'],'ellipse','after');
  assert.deepEqual(moved.map(n=>n.id),['ellipse','title','card','background']);
  assert.equal(moveLayers(s,['card','background'],'title','before'),s);
});
test('every content type can own children without changing transforms or IDs',()=>{
  const s=initialScene(),next=moveLayers(s,['ellipse'],'card','inside');
  assert.equal(next.find(n=>n.id==='ellipse').parentId,'card');
  const {parentId,parentOffset,...child}=next.find(n=>n.id==='ellipse');assert.deepEqual(child,s.find(n=>n.id==='ellipse'));
  assert.deepEqual(treeRows(next).map(n=>[n.id,n.depth]),[['title',0],['card',0],['ellipse',1],['background',0]]);
  const nested=moveLayers(next,['card'],'title','inside');
  assert.equal(treeRows(nested).find(n=>n.id==='ellipse').depth,2);
  assert.equal(moveLayers(nested,['title'],'ellipse','inside'),nested);
  assert.equal(moveLayers(nested,['card'],'card','inside'),nested);
  assert.equal(moveLayers(s,['ellipse'],'background','inside'),s);
});
test('non-folder parents support creation, collapse, inherited visibility/lock and subtree deletion',()=>{
  const s=moveLayers(initialScene(),['ellipse'],'card','inside'),created=createNode(s,folder(),'card');
  assert.equal(created.find(n=>n.id==='folder').parentId,'card');
  assert.deepEqual(treeRows(created,'',null,new Set(['card'])).map(n=>n.id),['title','card','background']);
  assert.deepEqual(treeRows(created,'Ellipse').map(n=>n.id),['card','ellipse']);
  const hidden=created.map(n=>n.id==='card'?{...n,visible:false,locked:true}:n);
  assert.equal(effectiveState(hidden,'ellipse','visible'),false);assert.equal(effectiveState(hidden,'folder','locked'),true);
  assert.equal(moveLayers(hidden,['title'],'ellipse','inside'),hidden);
  assert.deepEqual(deleteLayers(created,['card']).map(n=>n.id),['title','background']);
});
