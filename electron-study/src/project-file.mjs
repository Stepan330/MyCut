import {createCrop} from './tool-effects.mjs';
import {validateObjectEffects} from './object-effects.mjs';
import {validateGraph,graphFor} from './graph-model.mjs';
import {isDescendant} from './effect-graph.mjs';
import {tools} from './tools.mjs';
import {graphOperations} from './blend-modes.mjs';
import {shapeTypes,extraShapeTools} from './vector-shapes.mjs';
export const MAX_PROJECT_BYTES=128*1024*1024;
const fail=message=>{throw new Error(message);};
const object=v=>v&&typeof v==='object'&&!Array.isArray(v);
const finite=(v,min=-1e7,max=1e7)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
const id=v=>typeof v==='string'&&/^[\w-]{1,128}$/.test(v);
const color=v=>typeof v==='string'&&/^#[\da-f]{6}$/i.test(v);
function image(src){if(typeof src!=='string'||src.length>36*1024*1024||!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(src))fail('Invalid embedded image; only PNG/JPEG/WebP data is accepted');}
export function validateProject(value){
  let entries=0,samples=0;
  function safe(v,depth=0){if(++entries>3000000||depth>18)fail('Project nesting/complexity limit');if(typeof v==='number'&&!Number.isFinite(v))fail('Non-finite project value');if(v&&typeof v==='object'){if(Array.isArray(v)&&v.length>10000)fail('Project array limit');for(const [key,child] of Object.entries(v)){if(['__proto__','constructor','prototype'].includes(key))fail('Unsafe project key');safe(child,depth+1);}}}
  safe(value);
  if(!object(value)||value.format!=='mycut-project'||value.version!==1||!Array.isArray(value.items)||value.items.length>1000||!Array.isArray(value.assets)||value.assets.length>500)fail('Unsupported or malformed MyCut project');
  const ids=new Set();
  function brush(settings){if(!object(settings))fail('Invalid brush settings');const numeric={hardness:[0,1],flow:[.01,1],spacing:[.05,2],roundness:[.1,1],angle:[-180,180],smoothing:[0,Number.MAX_VALUE]},choices={tip:['Round','Soft','Flat'],stabilizer:['Off','Smooth','Pulled string'],pressure:['Off','Size']};for(const [key,v] of Object.entries(settings)){if(numeric[key]){if(!finite(v,...numeric[key]))fail('Invalid brush setting');}else if(!choices[key]?.includes(v))fail('Unknown brush setting');}}
  function stroke(s){if(!object(s)||!Array.isArray(s.points)||s.points.length>10000||!finite(s.size,.001,100000))fail('Invalid brush mask');samples+=s.points.length;if(samples>500000)fail('Project stroke sample limit');for(const p of s.points)if(!object(p)||!finite(p.x)||!finite(p.y)||p.pressure!==undefined&&!finite(p.pressure,0,1))fail('Invalid stroke point');if(s.color!==undefined&&!color(s.color)||s.opacity!==undefined&&!finite(s.opacity,0,1)||s.baseOpacity!==undefined&&!finite(s.baseOpacity,0,1)||s.enabled!==undefined&&typeof s.enabled!=='boolean'||s.erase!==undefined&&typeof s.erase!=='boolean')fail('Invalid stroke paint');if(s.selectionClip!==undefined){const c=s.selectionClip;if(!object(c)||!Array.isArray(c.matrix)||c.matrix.length!==6||!c.matrix.every(v=>finite(v))||!finite(c.width,.001,100000)||!finite(c.height,.001,100000))fail('Invalid selection clip');image(c.src);}if(s.brush!==undefined)brush(s.brush);if(s.segments!==undefined){if(!Array.isArray(s.segments)||s.segments.length>1024)fail('Mask segment limit');for(const segment of s.segments){if(segment.segments)fail('Nested mask segments are not supported');stroke(segment);}}}
  for(const n of value.items){
    if(!object(n)||!id(n.id)||ids.has(n.id)||typeof n.name!=='string'||n.name.length>1000||!['Text','Shape','Image','Background','Layer','Folder','Drawing'].includes(n.kind))fail('Invalid or duplicate scene object');ids.add(n.id);
    for(const key of ['x','y','sx','sy','rotation','width','height','fontSize','brushSize','strokeWidth','cornerRadius','sides','innerRadius','lineWidth','arrowHead','heartBulge','tailX','tailY','lineHeight','letterSpacing','brightness','contrast','saturation'])if(n[key]!==undefined&&!finite(n[key]))fail('Invalid numeric object parameter');
    for(const key of ['x','y','sx','sy','rotation'])if(!finite(n[key]))fail('Missing object transform');
    if(n.objectEffects!==undefined||n.exposedParameters!==undefined)validateObjectEffects(n);
    if(n.outlineBasis!==undefined&&(!Array.isArray(n.outlineBasis)||n.outlineBasis.length!==2||n.outlineBasis.some(v=>!finite(v,1e-8,1e7))))fail('Invalid outline scale basis');
    for(const [key,choices] of Object.entries({shape:shapeTypes,strokeStyle:['Solid','Dashed','Dotted'],textType:['Point','Paragraph'],fontStyle:['normal','italic'],textAlign:['left','center','right']}))if(n[key]!==undefined&&!choices.includes(n[key]))fail('Invalid object option');
    if(n.fontFamily!==undefined&&(typeof n.fontFamily!=='string'||n.fontFamily.length>256)||n.fontWeight!==undefined&&(!['string','number'].includes(typeof n.fontWeight)||!['400','600','700','900'].includes(String(n.fontWeight))))fail('Invalid font');
    for(const key of ['width','height','fontSize','brushSize'])if(n[key]!==undefined&&n[key]<=0)fail('Object size must be positive');
    if(n.opacity!==undefined&&!finite(n.opacity,0,1))fail('Invalid object opacity');for(const key of ['visible','locked','drawReverseX','drawReverseY'])if(n[key]!==undefined&&typeof n[key]!=='boolean')fail('Invalid object state');
    for(const key of ['color','stroke'])if(n[key]!==undefined&&!color(n[key]))fail('Invalid object colour');if(n.src!==undefined)image(n.src);
    for(const key of ['endpoints','vertices'])if(n[key]!==undefined&&(!Array.isArray(n[key])||n[key].length<(key==='endpoints'?2:3)||n[key].length>(key==='endpoints'?2:64)||n[key].some(p=>!object(p)||!finite(p.x)||!finite(p.y))))fail('Invalid shape points');
    if(n.cropRect!==undefined&&(!object(n.cropRect)||!['x','y','width','height'].every(k=>finite(n.cropRect[k]))||n.cropRect.width<=0||n.cropRect.height<=0))fail('Invalid crop rectangle');
    if(n.rasterResult!==undefined){const r=n.rasterResult;if(!object(r)||!finite(r.width,.001,100000)||!finite(r.height,.001,100000))fail('Invalid raster result');image(r.src);}
    if(n.rasterPaint!==undefined){if(!Array.isArray(n.rasterPaint)||n.rasterPaint.length>128)fail('Raster paint limit');for(const r of n.rasterPaint){if(!object(r)||!finite(r.width,.001,100000)||!finite(r.height,.001,100000))fail('Invalid raster paint');image(r.src);}}
    if(n.text!==undefined&&(typeof n.text!=='string'||n.text.length>100000))fail('Text limit');if(n.parentOffset!==undefined&&(!Array.isArray(n.parentOffset)||n.parentOffset.length!==6||!n.parentOffset.every(v=>finite(v))))fail('Invalid parent transform');
    if(n.textRuns!==undefined){
      if(n.kind!=='Text'||!Array.isArray(n.textRuns)||n.textRuns.length>10000)fail('Invalid text formatting');let previous=0;
      for(const run of n.textRuns){if(!object(run)||!Number.isInteger(run.start)||!Number.isInteger(run.end)||run.start<previous||run.end<=run.start||run.end>(n.text??'').length||!object(run.style))fail('Invalid text range');previous=run.end;
        for(const [key,v] of Object.entries(run.style)){
          const parameter=tools.find(t=>t.id==='text').parameters.find(p=>p.id===key);
          if(!['fontFamily','fontSize','fontWeight','fontStyle','color','stroke','strokeWidth','letterSpacing'].includes(key)||!parameter||tools.find(t=>t.id==='text').validate(key,v)!==v)fail('Invalid text style');
        }
      }
    }
    if(n.points)stroke({points:n.points,size:n.brushSize??1,color:n.color,brush:n.brush,selectionClip:n.selectionClip});for(const key of ['paint','erasures']){if(n[key]!==undefined&&(!Array.isArray(n[key])||n[key].length>256))fail('Effect limit');for(const s of n[key]??[])stroke(s);}
    if(n.nodeInputs!==undefined&&(!Array.isArray(n.nodeInputs)||n.nodeInputs.length>64))fail('NodeInput limit');
    if(n.graph){validateGraph(n.graph);validateGraph(graphFor(n));for(const node of n.graph.nodes)if(['Paint_Mask','NodeInput'].includes(node.type)){const channels=node.type==='Paint_Mask'?['paint','erasures']:['nodeInputs'];if(!channels.includes(node.channel)||!Number.isInteger(node.index)||!n[node.channel]?.[node.index]||node.id!==(node.type==='NodeInput'?`signal-${node.index}`:`${node.channel}-${node.index}`))fail('Graph source is missing or invalid');}}
  }
  for(const n of value.items){if(n.parentId!=null&&!ids.has(n.parentId))fail('Missing parent');let parent=n;const seen=new Set();while(parent?.parentId){if(seen.has(parent.id)||seen.size>64)fail('Scene hierarchy cycle/depth limit');seen.add(parent.id);parent=value.items.find(v=>v.id===parent.parentId);}
    const sources=new Set();for(const s of n.nodeInputs??[]){if(!object(s)||!id(s.sourceId)||sources.has(s.sourceId)||!isDescendant(value.items,s.sourceId,n.id)||!graphOperations.includes(s.operation)||!finite(s.opacity??1,0,1)||s.enabled!==undefined&&typeof s.enabled!=='boolean')fail('Invalid or cyclic NodeInput');sources.add(s.sourceId);}
  }
  const assets=new Set();for(const a of value.assets){if(!object(a)||!id(a.id)||assets.has(a.id)||!['Composition','Image'].includes(a.kind)||typeof a.name!=='string'||a.name.length>1000)fail('Invalid project asset');assets.add(a.id);if(a.kind==='Image'){image(a.src);if(!finite(a.width,.001,100000)||!finite(a.height,.001,100000))fail('Invalid image dimensions');}}
  if(value.view!==undefined&&(!object(value.view)||!finite(value.view.zoom,10,800)||!object(value.view.pan)||!finite(value.view.pan.x)||!finite(value.view.pan.y)))fail('Invalid viewport');
  if(value.toolSettings!==undefined){if(!object(value.toolSettings))fail('Invalid tool settings');for(const [key,settings] of Object.entries(value.toolSettings)){const tool=tools.find(t=>t.id===key);if(!tool||!object(settings))fail('Unknown tool');for(const [parameter,v] of Object.entries(settings))if(tool.validate(parameter,v)!==v)fail('Invalid tool setting');}}
  return value;
}
export function encodeProject({items,assets,view,toolSettings}){
  const value={format:'mycut-project',version:1,items:items.map(n=>n.graph?{...n,graph:graphFor(n)}:n),assets,...(view?{view}:null),...(toolSettings?{toolSettings}:null)};validateProject(value);const text=JSON.stringify(value);if(new TextEncoder().encode(text).byteLength>MAX_PROJECT_BYTES)fail('Project exceeds 128 MB');return text;
}
export function decodeProject(text){if(typeof text!=='string'||text.length>MAX_PROJECT_BYTES||new TextEncoder().encode(text).byteLength>MAX_PROJECT_BYTES)fail('Project exceeds 128 MB');const value=JSON.parse(text);if(value?.toolSettings)for(const spec of extraShapeTools)if(Object.hasOwn(value.toolSettings,spec.id)){const settings=value.toolSettings[spec.id],shape=tools.find(t=>t.id==='shape');if(!object(settings)||Object.entries(settings).some(([key,v])=>shape.validate(key,v)!==v))fail('Invalid legacy shape settings');delete value.toolSettings[spec.id];}validateProject(value);for(const node of value.items)if(node.cropRect&&graphFor(node).nodes.length<=62){node.graph=createCrop(node,node.cropRect);delete node.cropRect;}return validateProject(value);}
