import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initialScene,transaction} from '../src/model.mjs';
import {renameLayer} from '../src/hierarchy.mjs';
test('inline rename trims name, preserves ID/transform/order and one Undo',()=>{
  const scene=initialScene(),next=renameLayer(scene,'card','  Карточка  ');
  assert.equal(next[1].name,'Карточка');assert.equal(next[1].id,'card');assert.equal(next[1].rotation,-8);assert.deepEqual(next.map(n=>n.id),scene.map(n=>n.id));
  const history=transaction({past:[],future:[]},scene,next);assert.equal(history.past.length,1);assert.equal(history.past[0][1].name,'Studio image');
});
test('blank, unchanged, invalid and locked renames are no-ops',()=>{
  const scene=initialScene();for(const [id,name] of [['card',' '],['card','Studio image'],['card','x'.repeat(101)],['missing','Name'],['background','Name'],['card',null]])assert.equal(renameLayer(scene,id,name),scene);
});
test('renaming a folder never changes parent membership',()=>{
  const scene=[{id:'folder',name:'Old',kind:'Folder',visible:true,locked:false},...initialScene().map(n=>({...n,parentId:'folder'}))];
  // Folder with protected descendants stays protected by the existing policy.
  assert.equal(renameLayer(scene,'folder','New'),scene);
  const unlocked=scene.map(n=>({...n,locked:false})),next=renameLayer(unlocked,'folder','New');assert.equal(next[0].name,'New');assert.equal(next[1].parentId,'folder');
});
