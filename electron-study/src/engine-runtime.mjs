import {sampleNoise} from './procedural-noise.mjs';
import {materialPose,spawnElementalEffect} from './elemental-materials.mjs';
// Shared pure runtime. Document and Interface create separate instances of it.
// No DOM, React, document writes, UI clock or global parameter store lives here.
const finite=v=>typeof v==='number'&&Number.isFinite(v);
const clone=v=>structuredClone(v);
export const stableKey=value=>JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
export function time(ticks=0,rate=1000){if(!Number.isSafeInteger(ticks)||!Number.isSafeInteger(rate)||rate<=0)throw Error('Time needs safe integer ticks and a positive rate');return {ticks,rate};}
export const timeSeconds=t=>t.ticks/t.rate;
export function evaluationContext({time:at=time(),mode='preview',roi={x:0,y:0,width:960,height:600},quality='normal',colorSpace='sRGB',resources={},element=null,index=0,external={},parameters={local:{},global:{}},position={x:0,y:0}}={}){
 time(at.ticks,at.rate);if(!['preview','export','interface'].includes(mode)||!['draft','normal','final'].includes(quality)||!['sRGB','linear-sRGB'].includes(colorSpace)||![roi.x,roi.y,roi.width,roi.height].every(finite)||roi.width<=0||roi.height<=0)throw Error('Invalid evaluation context');
 return Object.freeze({time:Object.freeze({...at}),mode,roi:Object.freeze({...roi}),quality,colorSpace,resources:Object.freeze({...resources}),element,index,external,parameters,position});
}
export function accepts(type,value){
 if(type?.startsWith('Array<')){const inner=type.slice(6,-1);return Array.isArray(value)&&value.length<=10000&&value.every(v=>accepts(inner,v));}
 if(type==='Float')return finite(value);if(type==='Bool')return typeof value==='boolean';if(type==='String')return typeof value==='string';
 if(type==='Vector2')return !!value&&finite(value.x)&&finite(value.y);
 if(type==='Rect')return !!value&&[value.x,value.y,value.width,value.height,value.elevation??0].every(finite)&&value.width>0&&value.height>0;
 if(type==='Color')return typeof value==='string'&&/^#[\da-f]{6}$/i.test(value);
 if(type==='Element')return !!value&&typeof value.id==='string'&&finite(value.x)&&finite(value.y);
 return false;
}
export function sampleTrack(keys,seconds,base=0){
 if(!keys?.length)return base;
 if(!finite(seconds)||keys.some(k=>!finite(k.t)||!finite(k.value))||keys.some((k,i)=>i&&k.t<=keys[i-1].t))throw Error('Keyframes need ordered unique finite times');
 if(seconds<=keys[0].t)return keys[0].value;if(seconds>=keys.at(-1).t)return keys.at(-1).value;
 const i=keys.findIndex(k=>k.t>=seconds),a=keys[i-1],b=keys[i];let u=(seconds-a.t)/(b.t-a.t);
 if(a.ease==='hold')u=0;else if(a.ease==='smooth')u=u*u*(3-2*u);else if(a.ease==='spring')u=springValue(u*1.1,12,.65);
 return a.value+(b.value-a.value)*u;
}
// Analytic step response: random seek is deterministic and has no playback state.
export function springValue(seconds,frequency=12,damping=.65){
 if(seconds<=0)return 0;const w=Math.max(.001,frequency),z=Math.max(.01,Math.min(.999,damping)),wd=w*Math.sqrt(1-z*z);
 return 1-Math.exp(-z*w*seconds)*(Math.cos(wd*seconds)+z/Math.sqrt(1-z*z)*Math.sin(wd*seconds));
}
export function requiredInputRegion(type,region,params={}){
 if(!region||![region.x,region.y,region.width,region.height].every(finite)||region.width<=0||region.height<=0)throw Error('Finite ROI required');
 const padding=['Blur','Shadow'].includes(type)?Math.ceil(Math.max(0,params.radius??0)*3):['Displacement','Refraction'].includes(type)?Math.ceil(Math.abs(params.amount??0)):0;
 if(!finite(padding)||padding>100000)throw Error('ROI expansion exceeds budget');
 return {x:region.x-padding,y:region.y-padding,width:region.width+padding*2,height:region.height+padding*2};
}
export const sharedDefinitions=new Map([
 ['Position',{output:'Vector2',inputs:{},context:['position'],evaluate:(_,p,c)=>c.position}],
 ['Noise2D',{output:'Float',inputs:{position:'Vector2'},evaluate:(i,p)=>sampleNoise(p.kind??'FractalNoise',i.position.x,i.position.y,p)}],
 ['Float',{output:'Float',inputs:{},evaluate:(_,p)=>p.value??0}],
 ['Bool',{output:'Bool',inputs:{},evaluate:(_,p)=>p.value??false}],
 ['Color',{output:'Color',inputs:{},evaluate:(_,p)=>p.value??'#39d3df'}],
 ['Time',{output:'Float',inputs:{},context:['time'],evaluate:(_,p,c)=>timeSeconds(c.time)*(p.speed??1)}],
 ['Index',{output:'Float',inputs:{},context:['index'],evaluate:(_,p,c)=>c.index}],
 ['Element',{output:'Element',inputs:{},context:['element'],evaluate:(_,p,c)=>c.element}],
 ['GetParameter',{output:'Float',inputs:{},context:['parameters'],evaluate:(_,p,c)=>{if(!['local','global'].includes(p.scope))throw Error('Unknown parameter scope');const value=c.parameters[p.scope]?.[p.id];if(value===undefined)throw Error('Missing parameter '+p.id);return value?.value??value;}}],
 ['External',{output:'Float',inputs:{},context:['external'],evaluate:(_,p,c)=>c.external[p.name]??p.default??0}],
 ['Add',{output:'Float',inputs:{a:'Float',b:'Float'},evaluate:i=>i.a+i.b}],
 ['Multiply',{output:'Float',inputs:{a:'Float',b:'Float'},evaluate:i=>i.a*i.b}],
 ['Clamp',{output:'Float',inputs:{value:'Float'},evaluate:(i,p)=>Math.max(p.min??0,Math.min(p.max??1,i.value))}],
 ['Remap',{output:'Float',inputs:{value:'Float'},evaluate:(i,p)=>{const a=p.inMin??0,b=p.inMax??1;if(a===b)throw Error('Remap input range is empty');const t=(i.value-a)/(b-a),u=p.clamp?Math.max(0,Math.min(1,t)):t;return (p.outMin??0)+((p.outMax??1)-(p.outMin??0))*u;}}],
 ['Mix',{output:'Float',inputs:{a:'Float',b:'Float',weight:'Float'},evaluate:i=>i.a+(i.b-i.a)*i.weight}],
 ['Sine',{output:'Float',inputs:{value:'Float'},evaluate:(i,p)=>Math.sin(i.value*(p.frequency??1))}],
 ['Spring',{output:'Float',inputs:{value:'Float'},evaluate:(i,p)=>springValue(i.value,p.frequency??12,p.damping??.65)}],
 ['Keyframes',{output:'Float',inputs:{time:'Float'},evaluate:(i,p)=>sampleTrack(p.keys,i.time,p.base??0)}],
 ['Vector2',{output:'Vector2',inputs:{x:'Float',y:'Float'},evaluate:i=>({x:i.x,y:i.y})}],
 ['MaterialEmission',{output:'Array<Element>',inputs:{origin:'Vector2',body:'Rect',velocity:'Vector2'},evaluate:(i,p)=>spawnElementalEffect({element:p.element,origin:i.origin,body:i.body,velocity:{...i.velocity,z:p.velocityZ??0},kind:p.kind??'press',seed:p.seed??1})}],
 ['MaterialScale',{output:'Vector2',inputs:{energy:'Float',time:'Float'},evaluate:(i,p)=>materialPose(p.element,i.energy*(p.amplitude??1),i.time).scale}],
 ['MaterialSkew',{output:'Float',inputs:{energy:'Float',time:'Float'},evaluate:(i,p)=>materialPose(p.element,i.energy*(p.amplitude??1),i.time).skew}],
 ['Elements',{output:'Array<Element>',inputs:{},evaluate:(_,p)=>p.items??[]}],
 ['Map',{output:'Array<Element>',inputs:{items:'Array<Element>',amount:'Float'},context:['time','quality','mode','roi','resources'],evaluate:(i,p,c,runtime)=>i.items.map((element,index)=>{
  const y=runtime.evaluate(p.body,p.output,{...c,element,index,external:{...c.external,amount:i.amount}});
  return {...element,y:element.y+y};
 })}],
].map(([type,definition])=>[type,Object.freeze({type,pure:true,context:[],description:type+' shared primitive',...definition})]));
export function validateRuntimeGraph(graph,definitions=sharedDefinitions,depth=0){
 if(depth>8||!graph||!Array.isArray(graph.nodes)||!Array.isArray(graph.edges)||graph.nodes.length>256||graph.edges.length>1024)throw Error('Runtime graph limit');
 const nodes=new Map();for(const n of graph.nodes){if(typeof n.id!=='string'||nodes.has(n.id)||!definitions.has(n.type))throw Error('Unknown or duplicate runtime node');nodes.set(n.id,n);if(n.type==='Map')validateRuntimeGraph(n.params?.body,definitions,depth+1);}
 const incoming=new Map(),ports=new Set();for(const e of graph.edges){const a=nodes.get(e.from),b=nodes.get(e.to),target=b&&definitions.get(b.type).inputs[e.port],key=e.to+':'+e.port;if(!a||!b||!target||definitions.get(a.type).output!==target||ports.has(key))throw Error('Incompatible typed ports');ports.add(key);const list=incoming.get(e.to)??[];list.push(e.from);incoming.set(e.to,list);}
 const active=new Set(),visited=new Set();function visit(id){if(active.has(id))throw Error('Runtime graph cycle');if(visited.has(id))return;active.add(id);for(const source of incoming.get(id)??[])visit(source);active.delete(id);visited.add(id);}for(const id of nodes.keys())visit(id);return graph;
}
export class GraphRuntime{
 constructor({world='document',definitions=sharedDefinitions,budget=512}={}){if(!['document','interface'].includes(world))throw Error('Unknown world');this.world=world;this.definitions=definitions;this.budget=budget;this.cache=new Map();this.timings=new Map();this.stats={hits:0,misses:0,evictions:0};}
 inspect(graph){validateRuntimeGraph(graph,this.definitions);return graph.nodes.map(n=>({id:n.id,type:n.type,inputs:this.definitions.get(n.type).inputs,output:this.definitions.get(n.type).output,pure:true,context:this.definitions.get(n.type).context}));}
 evaluate(graph,output,context=evaluationContext()){
  validateRuntimeGraph(graph,this.definitions);const nodes=new Map(graph.nodes.map(n=>[n.id,n])),local=new Map(),definitions=this.definitions;
  const visit=id=>{
   if(local.has(id))return local.get(id);const n=nodes.get(id);if(!n)throw Error('Missing runtime output');const d=definitions.get(n.type),inputs={},dependencies=[];
   for(const [port,type] of Object.entries(d.inputs)){const edge=graph.edges.find(e=>e.to===id&&e.port===port);if(edge){const result=visit(edge.from);inputs[port]=result.value;dependencies.push([port,result.key]);}else inputs[port]=n.inputs?.[port];if(!accepts(type,inputs[port]))throw Error(n.type+'.'+port+' requires '+type);}
   const scope=Object.fromEntries(d.context.map(k=>[k,context[k]])),key=stableKey([this.world,id,n.type,n.params??{},inputs,scope]);
   if(this.cache.has(key)){const value=this.cache.get(key);this.cache.delete(key);this.cache.set(key,value);this.stats.hits++;const result={key,value};local.set(id,result);return result;}
   const start=performance.now(),value=d.evaluate(inputs,n.params??{},context,this);if(!accepts(d.output,value))throw Error(n.type+' returned an invalid '+d.output);const elapsed=performance.now()-start;this.stats.misses++;this.timings.set(id,{type:n.type,cpuMs:elapsed});
   this.cache.set(key,clone(value));while(this.cache.size>this.budget){this.cache.delete(this.cache.keys().next().value);this.stats.evictions++;}const result={key,value:clone(value)};local.set(id,result);return result;
  };
  return clone(visit(output).value);
 }
 compile(graph,output){
  const snapshot=clone(graph);validateRuntimeGraph(snapshot,this.definitions);const nodes=new Map(snapshot.nodes.map(n=>[n.id,n])),order=[],seen=new Set();const visit=id=>{if(seen.has(id))return;const node=nodes.get(id);if(!node)throw Error('Missing compiled output');seen.add(id);for(const e of snapshot.edges.filter(e=>e.to===id))visit(e.from);const definition=this.definitions.get(node.type);if(!definition.pure)throw Error('Only pure nodes can be compiled');order.push({node,definition,edges:snapshot.edges.filter(e=>e.to===id)});};visit(output);
  return context=>{context??=evaluationContext();const values=new Map();for(const {node,definition,edges} of order){const inputs={};for(const [port,type] of Object.entries(definition.inputs)){const edge=edges.find(e=>e.port===port);inputs[port]=edge?values.get(edge.from):node.inputs?.[port];if(!accepts(type,inputs[port]))throw Error('Invalid compiled '+node.type+'.'+port);}const value=definition.evaluate(inputs,node.params??{},context,this);if(!accepts(definition.output,value))throw Error('Invalid compiled output');values.set(node.id,value);}this.stats.compiledEvaluations=(this.stats.compiledEvaluations??0)+1;const value=values.get(output);return value&&typeof value==='object'?clone(value):value;};
 }
 clear(){this.cache.clear();this.timings.clear();this.stats={hits:0,misses:0,evictions:0};}
}
// Hard geometry has one writer and retains velocity through interrupted targets.
// Soft is a separate visual pose and must never be passed to hitTest.
export class HardGeometry{
 constructor(box){this.actual={...box};this.target={...box};this.velocity=Object.fromEntries(Object.keys(box).map(k=>[k,0]));}
 setTarget(box){if(!Object.entries(box).every(([k,v])=>Object.hasOwn(this.actual,k)&&finite(v)&&(k!=='width'&&k!=='height'||v>0)&&(k!=='elevation'||v>=0)))throw Error('Invalid geometry target');Object.assign(this.target,box);}
 // Pointer manipulation is another explicit input to the sole Hard writer.
 // Setting a pose also resets the target: resuming the solver cannot spring
 // back to a stale target between pointer events or after capture is released.
 place(box){this.setTarget(box);this.actual={...this.target};for(const k in this.velocity)this.velocity[k]=0;return {...this.actual};}
 step(dt,{motion=true,frequency=14,damping=.75}={}){if(!finite(dt)||dt<0||!finite(frequency)||frequency<=0||frequency>120||!finite(damping)||damping<=0||damping>2)throw Error('Invalid time step or physical response');if(!motion){this.actual={...this.target};for(const k in this.velocity)this.velocity[k]=0;return {...this.actual};}let remaining=Math.min(.1,dt);while(remaining>0){const h=Math.min(1/240,remaining);for(const k in this.actual){this.velocity[k]+=(frequency*frequency*(this.target[k]-this.actual[k])-2*damping*frequency*this.velocity[k])*h;this.actual[k]+=this.velocity[k]*h;if((k==='width'||k==='height')&&this.actual[k]<.001){this.actual[k]=.001;this.velocity[k]=Math.max(0,this.velocity[k]);}if(k==='elevation'&&this.actual[k]<0){this.actual[k]=0;this.velocity[k]=Math.max(0,this.velocity[k]);}}remaining-=h;}for(const k in this.actual)if(Math.abs(this.actual[k]-this.target[k])<.002&&Math.abs(this.velocity[k])<.002){this.actual[k]=this.target[k];this.velocity[k]=0;}return {...this.actual};}
 hitTest(p){const b=this.actual;return p.x>=b.x&&p.x<=b.x+b.width&&p.y>=b.y&&p.y<=b.y+b.height;}
}
