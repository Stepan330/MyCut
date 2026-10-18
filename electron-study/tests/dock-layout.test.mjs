import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initialDockLayout,dockTab,floatTab,removeDockTab,splitDockTab,dockTree,dockSplitRatio,dockDropZone,moveDockGroup,workspaceDockZone} from '../src/dock-layout.mjs';
test('docking merges tabs without duplicates, removes empty group, selects moved panel',()=>{
  const before=initialDockLayout(),merged=dockTab(before,'details','sidebar-top');assert.equal(merged.length,1);assert.deepEqual(merged[0].tabs,['outliner','details']);assert.equal(merged[0].active,'details');assert.equal(before.length,2);
  const reorder=dockTab(merged,'details','sidebar-top',0);assert.deepEqual(reorder[0].tabs,['details','outliner']);assert.equal(new Set(reorder.flatMap(g=>g.tabs)).size,2);
});

test('whole gesture group detaches and restores preserving tabs, active and preferences',()=>{
  const before=dockTab(initialDockLayout(),'details','sidebar-top');Object.assign(before[0],{gestureSwitch:true,gestureMode:'arc'});
  const floating=moveDockGroup(before,'sidebar-top',null,{x:120,y:100},'floating');assert.equal(floating.length,1);assert.equal(floating[0].dock,'floating');assert.deepEqual(floating[0].tabs,['outliner','details']);assert.equal(floating[0].gestureMode,'arc');
  const restored=moveDockGroup(floating,'floating',{target:'empty-sidebar'},null,'restored');assert.equal(restored[0].dock,'top');assert.equal(restored[0].active,'details');assert.deepEqual(restored[0].route,[]);assert.equal(before[0].dock,'top');
});
test('whole group can merge or split without duplicate tabs or empty leaves',()=>{
  const gs=[...initialDockLayout(),{id:'f',dock:'floating',tabs:['brush','history'],active:'brush'}];
  for(const drop of [{target:'sidebar-top',kind:'merge'},{target:'sidebar-top',kind:'split',edge:'left'}]){
    const moved=moveDockGroup(gs,'f',drop,null,'new');assert.equal(moved.length,drop.kind==='merge'?2:3);assert.deepEqual(moved.flatMap(g=>g.tabs).sort(),['brush','details','history','outliner']);assert.ok(moved.every(g=>g.tabs.length));
    assert.equal(moved.find(g=>g.tabs.includes('brush')).active,'brush');
  }
});
test('new workspace zones preview only near edges with correct orientation and footprint',()=>{
  const r={x:10,y:20,width:1200,height:800};assert.equal(workspaceDockZone(r,500,400),null);assert.equal(workspaceDockZone(r,-10,50),null);
  for(const [edge,x,y] of [['left',15,400],['right',1205,400],['top',500,25],['bottom',500,815]]){const z=workspaceDockZone(r,x,y);assert.equal(z.edge,edge);assert.equal(z.target,'empty-sidebar');if(['left','right'].includes(edge))assert.equal(z.rect.width,400);else assert.equal(z.rect.height,320);}
});
test('tear off restores floating panel, moving lone floating tab does not duplicate it',()=>{
  const merged=dockTab(initialDockLayout(),'details','sidebar-top'),floated=floatTab(merged,'details',{x:200,y:100},'f1');assert.equal(floated.length,2);assert.equal(floated[1].dock,'floating');assert.deepEqual(floated[1].tabs,['details']);
  const moved=floatTab(floated,'details',{x:300,y:150},'f2');assert.equal(moved.length,2);assert.equal(moved[1].id,'f1');assert.deepEqual(moved[1].position,{x:300,y:150});
});
test('floating groups merge and split preserving all tab identities',()=>{
  let gs=floatTab(initialDockLayout(),'details',{x:1,y:2},'f1');gs=floatTab(gs,'outliner',{x:3,y:4},'f2');gs=dockTab(gs,'details','f2');assert.equal(gs.length,1);assert.deepEqual(gs[0].tabs,['outliner','details']);assert.equal(gs[0].dock,'floating');
  gs=floatTab(gs,'outliner',{x:50,y:60},'f3');assert.equal(gs.length,2);assert.equal(gs[0].active,'details');assert.equal(gs[1].active,'outliner');
});
test('invalid drops are no-ops and closing active tab selects a remaining tab',()=>{
  const gs=dockTab(initialDockLayout(),'details','sidebar-top');assert.equal(dockTab(gs,'details','missing'),gs);assert.equal(floatTab(gs,'missing',{x:0,y:0},'f'),gs);const closed=removeDockTab(gs,'details');assert.equal(closed[0].active,'outliner');assert.equal(removeDockTab(closed,'outliner').length,0);
});
test('edge docking creates horizontal/vertical splits and tears off without leaving holes',()=>{
  const floating=floatTab(initialDockLayout(),'details',{x:100,y:100},'f');
  for(const [edge,axis,side] of [['left','horizontal',0],['right','horizontal',1],['top','vertical',0],['bottom','vertical',1]]){
    const result=splitDockTab(floating,'details','sidebar-top',edge,'returned'),tree=dockTree(result.filter(g=>g.dock!=='floating'));assert.equal(tree.axis,axis);assert.equal(tree.children[side].group.active,'details');
    const detached=floatTab(result,'details',{x:50,y:50},'again');assert.deepEqual(dockTree(detached.filter(g=>g.dock!=='floating')).group.tabs,['outliner']);
  }
});
test('nested split ratios are independent and removal collapses only empty branches',()=>{
  let gs=floatTab(initialDockLayout(),'details',{x:0,y:0},'f');gs=splitDockTab(gs,'details','sidebar-top','right','returned');gs.push({id:'tool',dock:'floating',tabs:['tool'],active:'tool'});gs=splitDockTab(gs,'tool','sidebar-top','bottom','nested');
  let tree=dockTree(gs);assert.equal(tree.axis,'horizontal');assert.equal(tree.children[0].axis,'vertical');gs=dockSplitRatio(gs,[{axis:'horizontal',side:0}],.7);tree=dockTree(gs);assert.equal(tree.ratio,.5);assert.equal(tree.children[0].ratio,.7);
  gs=removeDockTab(gs,'tool');tree=dockTree(gs);assert.equal(tree.axis,'horizontal');assert.equal(tree.children[0].group.active,'outliner');assert.equal(tree.children[1].group.active,'details');assert.equal(splitDockTab(gs,'details','missing','left','bad'),gs);
});
test('drop zone preview identifies body edges and leaves central tab merge',()=>{
  const rect={x:100,y:50,width:400,height:600};assert.deepEqual(dockDropZone(rect,490,350),{kind:'split',edge:'right',rect:{x:300,y:50,width:200,height:600}});assert.equal(dockDropZone(rect,300,350).kind,'merge');assert.equal(dockDropZone(rect,300,640).edge,'bottom');
});
