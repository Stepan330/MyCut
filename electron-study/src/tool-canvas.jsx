import React,{useEffect,useRef,useState,useId,useContext} from 'react';
import {SignalFade} from './signal-fade.jsx';
import {ClippedStroke} from './clipped-stroke.jsx';
import {LiveRetouch} from './live-retouch.jsx';
import {maskTypes,maskLocalTransform,graphTransform} from './mask-space.mjs';
import {compositionDomain} from './generator-domain.mjs';
import {nodeDefaults} from './generator-nodes.mjs';
import {filterTypes} from './filter-nodes.mjs';
import {FilterPrimitives} from './filter-artwork.jsx';
import {layoutText} from './rich-text.mjs';
import {cssBlendMode} from './blend-modes.mjs';
import {RichTextEditor} from './rich-text-editor.jsx';
import {DocumentRenderContext} from './render-context.jsx';
import {usePointZones} from './point-zones.jsx';
import {interactionDefaults,handles} from './interaction.mjs';
import {shapeMetrics,cornerControlInset} from './shape-geometry.mjs';
import {expandedEdges} from './parameter-graph.mjs';
import {LiveBlur} from './live-blur.jsx';
import {bounds,evaluateScene,inverse,transformPoint,multiply} from './scene-transform.mjs';
import {vectorShapePath} from './vector-shapes.mjs';
import {shapeBox,strokePath,toolById,isShapeTool,compactStroke} from './tools.mjs';
import {ownBox,selectionBoxes} from './content-bounds.mjs';
import {effectiveState} from './hierarchy.mjs';
import {BrushStroke,brushSettings} from './brush-engine.mjs';
import {BrushPaint} from './brush-renderer.jsx';
import {commandForKey} from './editor-commands.mjs';
import {isDescendant,signalSources} from './effect-graph.mjs';
import {graphFor} from './graph-model.mjs';
export function fitText(text,style={}){const {width,height}=layoutText({...style,text},document.createElement('canvas').getContext('2d'));return {width,height};}

