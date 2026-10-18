import {test} from 'node:test';
import assert from 'node:assert/strict';
import {autoHideSlot,autoHideExtent,autoHideAnchor,allowedAutoHideAnchors,preferredAutoHideAnchor,atAutoHideWindowEdge,withinPanelEdge} from '../src/auto-hide-layout.mjs';
test('reveal anchors follow actual split side, and stacked horizontal strips retain sidebar width',()=>{
  assert.equal(autoHideAnchor(false,0),'top');assert.equal(autoHideAnchor(false,1),'bottom');assert.equal(autoHideAnchor(true,0),'left');assert.equal(autoHideAnchor(true,1),'right');assert.equal(autoHideAnchor(true,undefined,'right'),'right');assert.equal(autoHideAnchor(true,undefined,'left'),'left');assert.equal(autoHideAnchor(false,undefined,'right','content'),'bottom');
  const group={autoHide:true,autoHideCollapsed:true,autoHideSize:{width:330,height:240}},tree={axis:'vertical',children:[{group},{group}]};assert.equal(autoHideExtent(tree,'horizontal'),330);assert.equal(autoHideExtent(tree,'vertical'),56);
});
test('explicit own-edge preference is retained only for the current collapse axis',()=>{
 assert.deepEqual(allowedAutoHideAnchors(true),['left','right']);assert.deepEqual(allowedAutoHideAnchors(false),['top','bottom']);
 assert.equal(preferredAutoHideAnchor({autoHideAnchor:'left'},true,1,'right','top'),'left');assert.equal(preferredAutoHideAnchor({autoHideAnchor:'top'},false,1,'right','top'),'top');assert.equal(preferredAutoHideAnchor({autoHideAnchor:'left'},false,1,'right','top'),'bottom');
});
test('panel hover includes exterior resize boundary without swallowing distant space',()=>{
  const rect={x:400,y:100,width:300,height:500};assert.equal(withinPanelEdge({x:393,y:300},rect),true);assert.equal(withinPanelEdge({x:708,y:300},rect),true);assert.equal(withinPanelEdge({x:380,y:300},rect),false);assert.equal(withinPanelEdge({x:600,y:80},rect),false);assert.equal(withinPanelEdge(null,rect),false);
});
test('overlay reserves only strip while inline reserves its expanded saved dimension',()=>{
  const g={autoHide:true,autoHideSize:{width:320,height:240}};
  assert.equal(autoHideSlot(g,'horizontal'),28);assert.equal(autoHideSlot({...g,autoHideMode:'inline'},'horizontal'),320);assert.equal(autoHideSlot({...g,autoHideMode:'inline',autoHideCollapsed:true},'horizontal'),28);
  const tree={axis:'horizontal',children:[{group:g},{group:{...g,autoHideMode:'inline'}}]};assert.equal(autoHideExtent(tree,'horizontal'),348);assert.equal(autoHideExtent(tree,'vertical'),240);
});
test('only outermost panels activate from matching window edge within their span',()=>{
  const viewport={width:1000,height:800},container={x:600,y:80,width:396,height:698},outer={x:968,y:80,width:28,height:698};
  assert.equal(atAutoHideWindowEdge({x:999,y:300},outer,container,viewport,'right',true),true);
  assert.equal(atAutoHideWindowEdge({x:999,y:20},outer,container,viewport,'right',true),false);
  assert.equal(atAutoHideWindowEdge({x:950,y:300},outer,container,viewport,'right',true),false);
  assert.equal(atAutoHideWindowEdge({x:999,y:300},{...outer,x:650},container,viewport,'right',true),false);
  assert.equal(atAutoHideWindowEdge({x:1,y:300},{x:4,y:80,width:28,height:698},{x:4,y:80,width:396,height:698},viewport,'left',true),true);
  assert.equal(atAutoHideWindowEdge({x:200,y:799},{x:4,y:750,width:600,height:28},{x:4,y:750,width:600,height:28},viewport,'bottom',false),true);
});
