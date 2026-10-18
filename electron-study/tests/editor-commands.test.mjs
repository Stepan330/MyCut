import {test} from 'node:test';
import assert from 'node:assert/strict';
import {copyObjects,pasteObjects,duplicateObjects,commandAllowed,commandForKey} from '../src/editor-commands.mjs';
import {initialScene} from '../src/model.mjs';
import {moveLayers} from '../src/hierarchy.mjs';
import {evaluateScene} from '../src/scene-transform.mjs';
test('copy/paste snapshots selected subtrees once with new IDs and independent data',()=>{
  const scene=moveLayers(initialScene(),['ellipse'],'card','inside'),snapshot=copyObjects(scene,['card','ellipse']);let sequence=0;
  assert.equal(snapshot.roots.length,1);assert.equal(snapshot.nodes.length,2);
  const pasted=pasteObjects(scene,snapshot,{newId:()=>`p${sequence++}`});assert.deepEqual(pasted.ids,['p0']);assert.equal(pasted.scene.find(n=>n.id==='p1').parentId,'p0');assert.equal(pasted.scene[0].name,'Studio image copy');
  pasted.scene.find(n=>n.id==='p1').x=99;assert.notEqual(snapshot.nodes.find(n=>n.id==='ellipse').x,99);
});
test('copying a nested child preserves world transform and effective opacity after detaching',()=>{
  let scene=moveLayers(initialScene(),['ellipse'],'card','inside');scene=scene.map(n=>n.id==='card'?{...n,opacity:.5,sx:1.8,sy:.7,rotation:30}:n);
  const before=evaluateScene(scene).get('ellipse'),pasted=pasteObjects(scene,copyObjects(scene,['ellipse']),{offset:0,newId:()=> 'pasted'}),after=evaluateScene(pasted.scene).get('pasted');
  before.world.forEach((v,i)=>assert.ok(Math.abs(v-after.world[i])<1e-8));assert.equal(before.opacity,after.opacity);
});
test('delete/cut share lock guards; copying locked objects is non-destructive',()=>{
  const scene=initialScene();assert.equal(commandAllowed('delete',scene,['background']),false);assert.equal(commandAllowed('cut',scene,['card','background']),false);assert.equal(commandAllowed('copy',scene,['background']),true);assert.equal(commandAllowed('paste',scene,[]),false);assert.equal(commandAllowed('paste',scene,[],{clipboard:copyObjects(scene,['card'])}),true);
});
test('shortcut mapping includes Windows/macOS modifiers without Alt collisions',()=>{
  assert.equal(commandForKey({key:'Delete'}),'delete');assert.equal(commandForKey({key:'v',ctrlKey:true}),'paste');assert.equal(commandForKey({key:'c',metaKey:true}),'copy');assert.equal(commandForKey({key:'z',ctrlKey:true,shiftKey:true}),'redo');assert.equal(commandForKey({key:'y',ctrlKey:true}),'redo');assert.equal(commandForKey({key:'v',altKey:true,ctrlKey:true}),null);
});
test('duplicate keeps original parent, local opacity and subtree bindings under affine parents',()=>{
  let scene=moveLayers(initialScene(),['ellipse'],'card','inside');scene=scene.map(n=>n.id==='card'?{...n,opacity:.4,sx:2,sy:.7,rotation:35}:n);
  let sequence=0;const original=scene.find(n=>n.id==='ellipse'),next=duplicateObjects(scene,['ellipse'],{offset:0,newId:()=>`duplicate-${sequence++}`}),clone=next.scene.find(n=>n.id===next.ids[0]);
  assert.equal(clone.parentId,'card');assert.equal(clone.opacity,original.opacity);assert.deepEqual(clone.parentOffset,original.parentOffset);
  const before=evaluateScene(scene).get('ellipse'),after=evaluateScene(next.scene).get(clone.id);assert.equal(before.opacity,after.opacity);before.world.forEach((v,i)=>assert.ok(Math.abs(v-after.world[i])<1e-8));
  const tree=duplicateObjects(scene,['card','ellipse'],{newId:()=>`tree-${sequence++}`});assert.equal(tree.ids.length,1);assert.equal(tree.scene.find(n=>n.id==='tree-2').parentId,'tree-1');
  const locked=scene.map(n=>n.id==='card'?{...n,locked:true}:n);assert.equal(duplicateObjects(locked,['ellipse']).scene,locked);
});
test('editor shortcuts use physical codes in Russian/Ukrainian layouts',()=>{
  for(const [key,code,result] of [['я','KeyZ','undo'],['с','KeyC','copy'],['м','KeyV','paste'],['ч','KeyX','cut'],['в','KeyD','duplicate'],['ф','KeyA','selectAll']])assert.equal(commandForKey({key,code,ctrlKey:true}),result);
  assert.equal(commandForKey({key:'Я',code:'KeyZ',ctrlKey:true,shiftKey:true}),'redo');assert.equal(commandForKey({key:'я',code:'KeyZ',ctrlKey:true,altKey:true}),null);
});
