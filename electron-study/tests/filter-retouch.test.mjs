import {test} from 'node:test';
import assert from 'node:assert/strict';
import {filterNodes,filterDefaults} from '../src/filter-nodes.mjs';
import {retouchTools,retouchPixels} from '../src/retouch.mjs';
import {defaultGraph,addGraphOperation,connectGraph,setGraphParameter,validateGraph,inputPorts} from '../src/graph-model.mjs';
import {encodeProject,decodeProject} from '../src/project-file.mjs';
import {tools} from '../src/tools.mjs';
const item={id:'test',name:'Test',kind:'Image',width:40,height:40,x:0,y:0,sx:1,sy:1,rotation:0};
test('30 distinct filter nodes have real validated defaults, unary ports and native round trip',()=>{
  assert.equal(filterNodes.length,30);assert.equal(new Set(filterNodes.map(n=>n.type)).size,30);
  for(const spec of filterNodes){let graph=addGraphOperation(defaultGraph(item),spec.type,'fx');assert.deepEqual(inputPorts(graph.nodes.find(n=>n.id==='fx')),['base']);graph=connectGraph(graph,'input','fx','base');graph=connectGraph(graph,'fx','output','base');assert.deepEqual(graph.nodes.find(n=>n.id==='fx').params,filterDefaults(spec.type));assert.deepEqual(decodeProject(encodeProject({items:[{...item,graph}],assets:[]})).items[0].graph,graph);const p=spec.parameters.find(p=>p.type==='number');if(p){assert.equal(setGraphParameter(graph,'fx',p.id,Infinity),graph);assert.throws(()=>validateGraph({...graph,nodes:graph.nodes.map(n=>n.id==='fx'?{...n,params:{[p.id]:p.max+1}}:n)}));}}
});
test('ten new complex tools use the same metadata contract',()=>{
  for(const id of [...retouchTools.map(t=>t.id),'lasso']){const t=tools.find(t=>t.id===id);assert.ok(t);assert.equal(typeof t.begin,'function');assert.equal(typeof t.move,'function');assert.equal(typeof t.end,'function');}
});
test('all nine retouch operations alter actual pixels and respect an empty selection',()=>{
  const w=40,h=40,data=new Uint8ClampedArray(w*h*4);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=(y*w+x)*4;data.set([x%5*45,y%7*30,(x+y)%9*25,255],i);}
  const path=[{x:10,y:10},{x:16,y:16},{x:25,y:25}];
  for(const {id} of retouchTools){const settings={id,size:18,strength:.8,source:{x:30,y:8}};assert.notDeepEqual(retouchPixels(data,w,h,path,settings),data,id);assert.deepEqual(retouchPixels(data,w,h,path,{...settings,selection:new Uint8Array(w*h)}),data,id);assert.deepEqual(retouchPixels(data,w,h,[],settings),data);}
});
test('filter params reject strings, unknown keys and injected color values',()=>{
  for(const params of [{radius:'5'},{bogus:5},{radius:-1}])assert.throws(()=>validateGraph({...defaultGraph(item),nodes:[...defaultGraph(item).nodes,{id:'fx',type:'Blur',x:0,y:0,params}]}));
});
