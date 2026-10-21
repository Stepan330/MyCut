import {test} from 'node:test';
import assert from 'node:assert/strict';
import {defaultPanelCurve,samplePanelCurve,validPanelCurve} from '../src/panel-curves.mjs';
import {PanelMotion} from '../src/panel-motion.mjs';
import {createLabWorlds} from '../src/architecture-lab-model.mjs';
import {GraphRuntime,evaluationContext} from '../src/engine-runtime.mjs';
const box={x:50,y:60,width:260,height:170,elevation:0},curves={grab:defaultPanelCurve('grab'),release:defaultPanelCurve('release')},options=now=>({now,curves,frequency:8,damping:.92});
test('grab holds the previous position for .2 seconds, then reaches the soul at .5 seconds',()=>{
 const m=new PanelMotion(box);m.beginGrab(0);m.setTarget({...box,x:250,elevation:24});
 for(let i=1;i<=20;i++)assert.equal(m.step(.01,options(i/100)).x,50);
 const halfway=m.step(.1,options(.3));assert.ok(halfway.x>50&&halfway.x<250);assert.ok(halfway.elevation>0&&halfway.elevation<24);
 assert.equal(m.step(.1,options(.5)).x,250);assert.equal(m.actual.elevation,24);assert.equal(m.hitTest({x:60,y:70}),false);assert.equal(m.hitTest({x:260,y:70}),true);
});
test('curve duration rescales its keys in time and holds the final value',()=>{
 const c={...curves.grab,duration:2};assert.equal(samplePanelCurve(c,.79),0);assert.ok(samplePanelCurve(c,1.4)>0);assert.equal(samplePanelCurve(c,2),1);assert.equal(samplePanelCurve(c,200),1);assert.equal(validPanelCurve(c),true);
});
test('linear, hold and editable Hermite tangents are evaluated, with bounded follow influence',()=>{
 const c={duration:1,keys:[{id:'a',t:0,value:0,mode:'linear'},{id:'b',t:1,value:1,mode:'smooth'}]};assert.equal(samplePanelCurve(c,.25),.25);c.keys[0].mode='hold';assert.equal(samplePanelCurve(c,.9),0);c.keys[0]={...c.keys[0],mode:'free',outTangent:3};assert.ok(samplePanelCurve(c,.25)>.25);assert.ok(samplePanelCurve(c,.8)<=1);assert.equal(validPanelCurve({...c,duration:0}),false);assert.equal(validPanelCurve({...c,keys:[c.keys[0],{...c.keys[1],t:0}]}),false);
});
test('early release rebases continuously rather than snapping to an unfulfilled soul target',()=>{
 const m=new PanelMotion(box);m.beginGrab(0);m.setTarget({...box,x:250,elevation:24});m.step(.1,options(.1));const before={...m.actual};m.release(.1,{...box,x:250});assert.deepEqual(m.step(0,options(.1)),before);
 for(let i=1;i<=180;i++)m.step(1/120,options(.1+i/120));assert.ok(Math.abs(m.actual.x-250)<.05);assert.ok(Math.abs(m.actual.elevation)<.05);assert.equal(m.phase,'idle');
});
test('release keeps the visible start pose, finishes at rest, and motion-off bypasses decorative delay',()=>{
 const m=new PanelMotion(box);m.beginGrab(0);m.setTarget({...box,x:250,elevation:24});for(let i=1;i<=60;i++)m.step(1/120,options(i/120));const before={...m.actual};m.release(.6,{...box,x:250});assert.deepEqual(m.step(0,options(.6)),before);assert.ok(m.step(.1,options(.85)).elevation<24);
 m.beginGrab(1);m.setTarget({...box,x:310});assert.equal(m.step(.01,{...options(1.01),motion:false}).x,310);
});
test('curve and material edits are per-element Workspace changes with Undo and validation',()=>{
 const w=createLabWorlds().ui;assert.equal(w.execute('curve.set',{phase:'grab',curve:{...curves.grab,duration:.9}}).ok,true);assert.equal(w.state.workspace.materials.air.curves.grab.duration,.9);assert.equal(w.state.workspace.materials.earth.curves.grab.duration,.5);w.undo('workspace');assert.equal(w.state.workspace.materials.air.curves.grab.duration,.5);
 assert.equal(w.execute('ui.materialParameter',{key:'color',value:'#ad7251'}).ok,true);assert.equal(w.execute('ui.materialParameter',{key:'frequency',value:20}).ok,true);assert.equal(w.execute('ui.materialParameter',{key:'unknown',value:20}).ok,false);assert.equal(w.execute('curve.set',{phase:'release',curve:{...curves.release,duration:Infinity}}).ok,false);assert.deepEqual(w.state.document,{});
});
test('behavior nodes edit local copies without a manual unlock; typed reconnection rejects cycles atomically',()=>{
 const w=createLabWorlds().ui;assert.equal(w.execute('behavior.set',{node:'time',key:'speed',value:.4}).ok,true);assert.equal(w.state.workspace.editable,true);assert.equal(w.state.workspace.graph.nodes.find(n=>n.id==='time').params.speed,.4);assert.equal(w.execute('behavior.set',{node:'remap',key:'outMax',value:.3}).ok,true);
 const before=structuredClone(w.state.workspace.graph);assert.equal(w.execute('behavior.connect',{to:'remap',port:'value',from:'soft'}).ok,false);assert.deepEqual(w.state.workspace.graph,before);assert.equal(w.execute('behavior.connect',{to:'scale',port:'energy',from:'remap'}).ok,true);w.execute('ui.toggle',{key:'safe',value:true});assert.equal(w.execute('behavior.set',{node:'spring',key:'frequency',value:8}).ok,false);
});
test('material node edits change the actual compiled height field, not just inspector metadata',()=>{
 const w=createLabWorlds().ui,r=new GraphRuntime(),context=evaluationContext({position:{x:53,y:39}}),before=r.evaluate(w.state.workspace.stoneGraph,'height',context);assert.equal(w.execute('material.node',{node:'grain-strength',key:'value',value:.8}).ok,true);assert.notEqual(r.evaluate(w.state.workspace.stoneGraph,'height',context),before);assert.equal(w.execute('material.node',{node:'strata',key:'seed',value:27}).ok,true);assert.equal(w.state.workspace.stone.seed,27);w.execute('ui.stone',{key:'scale',value:60});assert.equal(w.state.workspace.stoneGraph.nodes.find(n=>n.id==='strata').params.scale,60);
});
