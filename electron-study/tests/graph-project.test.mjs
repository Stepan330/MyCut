import {test} from 'node:test';
import assert from 'node:assert/strict';
import {defaultGraph,graphFor,validateGraph,connectGraph,disconnectGraph,removeGraphNode,addGraphOperation,arrangeGraph} from '../src/graph-model.mjs';
import {encodeProject,decodeProject} from '../src/project-file.mjs';
import {initialScene} from '../src/model.mjs';
import {tools} from '../src/tools.mjs';
import {ownBox,selectionBoxes} from '../src/content-bounds.mjs';
const project=()=>({items:initialScene(),assets:[{id:'composition',kind:'Composition',name:'Untitled'}],view:{zoom:86,pan:{x:0,y:0}},toolSettings:Object.fromEntries(tools.map(t=>[t.id,t.defaults]))});
test('default graph exposes real base/mask ports and exactly matches effect sources',()=>{
  const g=defaultGraph({paint:[{}],erasures:[{}]});assert.equal(validateGraph(g),g);assert.deepEqual(g.edges.find(e=>e.to==='paint-op-0'&&e.port==='mask'),{from:'paint-0',to:'paint-op-0',port:'mask'});assert.equal(g.nodes.length,6);
});
test('connections replace one input, support fanout, reject cycles and invalid endpoints',()=>{
  const g=addGraphOperation(defaultGraph({paint:[{}]}),'Subtract','custom');const linked=connectGraph(g,'input','custom','base');assert.notEqual(linked,g);const fanout=connectGraph(linked,'paint-0','custom','mask');assert.equal(fanout.edges.filter(e=>e.from==='paint-0').length,2);
  for(const [a,b,p] of [['custom','custom','base'],['output','custom','base'],['missing','custom','mask'],['custom','input','base'],['input','custom','oops']])assert.equal(connectGraph(fanout,a,b,p),fanout);
  const a=connectGraph(fanout,'custom','paint-op-0','base');assert.equal(connectGraph(a,'paint-op-0','custom','base'),a);
});
test('disconnect/delete do not silently reconnect, mandatory nodes protected, removed sources stay removed',()=>{
  const g=defaultGraph({paint:[{}]});const disconnected=disconnectGraph(g,'output','base');assert.ok(!graphFor({paint:[{}],graph:disconnected}).edges.some(e=>e.to==='output'));
  const removed=removeGraphNode(g,'paint-0');assert.ok(!graphFor({paint:[{}],graph:removed}).nodes.some(n=>n.id==='paint-0'));assert.equal(removeGraphNode(g,'input'),g);assert.equal(removeGraphNode(g,'output'),g);
});
test('new brush masks extend custom graphs without moving existing nodes or losing wiring',()=>{
  const g=defaultGraph({paint:[{}]});g.nodes[0].x=777;assert.equal(graphFor({paint:[{}],graph:g}).nodes[0].x,777,'no new nodes: manual layout remains');const next=graphFor({paint:[{},{}],graph:g});assert.equal(next.nodes.find(n=>n.id==='input').x,777);assert.ok(next.nodes.some(n=>n.id==='paint-1'));assert.equal(next.edges.find(e=>e.to==='output').from,'paint-op-1');validateGraph(next);
});
test('automatic DAG layout separates every card, follows dependencies and is deterministic',()=>{
  let g=defaultGraph({paint:[{},{}],nodeInputs:[{sourceId:'child',operation:'Add'}]});g=addGraphOperation(g,'Subtract','loose');const result=arrangeGraph(g);assert.deepEqual(arrangeGraph(result),result);assert.deepEqual(result.edges,g.edges);for(const a of result.nodes)for(const b of result.nodes)if(a!==b)assert.ok(a.x+150+40<=b.x||b.x+150+40<=a.x||a.y+105+40<=b.y||b.y+105+40<=a.y);for(const e of result.edges)assert.ok(result.nodes.find(n=>n.id===e.from).x<result.nodes.find(n=>n.id===e.to).x);validateGraph(result);
});
test('graph rendering complexity is bounded even for acyclic exponential fanout',()=>{
  const g=defaultGraph({});let last='input';g.edges=[];for(let i=0;i<15;i++){const id='node-'+i;g.nodes.push({id,type:'Add',x:0,y:0});g.edges.push({from:last,to:id,port:'base'},{from:last,to:id,port:'mask'});last=id;}g.edges.push({from:last,to:'output',port:'base'});assert.throws(()=>validateGraph(g),/complexity/);
});
test('disconnected graph branches do not leave phantom transformation bounds',()=>{
  const node={id:'layer',name:'Layer',kind:'Layer',x:0,y:0,sx:1,sy:1,rotation:0,paint:[{size:10,points:[{x:20,y:20}]}]};node.graph=defaultGraph(node);assert.equal(ownBox(node).width,10);node.graph=connectGraph(node.graph,'input','output','base');assert.equal(ownBox(node),null);
  const source={id:'child',name:'Source',kind:'Shape',parentId:'layer',x:80,y:80,sx:1,sy:1,rotation:0,width:20,height:20};node.nodeInputs=[{sourceId:'child',operation:'Subtract'}];assert.equal(selectionBoxes([node,source]).get('layer'),null);node.nodeInputs[0].operation='Add';node.graph=defaultGraph(node);assert.ok(selectionBoxes([node,source]).get('layer').width>=20);
});
test('project roundtrip preserves scene, embedded resources, viewport, tool settings and graph wiring',()=>{
  const data=project();data.items[1].graph=defaultGraph(data.items[1]);data.items[1].graph.nodes[0].x=888;const loaded=decodeProject(encodeProject(data));assert.deepEqual(loaded.items,data.items);assert.deepEqual(loaded.view,data.view);assert.deepEqual(loaded.toolSettings,data.toolSettings);
});
test('malformed/hostile projects fail before replacing the current document',()=>{
  const base=JSON.parse(encodeProject(project()));for(const change of [p=>p.version=99,p=>p.items[1].parentId='card',p=>p.items[1].src='https://example.com/image.png',p=>p.items[0].opacity=2,p=>p.items.push({...p.items[0]}),p=>p.items[1].graph={version:1,nodes:[],edges:[]},p=>p.items[1].paint=[{size:10,points:[{x:NaN,y:0}]}]]){const bad=structuredClone(base);change(bad);assert.throws(()=>decodeProject(JSON.stringify(bad)));}
  assert.throws(()=>decodeProject('{"format":"mycut-project","version":1,"__proto__":{}}'),/Unsafe/);
  const hostile=structuredClone(base);hostile.items[1].paint=[{size:10,points:[{x:0,y:0}],brush:{smoothing:{valueOf:'not a number'}}}];assert.throws(()=>decodeProject(JSON.stringify(hostile)),/brush/);
});
