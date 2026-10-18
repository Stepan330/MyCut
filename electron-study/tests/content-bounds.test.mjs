import {test} from 'node:test';
import assert from 'node:assert/strict';
import {selectionBoxes,ownBox,corners} from '../src/content-bounds.mjs';
import {evaluateScene,transformPoint} from '../src/scene-transform.mjs';
import {initialScene} from '../src/model.mjs';
import {createNode,moveLayers} from '../src/hierarchy.mjs';
import {resizeItem,worldPoint} from '../src/interaction.mjs';
import {compactStroke} from '../src/tools.mjs';
import {scrubValue} from '../src/scrub-value.mjs';
test('numeric dragging uses common step, coarse/fine modifiers and limits',()=>{
  assert.equal(scrubValue(2,20,.01),2.2);assert.equal(scrubValue(2,20,.01,{shiftKey:true}),4);assert.equal(scrubValue(2,20,.01,{ctrlKey:true}),2.02);
  assert.equal(scrubValue(2,-100,1,{},1,10),1);assert.equal(scrubValue(2,100,1,{},1,10),10);
});
test('new strokes use compact intrinsic coordinates without changing their visible position',()=>{
  const stroke=compactStroke([{x:100,y:200},{x:130,y:240}],20);
  assert.deepEqual([stroke.x,stroke.y,stroke.width,stroke.height],[90,190,50,60]);
  assert.deepEqual(stroke.points.map(p=>({x:p.x+stroke.x,y:p.y+stroke.y})),[{x:100,y:200},{x:130,y:240}]);
});
test('dot and stroke bounds include brush radius, not the document dimensions',()=>{
  assert.deepEqual(ownBox({kind:'Drawing',width:960,height:600,points:[{x:100,y:200}],brushSize:20}),{x:90,y:190,width:20,height:20});
  assert.deepEqual(ownBox({kind:'Drawing',points:[{x:-10,y:20},{x:30,y:50}],brushSize:8}),{x:-14,y:16,width:48,height:38});
});
test('empty containers have no fake frame; nested transformed content defines their bounds',()=>{
  const folder={id:'f',name:'Folder',kind:'Folder',x:0,y:0,sx:1,sy:1,rotation:0,visible:true,opacity:1};
  let scene=createNode(initialScene(),folder);assert.equal(selectionBoxes(scene).get('f'),null);
  scene=moveLayers(scene,['card','ellipse'],'f','inside');const evaluated=evaluateScene(scene),box=selectionBoxes(scene).get('f');
  for(const id of ['card','ellipse'])for(const p of corners(ownBox(scene.find(n=>n.id===id))).map(p=>transformPoint(evaluated.get(id).world,p))){assert.ok(p.x>=box.x-1e-8&&p.x<=box.x+box.width+1e-8);assert.ok(p.y>=box.y-1e-8&&p.y<=box.y+box.height+1e-8);}
  assert.ok(box.width<960&&box.height<600);
});
test('container bounds update when children move and ignore hidden children',()=>{
  const layer={id:'layer',name:'Layer',kind:'Layer',x:0,y:0,sx:1,sy:1,rotation:0,visible:true};
  const child={id:'dot',name:'dot',kind:'Drawing',x:0,y:0,sx:1,sy:1,rotation:0,visible:true,parentId:'layer',points:[{x:20,y:30}],brushSize:10};
  assert.deepEqual(selectionBoxes([layer,child]).get('layer'),{x:15,y:25,width:10,height:10});
  assert.equal(selectionBoxes([layer,{...child,visible:false}]).get('layer'),null);
  assert.equal(selectionBoxes([layer,{...child,x:100}]).get('layer').x,115);
});
test('smart resize of offset content keeps the opposite anchor under rotation and reflection',()=>{
  const original={id:'layer',x:20,y:30,sx:-1.2,sy:.8,rotation:35},size=[960,600],box={x:120,y:200,width:80,height:40};
  const start=worldPoint(original,size,1,1,box),anchor=worldPoint(original,size,0,0,box);
  const patch=resizeItem(original,size,7,start,{x:start.x+40,y:start.y+30},{},box),next=worldPoint({...original,...patch},size,0,0,box);
  assert.ok(Math.hypot(next.x-anchor.x,next.y-anchor.y)<1e-8);
});
