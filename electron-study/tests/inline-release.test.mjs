import test from 'node:test';import assert from 'node:assert/strict';
import {inlineDockPlan} from '../src/auto-hide-layout.mjs';
const tree=(anchor,collapsed)=>({axis:'horizontal',ratio:.5,children:[{group:{id:'details',dock:'top',autoHide:true,autoHideMode:'inline',autoHideAnchor:anchor,autoHideCollapsed:collapsed,autoHideSize:{width:400}}},{group:{id:'outliner',dock:'bottom'}}]});
test('right anchored left panel releases width through parent, never to right neighbour',()=>{
 const open=inlineDockPlan(tree('right',false),809,'horizontal'),closed=inlineDockPlan(tree('right',true),809,'horizontal');assert.equal(open.size,809);assert.equal(closed.size,437);assert.equal(closed.children[0].size,28);assert.equal(closed.children[1].size,400);assert.equal(closed.start,372);
});
test('left anchoring releases toward right neighbour instead',()=>{
 const closed=inlineDockPlan(tree('left',true),809,'horizontal');assert.equal(closed.size,809);assert.equal(closed.children[0].size,28);assert.equal(closed.children[1].size,772);assert.equal(closed.start,0);
});
test('overlay inherits the collapsed inline footprint without enlarging the other panel',()=>{
 const source=tree('right',false);source.children[0].group.autoHideMode='overlay';const plan=inlineDockPlan(source,809,'horizontal');assert.equal(plan.size,437);assert.equal(plan.children[1].size,400);source.children[0].group.autoHideCollapsed=true;assert.deepEqual(inlineDockPlan(source,809,'horizontal'),plan);
});
test('visual order is accounted for before release propagation',()=>{
 const closed=inlineDockPlan(tree('right',true),809,'horizontal','right',true);assert.equal(closed.size,809);assert.equal(closed.children[0].group,'outliner');assert.equal(closed.children[0].size,772);assert.equal(closed.children[1].size,28);
});
