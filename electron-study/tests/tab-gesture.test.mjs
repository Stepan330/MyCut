import {test} from 'node:test';
import assert from 'node:assert/strict';
import {HoverTabGesture,ArcTabGesture} from '../src/tab-gesture.mjs';
test('hovering an edge switches with no press or further motion after dwell',()=>{
  const g=new HoverTabGesture(100),p={tabs:['outliner','details'],active:'outliner',u:.9,buttons:0};assert.equal(g.update({...p,time:0}),'outliner');assert.equal(g.update({...p,time:99}),'outliner');assert.equal(g.update({...p,time:100}),'details');
});

const arcPoints=[[100,40],[100,20],[110,-8],[140,-14],[175,-8],[190,20],[190,46]];
function trace(points,{active='a',...options}={}){const g=new ArcTabGesture();for(const [x,y] of points)active=g.update({tabs:['a','b','c'],active,width:400,height:44,x,y,...options});return active;}
test('semicircles switch right and left, including bounded travel outside header',()=>{
  assert.equal(trace(arcPoints),'b');assert.equal(trace(arcPoints.map(([x,y])=>[300-x,y]),{active:'b'}),'a');
  assert.equal(trace([[100,50],...arcPoints]),'b');
  assert.equal(trace([[100,40],[100,15],[140,5],[190,15],[190,40]]),'b');
});
test('arc is independent of timestamps, pauses, and event density',()=>{
  const dense=arcPoints.flatMap((p,i)=>i?Array.from({length:10},(_,j)=>arcPoints[i-1].map((v,k)=>v+(p[k]-v)*(j+1)/10)):[p]);
  assert.equal(trace(dense),'b');assert.equal(trace(arcPoints.flatMap(p=>Array(50).fill(p))),'b');
});
test('straight passes, shallow wiggles, unarmed exits, pressed buttons cannot switch',()=>{
  for(const p of [[[100,40],[200,40]],[[100,40],[100,5],[100,46]],[[100,40],[120,35],[190,40]],[[100,-20],[100,10],[190,10],[190,46]]])assert.equal(trace(p),'a');
  assert.equal(trace(arcPoints,{buttons:1}),'a');assert.equal(trace(arcPoints,{allowStart:false}),'a');
});
test('distant upper excursions retain the arc until return grace expires',()=>{
  for(const direction of [1,-1]){const g=new ArcTabGesture(1500);let active='b';for(const [x,y,time] of [[200,40,0],[200,-200,20],[200+direction*90,-250,500],[200+direction*90,46,1400]])active=g.update({tabs:['a','b','c'],active,width:400,height:44,x,y,time});assert.equal(active,direction===1?'c':'a');}
  const g=new ArcTabGesture(1500);let active='a';for(const [x,y,time] of [[100,40,0],[100,-200,20],[190,-250,500],[190,46,1600]])active=g.update({tabs:['a','b'],active,width:400,height:44,x,y,time});assert.equal(active,'a');assert.equal(g.start,null);
});
test('completed arc latches, next entry from below re-arms, explicit reset cancels',()=>{
  const g=new ArcTabGesture();let active='a';const push=p=>active=g.update({tabs:['a','b','c'],active,width:400,height:44,x:p[0],y:p[1]});arcPoints.forEach(push);assert.equal(active,'b');
  [[190,46],[230,46],[280,46],[280,50]].forEach(push);assert.equal(active,'b');
  [[100,55],...arcPoints].forEach(push);assert.equal(active,'c');
  g.reset();[[100,40],[100,0]].forEach(push);g.reset();[[190,0],[190,46]].forEach(push);assert.equal(active,'c');
});
test('edge remains latched until neutral center or leave; multiple tabs do not auto-cycle',()=>{
  const g=new HoverTabGesture(100),p={tabs:['a','b','c'],active:'a',u:.9};g.update({...p,time:0});assert.equal(g.update({...p,time:100}),'b');assert.equal(g.update({...p,active:'b',time:500}),'b');g.update({...p,active:'b',u:.5,time:510});g.update({...p,active:'b',time:520});assert.equal(g.update({...p,active:'b',time:620}),'c');g.reset();g.update({...p,active:'c',u:.1,time:700});assert.equal(g.update({...p,active:'c',u:.1,time:800}),'b');
});
test('pressing, leaving, malformed coordinates and single-tab headers cannot switch',()=>{
  const g=new HoverTabGesture(100),p={tabs:['a','b'],active:'a',u:.9};for(const u of [NaN,Infinity,-1,2])assert.equal(g.update({...p,u,time:0}),'a');g.update({...p,time:0});assert.equal(g.update({...p,buttons:1,time:500}),'a');g.update({...p,time:600});g.reset();assert.equal(g.update({...p,time:900}),'a');assert.equal(g.update({...p,tabs:['a'],time:1000}),'a');
});
