// One contract for tool metadata, controls and canvas behavior. No React/DOM.
import {validStops} from './generator-nodes.mjs';
import {retouchTools} from './retouch.mjs';
import {extraShapeTools,shapeTypes} from './vector-shapes.mjs';
import {bounds} from './scene-transform.mjs';
import {niceValue} from './scrub-value.mjs';
import {brushExtent} from './brush-engine.mjs';
export class Tool {
  constructor({id,label,icon,shortcut,cursor='crosshair',parameters=[],primaryParameters=null,edits=null,variants=[],begin=()=>null,move=()=>{},end=()=>{},hint=''}){
    Object.assign(this,{id,label,icon,shortcut,cursor,parameters,edits,variants,begin,move,end,hint});
    this.shortcut=shortcut??null;
    this.parameters=parameters.map(p=>({...p,icon:p.icon??({size:'ellipse',color:'fill',opacity:'eye',tip:icon,hardness:'ellipse',flow:'brush',spacing:'dots',stabilizer:'move',smoothing:'brush',roundness:'ellipse',angle:'reset',pressure:'edit',width:'rectangle',height:'rectangle',shape:'rectangle',mode:'edit',stroke:'outline',strokeWidth:'strokeWidth',fontFamily:'font',fontSize:'fontSize'}[p.id]??'settings')}));
    this.primaryParameters=primaryParameters??parameters.slice(0,4).map(p=>p.id);
    this.parameters=this.parameters.map(p=>({...p,group:p.group??({size:'Tip shape',tip:'Tip shape',shape:'Geometry',mode:'Geometry',width:'Geometry',height:'Geometry',hardness:'Tip shape',roundness:'Tip shape',angle:'Tip shape',color:'Paint',opacity:'Paint',flow:'Paint',spacing:'Paint',stabilizer:'Smoothing',smoothing:'Smoothing',pressure:'Pen dynamics',stroke:'Outline',strokeWidth:'Outline',fontFamily:'Typography',fontSize:'Typography',brightness:'Image adjustments',contrast:'Image adjustments',saturation:'Image adjustments'}[p.id]??'General')}));
    this.defaults=Object.fromEntries(parameters.filter(p=>p.type!=='action').map(p=>[p.id,p.default]));
  }
  matches(item,settings){return !!item&&item.kind===this.edits?.kind&&(!this.edits.shapes||this.edits.shapes.includes(item.shape??'ellipse'))&&(!this.edits.when||settings?.[this.edits.when.key]===this.edits.when.value);}
  valueFor(item,id,settings){return this.matches(item,settings)?item[this.edits.keys?.[id]??id]??(id==='shape'?'ellipse':id==='width'?bounds(item)[0]:id==='height'?bounds(item)[1]:undefined):undefined;}
  patchFor(item,id,value,settings){return this.matches(item,settings)&&!this.parameters.find(p=>p.id===id)?.transient?{[this.edits.keys?.[id]??id]:value}:null;}
  validate(id,value){
    const p=this.parameters.find(p=>p.id===id);if(!p)return undefined;
    if(['number','range'].includes(p.type)){value=Number(value);return Number.isFinite(value)?Math.max(p.min,Math.min(p.max,value)):undefined;}
    if(p.type==='checkbox')return typeof value==='boolean'?value:undefined;
    if(p.type==='stops')return validStops(value)?value:undefined;
    if(p.type==='color')return /^#[\da-f]{6}$/i.test(value)?value:undefined;
    if(p.type==='select')return p.options.includes(value)?value:undefined;
    return typeof value==='string'?value:undefined;
  }
}
const color={id:'color',label:'Color',type:'color',default:'#16cbe0'};
const size={id:'size',label:'Size',type:'number',default:18,min:1,max:300,step:1};
const opacity={id:'opacity',label:'Opacity',type:'range',default:1,min:0,max:1,step:.01};
const dimensions=[{id:'width',label:'Width',type:'number',default:160,min:1,max:16000,step:1},{id:'height',label:'Height',type:'number',default:120,min:1,max:16000,step:1}];
const draw={begin:(c,p)=>c.startStroke(p),move:(c,p)=>c.extendStroke(p)};
const shape={begin:(c,p)=>c.startShape(p),move:(c,p,e)=>c.extendShape(p,e.shiftKey)};
export const tools=[
  new Tool({id:'select',label:'Selection',icon:'pointer',shortcut:'v',cursor:'default',primaryParameters:['moveSnap','moveStep','rotateSnap','rotateStep','scaleSnap','scaleStep'],parameters:[{id:'moveSnap',label:'Move snap',type:'checkbox',default:false,group:'Move grid'},{id:'moveStep',label:'Move step',type:'number',default:10,min:.01,max:10000,step:1,group:'Move grid'},{id:'rotateSnap',label:'Rotation snap',type:'checkbox',default:false,group:'Rotation grid'},{id:'rotateStep',label:'Rotation step',type:'number',default:15,min:.01,max:180,step:1,group:'Rotation grid'},{id:'scaleSnap',label:'Scale snap',type:'checkbox',default:false,group:'Scale grid'},{id:'scaleStep',label:'Scale step',type:'number',default:.1,min:.001,max:10,step:.01,group:'Scale grid'}],hint:'Drag to move · handles to resize · ring to rotate'}),
  new Tool({id:'brush',label:'Brush',icon:'brush',shortcut:'b',primaryParameters:['mode','size','color','opacity','tip'],parameters:[{id:'mode',label:'Mode',type:'select',default:'Create',options:['Create','Edit']},size,color,opacity,
    {id:'tip',label:'Tip',type:'select',default:'Round',options:['Round','Soft','Flat']},
    {id:'hardness',label:'Hardness',type:'range',default:1,min:0,max:1,step:.01},
    {id:'flow',label:'Flow',type:'range',default:1,min:.01,max:1,step:.01},
    {id:'spacing',label:'Spacing',type:'number',default:.15,min:.05,max:2,step:.01},
    {id:'stabilizer',label:'Stabilizer',type:'select',default:'Smooth',options:['Off','Smooth','Pulled string']},
    {id:'smoothing',label:'Smoothing',type:'range',default:.1,min:0,max:Infinity,sliderMax:1,step:.01},
    {id:'roundness',label:'Roundness',type:'range',default:1,min:.1,max:1,step:.01},
    {id:'angle',label:'Tip angle',type:'number',default:0,min:-180,max:180,step:1},
    {id:'pressure',label:'Pen pressure',type:'select',default:'Off',options:['Off','Size']},
  ],...draw,hint:'Paint on selected layer · spacing: fraction of diameter · pressure: pen only'}),
  new Tool({id:'eraser',label:'Eraser',icon:'eraser',shortcut:'e',parameters:[{id:'mode',label:'Mode',type:'select',default:'Create',options:['Create','Edit']},{...size,default:32}],...draw,hint:'Erase the selected unlocked layer; masks are non-destructive'}),
  new Tool({id:'text',label:'Text',icon:'text',shortcut:'t',primaryParameters:['mode','textType','fontFamily','fontSize','color','stroke','strokeWidth'],edits:{kind:'Text',when:{key:'mode',value:'Edit'}},parameters:[{id:'mode',label:'Mode',type:'select',options:['Create','Edit'],default:'Create',transient:true},{id:'textType',label:'Type',icon:'text',group:'Typography',type:'select',default:'Point',options:['Point','Paragraph']},{id:'fontFamily',label:'Font',type:'select',default:'Roboto',options:['Roboto','Arial','Georgia','monospace']},{id:'fontSize',label:'Font size',type:'number',default:44,min:8,max:400,step:1},{...color,default:'#d6f2f4'},{id:'stroke',label:'Outline',type:'color',default:'#123541'},{id:'strokeWidth',label:'Outline width',type:'number',default:0,min:0,max:200,step:1},{id:'fontWeight',label:'Weight',icon:'text',group:'Typography',type:'select',default:'600',options:['400','600','700','900']},{id:'fontStyle',label:'Style',icon:'text',group:'Typography',type:'select',default:'normal',options:['normal','italic']},{id:'textAlign',label:'Alignment',icon:'text',group:'Paragraph',type:'select',default:'left',options:['left','center','right']},{id:'lineHeight',label:'Line height',icon:'text',group:'Paragraph',type:'number',default:1.25,min:.5,max:5,step:.05},{id:'letterSpacing',label:'Letter spacing',icon:'text',group:'Typography',type:'number',default:0,min:-10,max:100,step:.1},...dimensions],begin:(c,p,e,hit)=>c.startText(p,hit),hint:'Create / Edit · Point / Paragraph · double-click text to edit'}),
  new Tool({id:'shape',label:'Shapes',icon:'rectangle',shortcut:'u',primaryParameters:['mode','shape','color','lineWidth','stroke','strokeWidth'],edits:{kind:'Shape',shapes:shapeTypes,when:{key:'mode',value:'Edit'}},variants:[{label:'Rectangle',value:'rectangle',icon:'rectangle'},{label:'Ellipse',value:'ellipse',icon:'ellipse'},...extraShapeTools.map(s=>({label:s.label,value:s.id,icon:s.id}))],parameters:[{id:'mode',label:'Mode',type:'select',options:['Create','Edit'],default:'Create',transient:true},{id:'shape',label:'Shape',type:'select',options:shapeTypes,default:'rectangle'},color,{id:'stroke',label:'Outline',type:'color',default:'#087c8b'},{id:'strokeWidth',label:'Outline width',type:'number',default:2,min:0,max:200,step:1},{id:'cornerRadius',label:'Corner radius',icon:'rectangle',group:'Geometry',type:'number',default:0,min:0,max:8000,step:1,shapes:['rectangle']},{id:'strokeStyle',label:'Outline style',icon:'rectangle',group:'Outline',type:'select',default:'Solid',options:['Solid','Dashed','Dotted']},{id:'lineWidth',label:'Line width',icon:'strokeWidth',group:'Geometry',type:'number',default:4,min:1,max:200,step:1,shapes:['line','arrow']},
    {id:'sides',label:'Sides / points',icon:'polygon',group:'Geometry',type:'number',default:5,min:3,max:32,step:1,shapes:['polygon','star']},
    {id:'innerRadius',label:'Inner radius',icon:'star',group:'Geometry',type:'range',default:.45,min:.1,max:.9,step:.01,shapes:['star']},
    {id:'arrowHead',label:'Arrow head',icon:'arrow',group:'Geometry',type:'range',default:.3,min:.05,max:.8,step:.01,shapes:['arrow']},
    {id:'heartBulge',label:'Heart lobes',icon:'heart',group:'Geometry',type:'range',default:.38,min:.15,max:.48,step:.01,shapes:['heart']},
    ...dimensions],...shape,hint:'Custom shape · choose a form · drag to create · edit points or shape-specific handles'}),
  new Tool({id:'eyedropper',label:'Eyedropper',icon:'eyedropper',shortcut:'c',parameters:[color],begin:(c,p)=>c.sampleColor(p),hint:'Click to sample visible color'}),
  new Tool({id:'gradient',label:'Gradient',icon:'gradient',shortcut:'g',primaryParameters:['mode','stops','gradientType'],parameters:[{id:'mode',label:'Mode',type:'select',default:'Create',options:['Create','Edit']},{id:'stops',label:'Gradient colors',type:'stops',default:[{offset:0,color:'#16cbe0',opacity:1},{offset:1,color:'#ffffff',opacity:1}]},{...color,label:'Start color'},{id:'endColor',label:'End color',icon:'fill',type:'color',default:'#ffffff'},{id:'gradientType',label:'Type',icon:'gradient',type:'select',default:'Linear',options:['Linear','Radial']}],begin:(c,p)=>c.startRegion(p),move:(c,p)=>c.extendRegion(p),end:(c,p)=>c.applyGradient(p),hint:'Drag across selected layer to apply a gradient'}),
  new Tool({id:'crop',label:'Crop',icon:'crop',shortcut:'k',parameters:[{id:'mode',label:'Mode',type:'select',default:'Create',options:['Create','Edit']}],begin:(c,p)=>c.startRegion(p),move:(c,p)=>c.extendRegion(p),end:(c,p)=>c.applyCrop(p),hint:'Drag to crop the selected object nondestructively · Escape cancels'}),
  new Tool({id:'marquee',label:'Rectangular selection',icon:'marquee',shortcut:'m',parameters:[{id:'selectionMode',label:'Selection mode',icon:'marquee',type:'select',default:'Replace',options:['Replace','Add','Subtract','Intersect']}],begin:(c,p)=>c.startRegion(p),move:(c,p)=>c.extendRegion(p),end:(c,p)=>c.selectRegion(p),hint:'Drag a pixel selection · Shift adds · Alt subtracts · Escape clears'}),
  new Tool({id:'fill',label:'Bucket fill',icon:'fill',shortcut:'f',primaryParameters:['mode','color','lowColor','highColor','tolerance','contiguous'],parameters:[{id:'mode',label:'Mode',type:'select',default:'Create',options:['Create','Edit']},color,{id:'tolerance',label:'Tolerance',icon:'wand',type:'number',default:24,min:0,max:255,step:1},{id:'contiguous',label:'Region',icon:'marquee',type:'select',default:'Connected',options:['Connected','All matching']},{id:'lowColor',label:'From color',type:'color',default:'#000000',group:'Color range'},{id:'highColor',label:'To color',type:'color',default:'#ffffff',group:'Color range'}],begin:(c,p)=>c.fillRegion(p),hint:'Fill a matching color region on the selected layer · respects pixel selection'}),
  new Tool({id:'wand',label:'Magic wand',icon:'wand',shortcut:'w',parameters:[{id:'tolerance',label:'Tolerance',icon:'wand',type:'number',default:24,min:0,max:255,step:1},{id:'contiguous',label:'Region',icon:'marquee',type:'select',default:'Connected',options:['Connected','All matching']},{id:'selectionMode',label:'Selection mode',icon:'marquee',type:'select',default:'Replace',options:['Replace','Add','Subtract','Intersect']}],begin:(c,p)=>c.selectColor(p),hint:'Click to select a color region · tolerance and contiguous matching'}),
  ...retouchTools.map(spec=>new Tool({...spec,parameters:[{id:'mode',label:'Mode',type:'select',default:'Create',options:['Create','Edit']},{...size,default:60},{id:'strength',label:'Strength',icon:'settings',type:'range',default:.5,min:.01,max:1,step:.01},...(spec.id==='sponge'?[{id:'spongeMode',label:'Mode',type:'select',default:'Desaturate',options:['Desaturate','Saturate']}]:[])],begin:(c,p,e)=>c.startRetouch(p,e),move:(c,p)=>c.extendRetouch(p),end:(c,p)=>c.applyRetouch(p),hint:['clone','heal'].includes(spec.id)?'Alt-click source, then paint on selected layer · respects selection · Undo restores':'Paint locally on selected layer · respects selection · Undo restores'})),
  new Tool({id:'lasso',label:'Lasso',icon:'lasso',parameters:[{id:'selectionMode',label:'Selection mode',type:'select',default:'Replace',options:['Replace','Add','Subtract','Intersect']}],begin:(c,p)=>c.startRegion(p),move:(c,p)=>c.extendRegion(p),end:(c,p)=>c.selectLasso(p),hint:'Draw a freehand pixel selection · Shift adds · Alt subtracts · Escape clears'}),
  new Tool({id:'image',label:'Image adjustments',icon:'image',shortcut:'i',cursor:'default',edits:{kind:'Image'},parameters:[{id:'import',label:'Import image…',type:'action',command:'importImage'},...['brightness','contrast','saturation'].map(id=>({id,label:id[0].toUpperCase()+id.slice(1),type:'range',default:1,min:0,max:3,step:.01,target:'image'}))],begin:(c,p,e,hit)=>c.pick(hit),hint:'Import PNG/JPEG/WebP, or select an image to adjust it'}),
  new Tool({id:'hand',label:'Hand',icon:'hand',shortcut:'h',cursor:'grab',begin:(c,p)=>c.startPan(p),move:(c,p)=>c.extendPan(p),hint:'Drag to pan · also Space + drag or middle mouse'}),
  new Tool({id:'zoom',label:'Zoom',icon:'search',shortcut:'z',cursor:'zoom-in',begin:(c,p,e)=>c.zoomAt(e,e.altKey?.8:1.25),hint:'Click to zoom in · Alt: zoom out · wheel: zoom around cursor'}),
];
export const isShapeTool=tool=>tool?.edits?.kind==='Shape';
export const toolForObject=item=>tools.find(t=>t.edits?.kind===item?.kind&&(!t.edits.shapes||t.edits.shapes.includes(item.shape??'ellipse')));
export const toolById=id=>tools.find(t=>t.id===id)||tools[0];
export function toolParameterGroups(tool,expanded=false,values=tool.defaults){
  const groups=new Map();for(const p of tool.parameters){if(p.shapes&&!p.shapes.includes(values.shape))continue;if(!expanded&&!tool.primaryParameters.includes(p.id))continue;const list=groups.get(p.group)??[];list.push(p);groups.set(p.group,list);}return [...groups].map(([label,parameters])=>({label,parameters}));
}
export const shapeBox=(a,b,square=false)=>{let dx=b.x-a.x,dy=b.y-a.y;if(square){const size=Math.max(Math.abs(dx),Math.abs(dy));dx=Math.sign(dx||1)*size;dy=Math.sign(dy||1)*size;}const width=Math.max(1,niceValue(Math.abs(dx))),height=Math.max(1,niceValue(Math.abs(dy)));return {x:dx<0?a.x-width:a.x,y:dy<0?a.y-height:a.y,width,height};};
export const strokePath=points=>points.map((p,i)=>`${i?'L':'M'}${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ') +(points.length===1?' l.01 0':'');
export function compactStroke(points,size,brush){
  const r=brushExtent(size,brush),xs=points.map(p=>p.x),ys=points.map(p=>p.y),x=Math.min(...xs)-r,y=Math.min(...ys)-r;
  return {x,y,width:Math.max(...xs)+r-x,height:Math.max(...ys)+r-y,points:points.map(p=>({...p,x:p.x-x,y:p.y-y}))};
}