export function ItemContent({item,w,h}){
  const render=useContext(DocumentRenderContext);
  if(item.kind==='Drawing'&&item.selectionClip)return <ClippedStroke stroke={{...item,size:item.brushSize,opacity:1}} color={item.color}/>;
  if(item.kind==='Drawing')return item.brush?<BrushPaint points={item.points} size={item.brushSize} color={item.color} brush={item.brush}/>:<path d={strokePath(item.points)} fill="none" stroke={item.color} strokeWidth={item.brushSize} strokeLinecap="round" strokeLinejoin="round"/>;
  if(item.kind==='Image'&&item.src)return <image href={item.src} width={w} height={h} preserveAspectRatio="none"/>;
  if(item.kind==='Image')return <><rect width={w} height={h} fill="url(#card)"/><rect width={w} height={h} fill="url(#paper-grid)"/><circle cx={w*.68} cy={h*.45} r={Math.min(w,h)*.26} fill="none" stroke="url(#rim)" strokeWidth="20"/></>;
  if(item.kind==='Background')return <rect width={w} height={h} fill="url(#back)"/>;
  if(item.kind==='Text'){const layout=layoutText(item,document.createElement('canvas').getContext('2d'));return <text xmlSpace="preserve" style={{whiteSpace:'pre'}} stroke={item.stroke??'#123541'} strokeWidth={(item.strokeWidth??0)*render.scale} data-document-stroke={item.strokeWidth??0} vectorEffect="non-scaling-stroke" strokeLinejoin="round" paintOrder="stroke fill" fill={item.color??'#d6f2f4'} fontSize={item.fontSize??44} fontWeight={item.fontWeight??600} fontStyle={item.fontStyle??'normal'} letterSpacing={item.letterSpacing??0} fontFamily={item.fontFamily??'Roboto'}>{layout.parts.map((p,i)=><tspan key={i} data-text-start={p.start} data-text-end={p.end} x={p.x} y={p.y} fontFamily={p.style.fontFamily} fontSize={p.style.fontSize} fontWeight={p.style.fontWeight} fontStyle={p.style.fontStyle} letterSpacing={p.style.letterSpacing} fill={p.style.color} stroke={p.style.stroke} strokeWidth={p.style.strokeWidth*render.scale} data-document-stroke={p.style.strokeWidth} vectorEffect="non-scaling-stroke">{p.text}</tspan>)}</text>;}
  if(item.kind==='Shape'){const scale=render.scale,geometry=shapeMetrics(item,w,h,render.evaluated.get(item.id)?.world),dash=item.strokeStyle==='Dashed'?[12,7]:item.strokeStyle==='Dotted'?[2,5]:null,style={fill:item.color??'#ffb02e',stroke:item.stroke??'#a66a19',strokeWidth:(item.strokeWidth??3)*scale,vectorEffect:'non-scaling-stroke',strokeLinejoin:'round',shapeRendering:'geometricPrecision',strokeDasharray:dash?.map(v=>v*scale).join(' '),'data-document-stroke':item.strokeWidth??3,'data-document-dash':dash?.join(' ')};if(item.shape&& !['rectangle','ellipse'].includes(item.shape)){
    const d=vectorShapePath(item,w,h);if(item.shape==='line'){const width=item.lineWidth??4;return <g data-vector-shape="line"><path d={d} {...style} fill="none" strokeLinecap="round" strokeWidth={(width+2*(item.strokeWidth??2))*scale} data-document-stroke={width+2*(item.strokeWidth??2)}/><path d={d} {...style} fill="none" stroke={item.color??'#16cbe0'} strokeLinecap="round" strokeWidth={width*scale} data-document-stroke={width}/></g>;}return <path data-vector-shape={item.shape} d={d} {...style}/>;
  }if(item.outlineBasis){const [bx,by]=item.outlineBasis,native={...style,strokeWidth:item.strokeWidth??3,vectorEffect:undefined,strokeDasharray:dash?.join(' '),'data-document-stroke':undefined,'data-document-dash':undefined};return <g data-compound-outline transform={`scale(${1/bx} ${1/by})`}>{item.shape==='rectangle'?<rect width={w*bx} height={h*by} rx={geometry.rx*bx} ry={geometry.ry*by} {...native}/>:<ellipse cx={w*bx/2} cy={h*by/2} rx={w*bx/2} ry={h*by/2} {...native}/>}</g>;}
  return item.shape==='rectangle'?<rect width={w} height={h} rx={geometry.rx} ry={geometry.ry} {...style}/>:<ellipse cx={w/2} cy={h/2} rx={w/2} ry={h/2} {...style}/>;}
  return null;
}
export function StrokeArtwork({stroke,colorOverride}){
  const id='segment-'+useId().replace(/[^a-zA-Z0-9_-]/g,'');if(stroke.enabled===false)return null;
  const draw=(s,key)=><ClippedStroke key={key} stroke={s} color={colorOverride??s.color}/>;
  const rect=ownBox({kind:'Layer',paint:[stroke,...(stroke.segments??[])]})??{x:0,y:0,width:1,height:1};
  let artwork=draw({...stroke,opacity:stroke.baseOpacity??1},'base');for(const [i,s] of (stroke.segments??[]).entries())artwork=s.erase?<><defs><mask id={`${id}-${i}`} maskUnits="userSpaceOnUse" {...rect}><rect {...rect} fill="white"/><ClippedStroke stroke={s} color="black"/></mask></defs><g mask={`url(#${id}-${i})`}>{artwork}</g></>:<>{artwork}{draw({...s,color:s.color??stroke.color},i)}</>;
  return <g opacity={stroke.opacity??1}>{artwork}</g>;
}
export function PaintStrokes({item}){return (item.paint??[]).map((s,i)=><g key={i} data-paint-stroke={i} data-brush-tip={s.brush?.tip} data-brush-smoothing={s.brush?.smoothing}><StrokeArtwork stroke={s}/></g>);}
export function MaskHatching({stroke,world}){
  const id='mask-hatch-'+useId().replace(/[^\w-]/g,''),rect=ownBox({kind:'Layer',paint:[stroke,...(stroke.segments??[])]})??{x:0,y:0,width:1,height:1};
  return <g data-mask-preview="true" transform={`matrix(${world.join(' ')})`} pointerEvents="none"><defs><pattern id={`${id}-pattern`} width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 0V8" stroke="#102c3a" strokeWidth="4"/><path d="M0 0V8" stroke="#8aeeff" strokeWidth="2"/></pattern><mask id={id} maskUnits="userSpaceOnUse" {...rect} style={{maskType:'alpha'}}><StrokeArtwork stroke={{...stroke,enabled:true}} colorOverride="white"/></mask></defs><rect {...rect} fill={`url(#${id}-pattern)`} mask={`url(#${id})`}/></g>;
}
export function CornerHandle({item,world,change,begin,finish,cancel,controller,settings=interactionDefaults,animations=true}){
  const render=useContext(DocumentRenderContext),drag=useRef(null),group=useRef();
  const [w,h]=bounds(item),{sx,sy,radius,maximum}=shapeMetrics(item,w,h,world),{x:dx,y:dy}=cornerControlInset(item,w,h,world,render.scale,settings);
  const points=[[1,1],[-1,1],[-1,-1],[1,-1]].map(([u,v])=>({...transformPoint(world,{x:u===1?dx:w-dx,y:v===1?dy:h-dy}),u,v}));
  const pointZones=usePointZones({identity:item.id,settings,animations,enabled:!item.locked&&item.visible,points:()=>{const matrix=group.current?.ownerSVGElement.getScreenCTM();return matrix?points.map(p=>new DOMPoint(p.x,p.y).matrixTransform(matrix)):[];}}),zone=pointZones.hover,hover=zone&&points[zone.index]?{...points[zone.index],...zone}:null;
  const local=e=>{const svg=group.current.ownerSVGElement,p=new DOMPoint(e.clientX,e.clientY).matrixTransform(svg.getScreenCTM().inverse());return transformPoint(inverse(world),p);};
  const hit=e=>{
    const matrix=group.current?.ownerSVGElement.getScreenCTM();if(!matrix||item.locked||!item.visible)return null;
    const near=pointZones.pick(e),candidate=near?{...points[near.index],...near}:null;
    // When small shapes cannot separate all zones, the closer control wins.
    const resizeDistance=Math.min(...handles.map(([u,v])=>{const p=transformPoint(world,{x:u*w,y:v*h}),screen=new DOMPoint(p.x,p.y).matrixTransform(matrix);return Math.hypot(e.clientX-screen.x,e.clientY-screen.y);}));
    if(candidate&&candidate.distance<resizeDistance)return candidate;pointZones.clear();return null;
  };
  const stop=abort=>{if(!drag.current)return false;drag.current=null;abort?cancel():finish();return true;};
  controller.current={
    down:e=>{if(e.button!==0||!inverse(world))return false;const p=hit(e);if(!p)return false;e.preventDefault();e.stopPropagation();drag.current={p:local(e),radius,u:p.u,v:p.v};begin();e.currentTarget.focus({preventScroll:true});e.currentTarget.setPointerCapture(e.pointerId);return true;},
    move:e=>{if(drag.current){pointZones.pick(e);e.stopPropagation();const p=local(e),d=drag.current;change(item.id,{cornerRadius:Math.max(0,Math.min(maximum,d.radius+((p.x-d.p.x)*sx*d.u+(p.y-d.p.y)*sy*d.v)/2))},false);return true;}hit(e);return false;},
    up:e=>{if(!drag.current)return false;e.stopPropagation();return stop(false);},
    cancel:()=>{pointZones.clear();return stop(true);},leave:()=>{if(!drag.current)pointZones.clear();}
  };
  useEffect(()=>{const abort=()=>stop(true),key=e=>{if(drag.current&&(e.key==='Escape'||commandForKey(e)==='undo')){e.preventDefault();e.stopImmediatePropagation();abort();}};window.addEventListener('keydown',key,true);window.addEventListener('blur',abort);return()=>{controller.current=null;window.removeEventListener('keydown',key,true);window.removeEventListener('blur',abort);};},[]);
  if(!inverse(world)||item.locked||!item.visible)return null;
  return <g ref={group}>{hover&&<circle data-corner-zone={hover.index} cx={hover.x} cy={hover.y} r={hover.radius/render.scale} fill="#39d3df" fillOpacity={hover.opacity} stroke="#39d3df" strokeOpacity={hover.opacity*2} vectorEffect="non-scaling-stroke" pointerEvents="none"/>}{points.map((p,i)=><circle key={i} data-corner-handle={i} aria-label={`Rectangle corner radius ${['top left','top right','bottom right','bottom left'][i]}`} role="slider" aria-valuemin={0} aria-valuemax={maximum} aria-valuenow={radius} cx={p.x} cy={p.y} r={6/render.scale} fill="#22333b" stroke="#7ce6f7" strokeWidth="2" vectorEffect="non-scaling-stroke" style={{cursor:'ew-resize'}}/>)}</g>;
}
function SignalArtwork({owner,signal:s,items,evaluated}){
  const source=items.find(n=>n.id===s.sourceId),inv=evaluated&&inverse(evaluated.get(owner.id).world);if(!source||!inv||s.enabled===false||!isDescendant(items,source.id,owner.id))return null;
  const subtree=items.filter(n=>n.id===source.id||isDescendant(items,n.id,source.id)),consumed=signalSources(subtree);
  return <g opacity={s.opacity??1}>{subtree.filter(n=>!consumed.has(n.id)&&effectiveState(items,n.id,'visible')).reverse().map(node=>{const [sw,sh]=bounds(node);return <g key={node.id} transform={`matrix(${multiply(inv,evaluated.get(node.id).world).join(' ')})`} opacity={evaluated.get(node.id).opacity/(evaluated.get(owner.id).opacity||1)}><PixelModifiers item={node} w={sw} h={sh} items={items} evaluated={evaluated}><ItemContent item={node} w={sw} h={sh}/></PixelModifiers></g>;})}</g>;
}
function GraphOutput({item,w,h,items,evaluated,children,displayNode,animations}){
  const prefix='graph-'+useId().replace(/[^\w-]/g,''),graph={...graphFor(item),edges:expandedEdges(graphFor(item))},domain=compositionDomain(evaluated.get(item.id).world),rect=domain;
  function dependencySignature(target){const visited=new Set();function visit(id){if(visited.has(id))return;visited.add(id);for(const e of graph.edges.filter(e=>e.to===id))visit(e.from);}visit(target);return {sourceOwners:items.filter(n=>isDescendant(items,n.id,item.id)).map(n=>n.id),dependencies:[...visited].filter(id=>id!==target),signature:JSON.stringify({input:{...item,graph:undefined},world:evaluated.get(item.id).world,children:items.filter(n=>isDescendant(items,n.id,item.id)).map(n=>({...n,world:evaluated.get(n.id).world})),nodes:graph.nodes.filter(n=>visited.has(n.id)).map(({x,y,expanded,preview,...n})=>n),edges:graph.edges.filter(e=>visited.has(e.to))})};}
  const id=node=>`${prefix}-${node}`,source=(node,port)=>graph.edges.find(e=>e.to===node.id&&e.port===port)?.from,use=key=>key?<use href={`#${id(key)}`}/>:null;
  return <><defs><filter id={`${prefix}:black`} colorInterpolationFilters="sRGB"><feColorMatrix values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0"/></filter>{graph.nodes.map(node=>{
    let content=null;if(node.enabled===false)content=use(source(node,'base'));else if(node.type==='Input')content=children;else if(node.type==='Function')content=use(node.output);
    else if(node.type==='Paint_Mask'){const stroke=item[node.channel]?.[node.index];if(stroke)content=<StrokeArtwork stroke={stroke} colorOverride={node.channel==='erasures'?'black':undefined}/>;}
    else if(node.type==='NodeInput'){const signal=item.nodeInputs?.[node.index];if(signal)content=<SignalArtwork owner={item} signal={signal} items={items} evaluated={evaluated}/>;}
    else if(node.type==='Gradient'){const p={...nodeDefaults('Gradient'),...node.params},gid=id(node.id)+':gradient',stops=[...p.stops].sort((a,b)=>a.offset-b.offset);content=<><defs>{p.gradientType==='Radial'?<radialGradient id={gid} gradientUnits="userSpaceOnUse" cx={p.x1} cy={p.y1} r={Math.max(.001,Math.hypot(p.x2-p.x1,p.y2-p.y1))}>{stops.map((s,i)=><stop key={i} offset={s.offset} stopColor={s.color} stopOpacity={s.opacity??1}/>)}</radialGradient>:<linearGradient id={gid} gradientUnits="userSpaceOnUse" x1={p.x1} y1={p.y1} x2={p.x2} y2={p.y2}>{stops.map((s,i)=><stop key={i} offset={s.offset} stopColor={s.color} stopOpacity={s.opacity??1}/>)}</linearGradient>}</defs><rect {...domain} fill={`url(#${gid})`}/></>;}
    else if(node.type==='SolidColor')content=<rect {...domain} fill={node.params.color}/>;
    else if(node.type==='RectangleMask'){const p={...nodeDefaults(node.type),...node.params};content=<rect x={p.x} y={p.y} width={p.width} height={p.height} fill="white"/>;}
    else if(node.type==='BitmapMask')content=<image href={node.params.src} x={node.params.x??0} y={node.params.y??0} width={node.params.width} height={node.params.height}/>;
    else if(node.type==='ConvertToAlphaMask'){const mid=id(node.id)+':alpha';content=<><defs><mask id={mid} maskUnits="userSpaceOnUse" {...rect} style={{maskType:'alpha'}}>{use(source(node,'base'))}</mask></defs><rect {...rect} fill="white" mask={`url(#${mid})`}/></>;}
    else if(['AlphaMultiply','Crop'].includes(node.type)){const mid=id(node.id)+':mask';content=<><defs><mask id={mid} maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse" {...rect} style={{maskType:'alpha'}}>{use(source(node,'mask'))}</mask></defs><g mask={`url(#${mid})`}>{use(source(node,'base'))}</g></>; }
    else if(node.type==='Transform'){const transform=graphTransform(node.params,evaluated.get(item.id).world);content=<g transform={`matrix(${transform.join(' ')})`}>{use(source(node,'base'))}</g>;}
    else if(['RasterEffect','ColorRange'].includes(node.type)){const p=node.params,mid=id(node.id)+':mix';content=<LiveRetouch owner={item.id} node={node} base={source(node,'base')?id(source(node,'base')):null} w={w} h={h} world={evaluated.get(item.id).world} {...dependencySignature(node.id)} filterId={mid} rect={rect}>{use(source(node,'base'))}</LiveRetouch>;}
    else if(['Blur','DirectionalBlur'].includes(node.type))content=<LiveBlur owner={item.id} node={node} base={source(node,'base')?id(source(node,'base')):null} world={evaluated.get(item.id).world} rect={rect} {...dependencySignature(node.id)}>{use(source(node,'base'))}</LiveBlur>;
    else if(filterTypes.includes(node.type))content=<><defs><filter id={`${id(node.id)}:filter`} filterUnits="userSpaceOnUse" x={rect.x-250} y={rect.y-250} width={rect.width+500} height={rect.height+500} colorInterpolationFilters="sRGB"><FilterPrimitives node={node}/></filter></defs><g data-filter-node={node.type} filter={`url(#${id(node.id)}:filter)`}>{use(source(node,'base'))}</g></>;
    else if(node.type==='Add')content=<>{use(source(node,'base'))}{use(source(node,'mask'))}</>;
    else if(node.type==='Subtract')content=<><defs><mask id={`${id(node.id)}:mask`} maskUnits="userSpaceOnUse" {...rect}><rect {...rect} fill="white"/><g filter={`url(#${prefix}:black)`}>{use(source(node,'mask'))}</g></mask></defs><g mask={`url(#${id(node.id)}:mask)`}>{use(source(node,'base'))}</g></>;
    else if(cssBlendMode[node.type])content=<g style={{isolation:'isolate'}} data-blend-operation={node.type}>{use(source(node,'base'))}{node.type==='Divide'&&<defs><filter id={`${id(node.id)}:invert`} colorInterpolationFilters="sRGB"><feColorMatrix values="-1 0 0 0 1 0 -1 0 0 1 0 0 -1 0 1 0 0 0 1 0"/></filter></defs>}<g style={{mixBlendMode:cssBlendMode[node.type]}}><g filter={node.type==='Divide'?`url(#${id(node.id)}:invert)`:undefined}>{use(source(node,'mask'))}</g></g></g>;
    else if(node.type==='Output')content=use(source(node,'base'));
    return <g key={node.id} id={id(node.id)} transform={maskTypes.includes(node.type)?`matrix(${maskLocalTransform(node.params,evaluated.get(item.id).world,w,h).join(' ')})`:undefined}>{content}</g>;
  })}</defs><SignalFade owner={item.id} prefix={prefix} node={graph.nodes.some(n=>n.id===displayNode)?displayNode:'output'} animations={animations}/></>;
}
export function PixelModifiers(props){
  if(props.item.cropRect)return <><defs><clipPath id={`crop-${props.item.id}`}><rect {...props.item.cropRect}/></clipPath></defs><g clipPath={`url(#crop-${props.item.id})`}><PixelModifiers {...props} item={{...props.item,cropRect:undefined}}/></g></>;
  if(props.item.rasterResult)return <PixelModifiers {...props} item={{...props.item,rasterResult:undefined}}><image href={props.item.rasterResult.src} width={props.item.rasterResult.width} height={props.item.rasterResult.height} preserveAspectRatio="none"/></PixelModifiers>;
  if(!props.item.graph)return <LegacyPixelModifiers {...props}/>;
  return <LegacyPixelModifiers {...props} item={{...props.item,paint:[],erasures:[],nodeInputs:[],graph:undefined}}><GraphOutput {...props}/></LegacyPixelModifiers>;
}
function LegacyPixelModifiers({item,w,h,children,items=[],evaluated}){
  children=<>{children}<PaintStrokes item={item}/>{(item.rasterPaint??[]).map((r,i)=><image key={i} href={r.src} x={r.x??0} y={r.y??0} width={r.width} height={r.height} preserveAspectRatio="none"/>)}</>;
  const mask=`erase-${item.id}`,filter=`adjust-${item.id}`,black=`signal-black-${item.id}`,rect=(items.length?selectionBoxes(items,evaluated).get(item.id):ownBox(item))??{x:0,y:0,width:w,height:h};
  const signals=(item.nodeInputs??[]).filter(s=>s.enabled!==false&&isDescendant(items,s.sourceId,item.id)),subtract=signals.filter(s=>s.operation==='Subtract'),hasMask=item.erasures?.length>0||subtract.length>0;
  function signal(s){return <SignalArtwork key={s.sourceId} owner={item} signal={s} items={items} evaluated={evaluated}/>;}
  return <><defs>{hasMask&&<mask id={mask} maskUnits="userSpaceOnUse" {...rect}><rect {...rect} fill="white"/>{(item.erasures??[]).map((s,i)=><StrokeArtwork key={i} stroke={{...s,color:'black'}} colorOverride="black"/>)}<g filter={`url(#${black})`}>{subtract.map(signal)}</g></mask>}{subtract.length>0&&<filter id={black} colorInterpolationFilters="sRGB"><feColorMatrix values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0"/></filter>}{item.kind==='Image'&&<filter id={filter} filterUnits="userSpaceOnUse" {...compositionDomain(evaluated?.get(item.id)?.world??[1,0,0,1,0,0])} colorInterpolationFilters="sRGB"><feComponentTransfer><feFuncR type="linear" slope={(item.brightness??1)*(item.contrast??1)} intercept={.5*(1-(item.contrast??1))}/><feFuncG type="linear" slope={(item.brightness??1)*(item.contrast??1)} intercept={.5*(1-(item.contrast??1))}/><feFuncB type="linear" slope={(item.brightness??1)*(item.contrast??1)} intercept={.5*(1-(item.contrast??1))}/></feComponentTransfer><feColorMatrix type="saturate" values={item.saturation??1}/></filter>}</defs><g mask={hasMask?`url(#${mask})`:undefined} filter={item.kind==='Image'?`url(#${filter})`:undefined}>{children}{signals.filter(s=>s.operation!=='Subtract').map(signal)}</g></>;
}
export function useCanvasTools({selectionImage,svg,host,tool,values,items,selected,select,create,change,begin,finish,cancel,zoom,setZoom,pan,setPan,textRequest,setToolMode,onEditObject,maskTarget,onTextSelection}){
  const cfg=useRef();cfg.current={tool,values,items,selected,select,create,change,begin,finish,cancel,zoom,setZoom,pan,setPan,setToolMode,maskTarget,selectionImage};
  const gesture=useRef(null),space=useRef(false),[editing,setEditing]=useState(null),[hover,setHover]=useState(null);
  const point=e=>{const p=new DOMPoint(e.clientX,e.clientY).matrixTransform(svg.current.getScreenCTM().inverse());return {x:Number(p.x.toFixed(4)),y:Number(p.y.toFixed(4))};};
  function editText(id){const c=cfg.current,n=c.items.find(n=>n.id===id);if(!n||n.kind!=='Text'||effectiveState(c.items,id,'locked'))return;c.select(id);c.begin();setEditing(id);}
  useEffect(()=>{if(!editing)onTextSelection?.(null);},[editing]);
  useEffect(()=>{if(textRequest)editText(textRequest.id);},[textRequest]);
  function endText(abort=false){if(!editing)return;abort?cfg.current.cancel():cfg.current.finish();setEditing(null);}
  function zoomAt(e,factor){
    const c=cfg.current,next=Math.max(10,Math.min(800,Math.round(c.zoom*factor))),r=host.current.getBoundingClientRect(),ui=r.width/host.current.clientWidth;
    const nextPan={x:c.pan.x+(1-next/c.zoom)*(e.clientX-r.x-r.width/2-c.pan.x*ui)/ui,y:c.pan.y+(1-next/c.zoom)*(e.clientY-r.y-r.height/2-c.pan.y*ui)/ui};
    c.setPan(nextPan);c.setZoom(next);c.pan=nextPan;c.zoom=next;
  }
  useEffect(()=>{const node=host.current,wheel=e=>{if(editing)return;e.preventDefault();zoomAt(e,Math.exp(-Math.max(-200,Math.min(200,e.deltaY))*.002));};node.addEventListener('wheel',wheel,{passive:false});return()=>node.removeEventListener('wheel',wheel);},[editing]);
  function context(e){const c=cfg.current;return {
    create:c.create,change:c.change,select:c.select,items:c.items,values:c.values,gesture:gesture.current,
    pick:hit=>{if(hit)c.select(hit.id);},zoomAt,
    startPan:()=>{gesture.current.pan={...c.pan};gesture.current.screen={x:e.clientX,y:e.clientY};},
    extendPan:()=>{const g=gesture.current,ui=host.current.getBoundingClientRect().width/host.current.clientWidth;c.setPan({x:g.pan.x+(e.clientX-g.screen.x)/ui,y:g.pan.y+(e.clientY-g.screen.y)/ui});},
    startText:(p,hit)=>{if(hit?.kind==='Text'&&c.values.mode==='Edit'){if(!effectiveState(c.items,hit.id,'locked'))gesture.current.text=hit.id;return;}if(c.values.mode==='Edit')return;const {mode,...style}=c.values;const node=c.create({kind:'Text',name:'Text',text:'Text',x:p.x,y:p.y,...style,...fitText('Text',style)});if(node)gesture.current.text=node.id;},
    startShape:p=>{const node=c.create({kind:'Shape',name:c.tool.variants.find(v=>v.value===c.values.shape)?.label??'Shape',shape:c.values.shape,arrowHead:c.values.arrowHead,heartBulge:c.values.heartBulge,...shapeBox(p,p),color:c.values.color,stroke:c.values.stroke,strokeWidth:c.values.strokeWidth,cornerRadius:c.values.cornerRadius,strokeStyle:c.values.strokeStyle,...(c.values.sides!==undefined?{sides:Math.round(c.values.sides)}:{}),...(c.values.innerRadius!==undefined?{innerRadius:c.values.innerRadius}:{}),...(c.values.lineWidth!==undefined?{lineWidth:c.values.lineWidth}:{})});if(!node)return;gesture.current.id=node.id;gesture.current.start=p;},
    extendShape:(p,square)=>gesture.current.id&&c.change(gesture.current.id,{...shapeBox(gesture.current.start,p,square),drawReverseX:p.x<gesture.current.start.x,drawReverseY:p.y<gesture.current.start.y},false),
    startStroke:p=>{
      const g=gesture.current;g.selectionSrc=c.selectionImage?.();
      const selectedNode=c.items.find(n=>n.id===c.selected),channel=c.tool.id==='eraser'?'erasures':'paint',existingIndex=selectedNode?.[channel]?.findIndex(s=>s.enabled!==false)??-1,targetMask=c.maskTarget?.ownerId===c.selected?c.maskTarget:existingIndex>=0?{channel,index:existingIndex}:null;
      if(targetMask&&['paint','erasures'].includes(targetMask.channel)){
        const node=c.items.find(n=>n.id===c.selected),target=targetMask,s=node?.[target.channel]?.[target.index],inv=node&&inverse(evaluateScene(c.items).get(node.id).world);if(!s||!inv||effectiveState(c.items,node.id,'locked'))return;
        g.id=node.id;g.inverse=inv;g.selectionClip=g.selectionSrc?{src:g.selectionSrc,matrix:inv,width:960,height:600}:undefined;g.maskEdit=target;g.groupColor=c.maskTarget?undefined:c.values.color;g.existing=node[target.channel];g.brush=brushSettings(c.values);g.size=c.values.size*Math.hypot(inv[0],inv[1]);g.engine=new BrushStroke(g.brush,g.size,{...transformPoint(inv,p),pressure:1});g.points=[...g.engine.points];g.erase=!!c.maskTarget&&c.tool.id==='eraser';
        if(!c.maskTarget){g.existing=g.existing.map((old,i)=>i===target.index&&!old.grouped?{...old,baseOpacity:old.baseOpacity??old.opacity??1,opacity:1,grouped:true}:old);}
        const segment={selectionClip:g.selectionClip,size:g.size,color:g.groupColor??s.color??'black',opacity:c.values.opacity??1,brush:g.brush,points:g.points,erase:g.erase};g.segments=s.segments??[];c.change(g.id,{[target.channel]:g.existing.map((old,i)=>i===target.index?{...old,segments:[...g.segments,segment]}:old)},false);return;
      }
      if(c.tool.id==='eraser'){
        const node=c.items.find(n=>n.id===c.selected),world=node&&evaluateScene(c.items).get(node.id)?.world,inv=world&&inverse(world);
        if(!node||effectiveState(c.items,node.id,'locked')||!ownBox(node)||!inv)return;
        g.selectionClip=g.selectionSrc?{src:g.selectionSrc,matrix:inv,width:960,height:600}:undefined;g.id=node.id;g.inverse=inv;g.existing=node.erasures??[];g.size=c.values.size*Math.hypot(inv[0],inv[1]);g.points=[transformPoint(inv,p)];
        c.change(g.id,{erasures:[...g.existing,{selectionClip:g.selectionClip,size:g.size,points:g.points}]},false);
      }else {
        g.brush=brushSettings(c.values);
        const pressure=e.pointerType==='pen'?e.pressure:1;
        const node=c.items.find(n=>n.id===c.selected);
        if(node){
          if(effectiveState(c.items,node.id,'locked')||!effectiveState(c.items,node.id,'visible'))return;
          const inv=inverse(evaluateScene(c.items).get(node.id).world);if(!inv)return;
          g.selectionClip=g.selectionSrc?{src:g.selectionSrc,matrix:inv,width:960,height:600}:undefined;g.id=node.id;g.paint=true;g.inverse=inv;g.existing=node.paint??[];g.size=c.values.size*Math.hypot(inv[0],inv[1]);g.color=c.values.color;g.opacity=c.values.opacity;
          g.engine=new BrushStroke(g.brush,g.size,{...transformPoint(inv,p),pressure});g.points=[...g.engine.points];
          c.change(g.id,{paint:[...g.existing,{selectionClip:g.selectionClip,size:g.size,color:g.color,opacity:g.opacity,brush:g.brush,points:g.points}]},false);
        }else {g.brushSize=c.values.size;g.engine=new BrushStroke(g.brush,g.brushSize,{...p,pressure});g.points=[...g.engine.points];const created=c.create({kind:'Drawing',name:'Brush stroke',...compactStroke(g.points,g.brushSize,g.brush),...(g.selectionSrc?{selectionClip:{src:g.selectionSrc,matrix:[1,0,0,1,-compactStroke(g.points,g.brushSize,g.brush).x,-compactStroke(g.points,g.brushSize,g.brush).y],width:960,height:600}}:null),brush:g.brush,brushSize:c.values.size,color:c.values.color,opacity:c.values.opacity});g.id=created.id;}
      }
    },
    extendStroke:(p,final=false)=>{const g=gesture.current;if(!g.id||g.points.length>=10000)return;const next={...(g.inverse?transformPoint(g.inverse,p):p),pressure:e.pointerType==='pen'?(final?g.engine?.last?.pressure??1:e.pressure):1};if(g.engine){if(!g.engine.push(next,final))return;g.points=[...g.engine.points];}else g.points=[...g.points,next];if(g.maskEdit){const t=g.maskEdit;c.change(g.id,{[t.channel]:g.existing.map((s,i)=>i===t.index?{...s,segments:[...g.segments,{selectionClip:g.selectionClip,size:g.size,color:g.groupColor??s.color??'black',opacity:cfg.current.values.opacity??1,brush:g.brush,points:g.points,erase:g.erase}]}:s)},false);return;}c.change(g.id,g.paint?{paint:[...g.existing,{selectionClip:g.selectionClip,size:g.size,color:g.color,opacity:g.opacity,brush:g.brush,points:g.points}]}:g.inverse?{erasures:[...g.existing,{selectionClip:g.selectionClip,size:g.size,points:g.points}]} :{...compactStroke(g.points,g.brushSize,g.brush),...(g.selectionSrc?{selectionClip:{src:g.selectionSrc,matrix:[1,0,0,1,-compactStroke(g.points,g.brushSize,g.brush).x,-compactStroke(g.points,g.brushSize,g.brush).y],width:960,height:600}}:null)},false);},
  };}
  function stop(abort=false){const g=gesture.current;if(!g)return;gesture.current=null;if(abort&&g.pan)cfg.current.setPan(g.pan);if(g.tool.id!=='hand'&&g.tool.id!=='zoom'){abort?cfg.current.cancel():cfg.current.finish();}if(!abort&&(isShapeTool(g.tool)&&g.id||g.text))cfg.current.setToolMode('Edit');if(!abort&&g.text)requestAnimationFrame(()=>editText(g.text));}
  useEffect(()=>{
    const down=e=>{if(['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)||e.target.isContentEditable)return;if(gesture.current&&commandForKey(e)==='undo'){e.preventDefault();e.stopImmediatePropagation();stop(true);return;}if(e.code==='Space'){space.current=true;e.preventDefault();}if(e.key==='Escape'){if(gesture.current)stop(true);else endText(true);}};
    const up=e=>{if(e.code==='Space')space.current=false;};const blur=()=>{space.current=false;stop(true);};
    window.addEventListener('keydown',down);window.addEventListener('keyup',up);window.addEventListener('blur',blur);
    return()=>{window.removeEventListener('keydown',down);window.removeEventListener('keyup',up);window.removeEventListener('blur',blur);};
  },[editing]);
  useEffect(()=>{if(gesture.current)stop();},[tool.id]);
  useEffect(()=>{if(editing&&(selected!==editing||!items.some(n=>n.id===editing)||tool.id!=='text'&&tool.id!=='select'))endText();},[tool.id,items,editing,selected]);
  const edited=items.find(n=>n.id===editing),frame=edited&&evaluateScene(items).get(editing).world;
  return {editing,zoomAt,
    emptyDown:e=>{
      const c=cfg.current;if(e.button!==0||c.tool.id!=='shape'||c.values.mode!=='Edit')return false;
      const picked=e.target.closest('[data-pick-object],[data-object]'),id=picked?.getAttribute('data-pick-object')??picked?.getAttribute('data-object'),hit=c.items.find(n=>n.id===id);
      if(hit&&hit.kind!=='Background')return false;
      e.preventDefault();e.stopPropagation();host.current.focus({preventScroll:true});host.current.setPointerCapture(e.pointerId);
      gesture.current={tool:c.tool,pendingShape:{point:point(e),screen:{x:e.clientX,y:e.clientY},canCreate:!c.selected}};
      if(c.selected)c.select(null);return true;
    },
    down:e=>{
      if(e.button!==1&&!space.current&&e.target.closest('textarea,.canvas-text-editor'))return false;
      const active=e.button===1||space.current?toolById('hand'):cfg.current.tool;
      if(active.id==='select'||isShapeTool(active)&&cfg.current.values.mode==='Edit'||e.button!==0&&e.button!==1)return false;
      e.preventDefault();e.stopPropagation();host.current.focus({preventScroll:true});host.current.setPointerCapture(e.pointerId);
      if(editing&&!['hand','zoom'].includes(active.id))endText();gesture.current={tool:active};if(!['hand','zoom'].includes(active.id))cfg.current.begin();
      const id=e.target.closest('[data-object]')?.getAttribute('data-object'),hit=cfg.current.items.find(n=>n.id===id);
      active.begin(context(e),point(e),e,hit);return true;
    },
    move:e=>{if(['brush','eraser'].includes(cfg.current.tool.id))setHover(point(e));if(!gesture.current)return false;const pending=gesture.current.pendingShape;if(pending){if(!pending.canCreate||Math.hypot(e.clientX-pending.screen.x,e.clientY-pending.screen.y)<4)return true;delete gesture.current.pendingShape;cfg.current.begin();cfg.current.setToolMode('Create');gesture.current.tool.begin(context(e),pending.point,e,null);}const samples=gesture.current.tool.id==='brush'&&e.nativeEvent?.getCoalescedEvents?.();for(const sample of samples?.length?samples:[e])gesture.current.tool.move(context(sample),point(sample),sample);return true;},
    leave:()=>setHover(null),
    up:e=>{if(!gesture.current)return false;if(gesture.current.engine)context(e).extendStroke(point(e),true);gesture.current.tool.end(context(e),point(e),e);stop();return true;},cancel:()=>stop(true),
    cursor:hover&&['brush','eraser'].includes(tool.id)&&<g data-tool-cursor={tool.id} transform={`translate(${hover.x} ${hover.y}) rotate(${tool.id==='brush'?values.angle??0:0})`} fill="none" stroke="white" strokeWidth="1" pointerEvents="none">{tool.id==='brush'&&values.tip==='Flat'?<rect x={-values.size/2} y={-values.size*(values.roundness??1)/2} width={values.size} height={values.size*(values.roundness??1)} vectorEffect="non-scaling-stroke"/>:<ellipse rx={values.size/2} ry={values.size/2*(tool.id==='brush'?values.roundness??1:1)} vectorEffect="non-scaling-stroke"/>}</g>,
    doubleClick:e=>{const id=document.elementsFromPoint(e.clientX,e.clientY).map(el=>el.closest('[data-object]')?.getAttribute('data-object')).find(Boolean),node=cfg.current.items.find(n=>n.id===id);if(!node||!(['select','text'].includes(tool.id)||isShapeTool(tool))||effectiveState(cfg.current.items,id,'locked'))return;if(['Text','Shape'].includes(node.kind)){endText();onEditObject?.(node);}},
    editor:edited&&<foreignObject transform={`matrix(${frame.join(' ')})`} width={Math.max(40,bounds(edited)[0])} height={Math.max(80,bounds(edited)[1])}><RichTextEditor item={edited} onSelection={onTextSelection} begin={begin} finish={finish} end={endText} onChange={patch=>change(edited.id,{...patch,...fitText(patch.text,{...edited,...patch})},false)}/></foreignObject>,
  };
}
