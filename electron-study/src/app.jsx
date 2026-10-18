import React, { useEffect, useMemo, useRef, useState } from 'react';
import {inlineTextKeys,textStyle,formatTextRange,clearTextOverrides,replaceText} from './rich-text.mjs';
import {DocumentRenderContext} from './render-context.jsx';
import { createRoot } from 'react-dom/client';
import { bounds, initialScene, resetTransform, transaction, updateItem } from './model.mjs';
import { interactionDefaults,worldPoint } from './interaction.mjs';
import {evaluateScene,identity} from './scene-transform.mjs';
import { useManipulator } from './manipulator.jsx';
import {Outliner} from './outliner.jsx';
import {tools,toolById,isShapeTool,toolForObject} from './tools.mjs';
import {ToolBar,ToolParameters} from './tool-ui.jsx';
import {ShapeControls} from './shape-controls.jsx';
import {useFunctionalTools} from './functional-tools.jsx';
import {ItemContent,PixelModifiers,useCanvasTools,fitText,CornerHandle,MaskHatching} from './tool-canvas.jsx';
import {GraphNodeDetails} from './graph-node-details.jsx';
import {retouchTools} from './retouch.mjs';
import {effectForTool,fillNodes} from './tool-effects.mjs';
import {filterTypes} from './filter-nodes.mjs';
import {graphOperations} from './blend-modes.mjs';
import {rangeForColor} from './color-range.mjs';
import {changeMaskSpace} from './mask-space.mjs';
import {ColorRangeEditor} from './color-range-editor.jsx';
import {PropertyRow} from './property-row.jsx';
import {EffectsGraph} from './effect-graph.jsx';
import {attachSignal,signalSources,isDescendant} from './effect-graph.mjs';
import {connectGraph,arrangeGraph,validateGraph,graphFor,changeGraphOperation,setGraphParameter} from './graph-model.mjs';
import {encodeProject,decodeProject} from './project-file.mjs';
import {readImageFile} from './image-import.mjs';
import {CanvasPick} from './canvas-pick.mjs';
import {DockProvider,DockPanel,DockSidebar,DockContent} from './docking.jsx';
import {ProjectAssets,layerPng} from './project-assets.jsx';
import {commandSpecs,commandAllowed,commandForKey,copyObjects,pasteObjects,duplicateObjects} from './editor-commands.mjs';
import {shortcutKey} from './keyboard.mjs';
import {ScrubNumber} from './scrub-number.jsx';
import {SignalFrame} from './signal-fade.jsx';
import {createCanvasObject} from './canvas-creation.mjs';
import {usePixelBounds} from './pixel-bounds.jsx';
import {usePixelPick} from './pixel-pick.jsx';
import {shapeOutlinePatch} from './shape-outline.mjs';
import {isParameter,wrapFunction} from './parameter-graph.mjs';
import {ObjectEffects} from './object-effects.jsx';
import {addObjectEffect,exposeParameter,syncExposedGraph} from './object-effects.mjs';
import {selectionBoxes} from './content-bounds.mjs';
import {canModify,createNode,deleteLayers,effectiveState,groupLayers,moveLayers,orderedScene,renameLayer} from './hierarchy.mjs';

// Shared primitives: panels, buttons, icons, numeric fields and one Outliner.
const paths = {
  blur:'M12 2C9 7 4 11 4 15a8 8 0 0 0 16 0c0-4-5-8-8-13Z',sharpen:'M12 2 22 21H2Z',smudge:'M4 19c14 3 17-15 5-13-9 1-3 11 5 7',dodge:'M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2M17 12a5 5 0 1 1-10 0 5 5 0 0 1 10 0',burn:'M13 2c6 9-2 8 5 12 5 11-17 12-13 0l5-8v7c4-2 1-7 3-11Z',sponge:'M4 5h15l3 12-5 4H3L1 9ZM6 10h1m6-2h1m2 7h1m-9 1h1',clone:'M5 17h14v5H5ZM8 17v-4h8v4M9 10V5a3 3 0 0 1 6 0v5Z',heal:'m3 15 12-12c5-5 11 1 6 6L9 21c-5 5-11-1-6-6ZM7 11l6 6m-2-8 4 4',liquify:'M3 4c18-5-10 13 8 9s11 7-1 8',lasso:'M7 17c-15-13 16-22 15-6-1 10-24 3-14 10l3 2',
  eyedropper:'M14 3 21 10M16 1l7 7-4 4-3-3-9 9-5 2 2-5 9-9-1-1Z',gradient:'M3 3h18v18H3ZM7 3v18M11 3v18M16 3v18',crop:'M6 2v16h16M2 6h16v16',marquee:'M3 7V3h4m4 0h3m4 0h3v4m0 4v3m0 4v3h-4m-4 0h-3m-4 0H3v-4m0-4v-3',wand:'M3 21 17 7l4 4L7 25M17 1v3m6 0-2 2M10 4l2 2M22 17l-2-2',
  line:'M3 21 21 3',arrow:'M3 21 21 3M9 3h12v12',triangle:'M12 3 22 21H2Z',diamond:'m12 2 10 10-10 10L2 12Z',
  pentagon:'M12 2 22 10l-4 12H6L2 10Z',hexagon:'M7 3h10l5 9-5 9H7L2 12Z',star:'m12 2 3 7 7 1-5 5 1 7-6-4-6 4 1-7-5-5 7-1Z',
  polygon:'M12 2 21 7l1 10-8 5-10-3L2 9Z',heart:'M12 21 3 12C-3 4 7-1 12 6c5-7 15-2 9 6Z',callout:'M3 3h18v14H9l-6 5v-5H3Z',

  fill:'m12 2 9 9-9 9-9-9ZM4 12h16M21 16s-2 2-2 4a2 2 0 0 0 4 0c0-2-2-4-2-4',
  outline:'M3 3h18v18H3ZM7 7h10v10H7Z',strokeWidth:'M3 5h18M3 12h18M3 18h18M3 20h18M3 19h18',
  font:'M3 20 10 3h2l7 17M6 13h10M19 5h4M21 5v10',fontSize:'M2 5h12M8 5v16M4 21h8M19 3v18M16 6l3-3 3 3M16 18l3 3 3-3',
  gear:'M10 2h4l.5 3 2 .9 2.6-1.5 2 3.4-2.4 1.8.2 2.4 2.4 1.8-2 3.4-2.6-1.5-2 .9-.5 3h-4l-.5-3-2-.9-2.6 1.5-2-3.4 2.4-1.8-.2-2.4L1.4 7.6l2-3.4L6 5.7l2-.9ZM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
  menu:'M3 5h18M3 12h18M3 19h18', add:'M12 4v16M4 12h16', plus:'M12 4v16M4 12h16',
  search:'M16 16l5 5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
  eye:'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12ZM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
  hidden:'M3 3l18 18M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z',
  image:'M3 3h18v18H3ZM3 17l6-7 6 7 3-4 3 4M16 7h.01',
  text:'M4 4h16M12 4v16M8 20h8', cube:'M12 2 2 7v10l10 5 10-5V7ZM2 7l10 5 10-5M12 12v10M7 4.5l10 5',
  folder:'M2 6h8l2 3h10v12H2ZM2 6V3h8l2 3h8v3',
  move:'M12 2v20M2 12h20M8 6l4-4 4 4M8 18l4 4 4-4M6 8l-4 4 4 4M18 8l4 4-4 4',
  pointer:'M5 2v18l5-6 6 8 3-2-6-8 8-1Z',
  undo:'M8 4 2 10l6 6M2 10h12a7 7 0 0 1 7 7', redo:'M16 4l6 6-6 6M22 10H10a7 7 0 0 0-7 7',
  reset:'M3 9a9 9 0 1 1 0 7M3 2v7h7', close:'M5 5l14 14M5 19 19 5',
  settings:'M4 6h16M4 12h16M4 18h16M8 3v6M16 9v6M10 15v6',
  rotate:'M3 18V13a9 9 0 0 1 18 0v5M17 14l4 4 2-5',
  splitHorizontal:'M3 4h18v16H3ZM12 4v16',splitVertical:'M3 4h18v16H3ZM3 12h18',
  edit:'m15 3 6 6M3 21l2-7L16 3a2 2 0 0 1 3 0l2 2a2 2 0 0 1 0 3L10 19ZM5 14l5 5',
  delete:'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7',
  folderAdd:'M2 6V3h8l2 3h8v3M2 6h8l2 3h10v12H2ZM16 12v6M13 15h6',
  layerAdd:'M4 3h16v18H4ZM12 7v10M7 12h10',
  lock:'M5 10h14v11H5ZM8 10V6a4 4 0 0 1 8 0v4',
  chevron:'m8 4 8 8-8 8', dots:'M5 12h.01M12 12h.01M19 12h.01',
  flip:'M3 4l7 8-7 8ZM21 4l-7 8 7 8ZM12 2v20', grid:'M3 3h18v18H3ZM3 9h18M3 15h18M9 3v18M15 3v18',
  brush:'m14 3 7 7-9 9-7-7ZM5 12c-6 2 0 7-4 9 7 1 9-4 7-6',eraser:'m14 3 8 8-10 10H6L1 16ZM5 12l9 9M12 21h10',
  copy:'M8 8h13v13H8ZM3 16H2V2h14v1',paste:'M8 4H4v18h16V4h-4M8 2h8v5H8Z',cut:'M21 3 9 15M21 21 9 9M9 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0M9 17a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
  rectangle:'M3 4h18v16H3Z',ellipse:'M22 12a10 8 0 1 1-20 0 10 8 0 0 1 20 0',hand:'M8 12V5a2 2 0 0 1 4 0v6-8a2 2 0 0 1 4 0v8-5a2 2 0 0 1 4 0v10c0 7-10 8-13 3L2 13a2 2 0 0 1 3-2l3 3',
};
function Icon({ name, size=16 }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name] || paths.cube}/></svg>; }
function Button({ icon, children, title, active, ...props }) { return <button className={`button ${active?'active':''} ${children?'':'icon-button'}`} title={title} aria-label={title || (typeof children==='string'?children:undefined)} {...props}>{icon&&<Icon name={icon}/>} {children}</button>; }
function Panel({ title, icon, children, className='', onDrop, actions }) {
  return <section className={`panel ${className}`} aria-label={title} onDragOver={onDrop?e=>e.preventDefault():undefined} onDrop={onDrop}>
    <header className="panel-header"><span className="panel-tab" draggable={!!onDrop} onDragStart={e=>e.dataTransfer.setData('text/plain', title)}><Icon name={icon}/>{title}</span><span className="panel-actions">{actions}</span></header>{children}
  </section>;
}
function NumberField({ label, value, onChange, begin, finish, cancel, axis, step=1, disabled=false }) {
  return <label className={`number-field ${axis?'axis-'+axis:''}`}><span>{label}</span><ScrubNumber label={label} value={value} onChange={onChange} begin={begin} finish={finish} cancel={cancel} step={step} disabled={disabled}/></label>;
}
function Viewport({ items, selected, selectedIds, select, change, begin, finish, cancel, grid, zoom, setZoom, settings, animations, tool, toolValues, create, pan, setPan, textRequest, setToolMode, onEditObject, maskTarget, onTextSelection, onSampleColor, onPixelPaste, effectTarget, graphPreviewOwner, graphPreviewNode, transformSnap }) {
  const svg=useRef(),host=useRef(),corners=useRef(),geometry=useRef(),clickSelection=useRef(null),picker=useRef(new CanvasPick());
  const [documentScale,setDocumentScale]=useState(1),[interacting,setInteracting]=useState(false);
  useEffect(()=>{const node=svg.current,update=()=>setDocumentScale(Math.max(.001,node.clientWidth/960));update();const observer=new ResizeObserver(update);observer.observe(node);return()=>observer.disconnect();},[]);
  const transforming=tool.id==='select'||isShapeTool(tool)&&toolValues.mode==='Edit';
  const evaluated=useMemo(()=>evaluateScene(items),[items]);
  const pixelHit=usePixelPick(items,evaluated,graphPreviewOwner,graphPreviewNode);
  const pixelOwner=items.find(n=>n.id===selected),pixelBox=usePixelBounds(pixelOwner,evaluated.get(selected)?.world,selected===graphPreviewOwner?graphPreviewNode:'output',items);
  const boxes=useMemo(()=>{const result=selectionBoxes(items.map(n=>n.id===graphPreviewOwner&&graphPreviewNode&&graphPreviewNode!=='output'?{...n,graph:{...graphFor(n),edges:[...graphFor(n).edges.filter(e=>e.to!=='output'),{from:graphPreviewNode,to:'output',port:'base'}]}}:n),evaluated);if(pixelBox)result.set(selected,pixelBox.box);return result;},[items,evaluated,transforming,graphPreviewOwner,graphPreviewNode,pixelBox,selected]);
  const owner=useMemo(()=>{const n=transforming&&selectedIds.length===1?items.find(i=>i.id===selected):null;return n&&boxes.get(n.id)?{...n,locked:effectiveState(items,n.id,'locked'),visible:effectiveState(items,n.id,'visible')}:null;},[items,selected,selectedIds,transforming,boxes]);
  const pointEditing=owner&&(owner.shape==='line'||tool.id==='shape'&&toolValues.mode==='Edit'&&!['rectangle','ellipse'].includes(owner.shape??'ellipse'));
  const functional=useFunctionalTools({transformSnap,svg,host,tool,values:toolValues,items,selected,change,onSampleColor,begin,finish,cancel,onMode:setToolMode,onPixelPaste,effectTarget,settings,zoom,animations});
  const gizmo=useManipulator({snap:transformSnap,svg,item:pointEditing?null:owner,boxFor:id=>boxes.get(id),spaceFor:id=>evaluated.get(id)?.space??identity(),select,change,begin,finish,cancel,zoom,settings,animations,onClickItem:node=>{if(node.kind==='Shape'&&clickSelection.current===node.id)onEditObject?.(node);}});
  const canvas=useCanvasTools({selectionImage:functional.selectionImage,svg,host,tool,values:toolValues,items,selected,select,create,change,begin,finish,cancel,zoom,setZoom,pan,setPan,textRequest,setToolMode,onEditObject,maskTarget,onTextSelection});
  const signals=useMemo(()=>signalSources(items),[items]),maskOwner=maskTarget&&items.find(n=>n.id===maskTarget.ownerId),maskStroke=maskOwner?.[maskTarget?.channel]?.[maskTarget?.index];
  useEffect(()=>{if(picker.current.last&&picker.current.last.target!==selected)picker.current.reset();},[selected]);
  function hitAt(e){const matrix=svg.current?.getScreenCTM();if(!matrix)return null;const point=new DOMPoint(e.clientX,e.clientY).matrixTransform(matrix.inverse()),hits=[];
   for(const el of document.elementsFromPoint(e.clientX,e.clientY)){
    const target=el.closest('[data-pick-object],[data-object]'),id=target?.getAttribute('data-pick-object')??target?.getAttribute('data-object');
    if(id&&!hits.includes(id)&&(target.hasAttribute('data-pick-object')||pixelHit(id,point)))hits.push(id);
   }
   return hits.includes(selected)&&isDescendant(items,selected,hits[0])?selected:hits[0];
  }
  function startCanvasMove(e,fallback){if(!transforming||canvas.editing)return;const frame=!!e.currentTarget.closest('.group-selection');if(frame)picker.current.reset();const direct=hitAt(e),id=frame?fallback.id:signals.has(direct)?direct:picker.current.pick(items,direct,{x:e.clientX,y:e.clientY},selected),node=items.find(n=>n.id===id);clickSelection.current=selected;if(node)gizmo.startMove(e,{...node,locked:effectiveState(items,node.id,'locked')});else if(e.button===0){e.stopPropagation();select(null);}}
  return <div className={`viewport ${grid?'with-grid':''}`} data-manipulating={interacting} tabIndex={0} aria-label="Canvas preview" {...gizmo.bind} ref={el=>{host.current=el;gizmo.bind.ref.current=el;}} style={{cursor:transforming?gizmo.bind.style.cursor:tool.cursor}}
    onPointerDownCapture={e=>{if(e.button===0)setInteracting(true);if(geometry.current?.down(e)||corners.current?.down(e)||functional.down(e)||canvas.down(e)||e.target.closest('textarea'))return;if(!gizmo.bind.onPointerDownCapture(e))canvas.emptyDown(e);}}
    onPointerMove={e=>{if(geometry.current?.move(e)||corners.current?.move(e)||functional.move(e))return;if(e.buttons)picker.current.moved({x:e.clientX,y:e.clientY});if(!canvas.move(e))gizmo.bind.onPointerMove(e);}}
    onPointerLeave={e=>{geometry.current?.leave();functional.leave();corners.current?.leave();canvas.leave();gizmo.bind.onPointerLeave(e);}}
    onPointerUp={e=>{setInteracting(false);if(geometry.current?.up(e)||corners.current?.up(e)||functional.up(e))return;if(!canvas.up(e))gizmo.bind.onPointerUp(e);}}
    onPointerCancel={()=>{setInteracting(false);geometry.current?.cancel();functional.cancel();corners.current?.cancel();canvas.cancel();gizmo.bind.onPointerCancel();}}
    onLostPointerCapture={()=>{setInteracting(false);geometry.current?.cancel();functional.cancel();corners.current?.cancel();canvas.cancel();gizmo.bind.onLostPointerCapture();}}
    onDoubleClick={canvas.doubleClick}>
    <div className="viewport-chips"><span>2D</span><span>Lit</span><span className="muted">Composition preview</span></div>
    <div className="artboard" style={{width:`${zoom}%`,transform:`translate(-50%,-50%) translate(${pan.x}px,${pan.y}px)`}}><DocumentRenderContext.Provider value={{scale:documentScale,evaluated}}><svg ref={svg} viewBox="0 0 960 600">
      <defs><linearGradient id="back" x2="1" y2="1"><stop stopColor="#061c32"/><stop offset="1" stopColor="#124c62"/></linearGradient><linearGradient id="card" x2="1" y2="1"><stop stopColor="#172739"/><stop offset="1" stopColor="#352354"/></linearGradient><linearGradient id="rim"><stop stopColor="#0ad4df"/><stop offset="1" stopColor="#9fa6ea"/></linearGradient><pattern id="paper-grid" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M20 0H0V20" fill="none" stroke="#fff" strokeOpacity=".055"/></pattern></defs>
      <rect width="960" height="600" fill="#161616"/>
      {orderedScene(items).reverse().filter(i=>(!signals.has(i.id)||i.id===selected||i.id===maskTarget?.sourceId)&&(i.kind!=='Folder'||i.paint?.length||i.nodeInputs?.length||i.graph)&&effectiveState(items,i.id,'visible')).map(item=>{const [w,h]=bounds(item);return <g key={item.id} transform={`matrix(${evaluated.get(item.id).space.join(' ')})`}><g data-object={item.id} transform={`translate(${item.x} ${item.y}) rotate(${item.rotation} ${w*item.sx/2} ${h*item.sy/2}) scale(${item.sx} ${item.sy})`} opacity={evaluated.get(item.id).opacity} onPointerDown={e=>startCanvasMove(e,item)} className={effectiveState(items,item.id,'locked')?'locked-object':'canvas-object'}>
        <PixelModifiers animations={animations} displayNode={item.id===graphPreviewOwner?graphPreviewNode:null} item={item.id===graphPreviewOwner&&!item.graph?{...item,graph:graphFor(item)}:item} w={w} h={h} items={items} evaluated={evaluated}>{item.kind==='Layer'?null:item.kind==='Background'?<rect width="960" height="600" fill="url(#back)"/>:item.kind==='Image'&&!item.src?<><rect width={w} height={h} rx="3" fill="url(#card)"/><rect width={w} height={h} fill="url(#paper-grid)"/><path d="M0 220h420v30H0Z" fill="url(#rim)" opacity=".7"/><circle cx="284" cy="113" r="65" fill="none" stroke="url(#rim)" strokeWidth="20"/><path d="M34 65h85M34 84h85M34 103h64" stroke="#b8d0da" strokeWidth="7"/></>:<ItemContent item={item} w={w} h={h}/>}</PixelModifiers>
        <SignalFrame identity={item.id===graphPreviewOwner?graphPreviewNode??'output':'output'} box={boxes.get(item.id)} visible={!(pointEditing&&item.id===owner.id)&&!canvas.editing&&!(functional.maskEditing&&selected===item.id)&&selectedIds.includes(item.id)} animations={animations} immediate={interacting} measured={item.id===selected&&!!pixelBox}/>
      </g></g>})}{!canvas.editing&&items.filter(n=>['Folder','Layer'].includes(n.kind)&&selectedIds.includes(n.id)&&boxes.get(n.id)&&effectiveState(items,n.id,'visible')).map(n=><g key={'group-'+n.id} className="selection group-selection" transform={`matrix(${evaluated.get(n.id).world.join(' ')})`}><rect {...boxes.get(n.id)} fill="none" pointerEvents="stroke" stroke="#39d3df" strokeWidth="1.3" vectorEffect="non-scaling-stroke" onPointerDown={e=>startCanvasMove(e,n)}/></g>)}{transforming&&!pointEditing&&!canvas.editing&&gizmo.overlay}{canvas.cursor}{canvas.editor}{functional.overlay}
      {pointEditing&&<ShapeControls key={owner.id+owner.shape} controller={geometry} settings={settings} animations={animations} snap={transformSnap} item={owner} world={evaluated.get(owner.id).world} begin={begin} finish={finish} cancel={cancel} change={change}/>}
      {transforming&&items.filter(n=>signals.has(n.id)&&effectiveState(items,n.id,'visible')).map(n=>{const [w,h]=bounds(n);return <g key={'pick-'+n.id} data-pick-object={n.id} transform={`matrix(${evaluated.get(n.id).world.join(' ')})`} opacity="0" pointerEvents="visiblePainted" onPointerDown={e=>startCanvasMove(e,n)}><ItemContent item={n} w={w} h={h}/></g>;})}
      {tool.id==='shape'&&toolValues.mode==='Edit'&&owner?.shape==='rectangle'&&<CornerHandle controller={corners} animations={animations} settings={settings} item={owner} world={evaluated.get(owner.id).world} change={change} begin={begin} finish={finish} cancel={cancel}/>}
      {maskStroke&&maskTarget.type==='Paint_Mask'&&<MaskHatching stroke={maskStroke} world={evaluated.get(maskOwner.id).world}/>}
    </svg></DocumentRenderContext.Provider></div><div className="canvas-caption">960 × 600 <span>·</span> sRGB <span>·</span> UI sample</div>
  </div>;
}
function App(){
  const [interaction,setInteraction]=useState(interactionDefaults);
  const [textRequest,setTextRequest]=useState(null);
  const [toolId,setToolId]=useState('select'),[toolSettings,setToolSettings]=useState(()=>Object.fromEntries(tools.map(t=>[t.id,{...t.defaults}]))),[pan,setPan]=useState({x:0,y:0});
  const imageInput=useRef(),tool=toolById(toolId);
  const [items,setItems]=useState(initialScene),ref=useRef(items),[selected,setSelected]=useState('card');
  const [selectedIds,setSelectedIds]=useState(['card']);
  const [graphOpen,setGraphOpen]=useState(false),[graphNode,setGraphNode]=useState(null),[signalPreview,setSignalPreview]=useState(null),graphPosition=useMemo(()=>({x:360,y:160}),[]);
  const graphViews=useRef(new Map());
  const [graphOwner,setGraphOwner]=useState(null),[graphPinned,setGraphPinned]=useState(true);
  useEffect(()=>{if(!graphPinned&&graphOpen){if(graphNode?.type==='NodeInput'&&graphNode.ownerId===graphOwner&&graphNode.sourceId===selected)return;setGraphOwner(selected);setGraphNode(null);}},[selected,graphPinned,graphOpen]);
  useEffect(()=>{if(!graphPinned)setGraphNode(node=>node&&(node.ownerId===selected||node.type==='NodeInput'&&node.sourceId===selected)?node:null);},[selected,graphPinned]);
  const [assets,setAssets]=useState([{id:'composition',kind:'Composition',name:'Untitled composition'}]),assetRef=useRef(assets);assetRef.current=assets;
  const [projectName,setProjectName]=useState('Untitled.mycutproject'),[projectBusy,setProjectBusy]=useState(false),[documentRevision,setDocumentRevision]=useState(0),projectActions=useRef(),dirty=useRef(false);
  function storeAssets(next){dirty.current=true;const value=typeof next==='function'?next(assetRef.current):next;assetRef.current=value;setAssets(value);}
  useEffect(()=>{document.title=`${dirty.current?'* ':''}${projectName} — MyCut`;},[items,assets,projectName,projectBusy]);
  const [history,setHistory]=useState({past:[],future:[]}),historyRef=useRef(history),editBefore=useRef(null);
  const clipboard=useRef({snapshot:null,pasteCount:0}),commandsRef=useRef();
  const [,refreshClipboard]=useState(0);
  const [global,setGlobal]=useState(true),[grid,setGrid]=useState(true),[zoom,setZoom]=useState(86),[scale,setScale]=useState(100),[animations,setAnimations]=useState(true),[settings,setSettings]=useState(false),[swapped,setSwapped]=useState(false),[status,setStatus]=useState('Ready · isolated UI prototype'),[assetQuery,setAssetQuery]=useState(''),[folder,setFolder]=useState('All'),[menu,setMenu]=useState(null),[linked,setLinked]=useState(true);
  const [textSelection,setTextSelection]=useState(null);
  function rememberTextSelection(next){setTextSelection(old=>old?.id===next?.id&&old?.start===next?.start&&old?.end===next?.end?old:next);}
  const workspace=useRef(),item=items.find(i=>i.id===selected);
  const toolValues={...toolSettings[toolId]};for(const p of tool.parameters)toolValues[p.id]=tool.valueFor(item,p.id,toolSettings[toolId])??toolValues[p.id];
  if(toolId==='gradient'&&toolValues.mode==='Edit'){const p=effectForTool(item,'gradient',graphNode?.id)?.params;if(p)Object.assign(toolValues,p,{color:p.stops[0].color,endColor:p.stops.at(-1).color});}
  if((toolId==='fill'||retouchTools.some(t=>t.id===toolId))&&toolValues.mode==='Edit'){const effect=effectForTool(item,toolId,graphNode?.id);if(effect)Object.assign(toolValues,effect.params);}
  if(toolId==='fill'&&toolValues.mode==='Edit'){const {color,range}=fillNodes(item,graphNode?.ownerId===selected?graphNode.id:null);if(color)toolValues.color=color.params.color;if(range){const {mode,...rangeValues}=range.params;Object.assign(toolValues,rangeValues,{contiguous:mode});}}
  if(toolId==='text'&&textSelection&&item?.id===textSelection.id&&textSelection.end>textSelection.start)Object.assign(toolValues,textStyle(item,textSelection.start));
  function setToolMode(mode){setToolSettings(old=>({...old,[toolId]:{...old[toolId],mode}}));}
  function chooseTool(id,variant){finish();if(id==='rectangle'||id==='ellipse'){variant=id;id='shape';}if(isShapeTool(toolById(id))||id==='text')setToolSettings(old=>({...old,[id]:{...old[id],...(variant?{shape:variant}:{}),mode:variant?'Create':toolById(id).matches(item,{mode:'Edit'})?'Edit':'Create'}}));setToolId(id);}
  function editObject(node){selectOnly(node.id);const id=toolForObject(node)?.id??(node.kind==='Text'?'text':'shape');setToolSettings(old=>({...old,[id]:{...old[id],mode:'Edit'}}));setToolId(id);if(id==='text')setTextRequest({id:node.id,token:crypto.randomUUID()});}
  function fitCanvas(){const view=workspace.current?.querySelector('.viewport');if(!view)return;setZoom(Math.max(10,Math.min(800,Math.floor(Math.min((view.clientWidth-28)/view.clientWidth,(view.clientHeight-28)*1.6/view.clientWidth)*100))));setPan({x:0,y:0});}
  function updateTool(id,value){
    const valid=tool.validate(id,value);if(valid===undefined)return;
    setToolSettings(old=>({...old,[toolId]:{...old[toolId],[id]:valid}}));
    if(['brush','eraser'].includes(toolId)&&id==='mode'&&valid==='Create')setGraphNode(null);
    if(toolId==='gradient'&&toolValues.mode==='Edit'&&item?.graph&&id!=='mode'){const effect=effectForTool(item,'gradient',graphNode?.id);if(effect&&!effectiveState(items,item.id,'locked')){const p={...effect.params};if(id==='color')p.stops=p.stops.map((s,i)=>i===0?{...s,color:valid}:s);else if(id==='endColor')p.stops=p.stops.map((s,i)=>i===p.stops.length-1?{...s,color:valid}:s);else p[id]=valid;change(item.id,{graph:{...item.graph,nodes:item.graph.nodes.map(n=>n.id===effect.id?{...n,params:p}:n)}},!editBefore.current);}return;}
    if(toolId==='fill'&&toolValues.mode==='Edit'&&item?.graph&&id!=='mode'){const {color,range}=fillNodes(item,graphNode?.ownerId===selected?graphNode.id:null),target=id==='color'?color:range;if(target&&!effectiveState(items,item.id,'locked')){let params={...target.params};if(id==='tolerance'&&range){const middle='#'+[0,1,2].map(i=>Math.round((parseInt(params.lowColor.slice(1+i*2,3+i*2),16)+parseInt(params.highColor.slice(1+i*2,3+i*2),16))/2).toString(16).padStart(2,'0')).join('');Object.assign(params,rangeForColor(middle,valid));}else params[id==='contiguous'?'mode':id]=valid;change(item.id,{graph:{...item.graph,nodes:item.graph.nodes.map(n=>n.id===target.id?{...n,params}:n)}},!editBefore.current);}return;}
    if(retouchTools.some(t=>t.id===toolId)&&toolValues.mode==='Edit'&&item?.graph&&id!=='mode'){const effect=effectForTool(item,toolId,graphNode?.id);if(effect&&!effectiveState(items,item.id,'locked'))change(item.id,{graph:setGraphParameter(item.graph,effect.id,id,valid)},!editBefore.current);return;}
    const patch=tool.patchFor(item,id,valid,toolSettings[toolId]);
    if(patch&&!effectiveState(ref.current,item.id,'locked')){
      if(item.kind==='Shape'&&['shape','sides','innerRadius'].includes(id))Object.assign(patch,{vertices:undefined,...(id==='shape'?{endpoints:undefined}:null)});
      if(item.kind==='Text'){
        if(inlineTextKeys.includes(id)){
          if(item.id===textSelection?.id&&textSelection.end>textSelection.start){delete patch[id];patch.textRuns=formatTextRange(item,textSelection.start,textSelection.end,{[id]:valid});}
          else patch.textRuns=clearTextOverrides(item,[id]);
        }
        Object.assign(patch,fitText(item.text??'',{...item,...patch}));
      }change(item.id,patch,!editBefore.current);
    }
  }
  function createCanvasNode(patch){const node={...newNode(patch.kind,patch.name),...patch};try{const created=createCanvasObject(ref.current,node,selected);store(created.scene);setSelected(node.id);setSelectedIds([node.id]);if(created.owner&&graphOpen&&(graphOwner===created.owner.id||!graphPinned)){setGraphOwner(created.owner.id);setGraphNode({...created.source,ownerId:created.owner.id});setSignalPreview(null);}return created.node;}catch(error){setStatus(error.message);return null;}}
  async function importFiles(files,position={x:80,y:50}){
    const imported=[];for(const file of files){try{const data=await readImageFile(file),ratio=Math.min(1,800/data.naturalWidth,500/data.naturalHeight);imported.push({...newNode('Image',data.name),parentId:null,src:data.src,width:data.naturalWidth*ratio,height:data.naturalHeight*ratio,x:position.x+imported.length*20,y:position.y+imported.length*20});}catch(error){setStatus('Cannot import image: '+error.message);}}
    if(imported.length){finish();commit([...imported,...ref.current]);selectMany(imported.map(n=>n.id),imported[0].id);storeAssets(old=>[...old,...imported.map(n=>({id:crypto.randomUUID(),kind:'Image',name:n.name,src:n.src,width:n.width,height:n.height}))]);setStatus(`${imported.length} image(s) imported`);}
  }
  function importImage(e){const files=[...e.target.files];e.target.value='';return importFiles(files);}
  const imports=useRef();imports.current=importFiles;const pasteHandled=useRef(0);
  useEffect(()=>{const typing=e=>e.target.closest?.('input,textarea,select,[contenteditable=true]');
    const paste=e=>{if(typing(e))return;const files=[...(e.clipboardData?.files??[])].filter(f=>f.type.startsWith('image/'));if(clipboard.current.preferInternal&&clipboard.current.snapshot){e.preventDefault();pasteHandled.current++;commandsRef.current.run('paste');}else if(files.length){e.preventDefault();pasteHandled.current++;imports.current(files);}else if(clipboard.current.snapshot){e.preventDefault();pasteHandled.current++;commandsRef.current.run('paste');}};
    const externalClipboard=()=>{clipboard.current.preferInternal=false;};
    const over=e=>{if([...e.dataTransfer.types].some(t=>['Files','application/x-mycut-asset'].includes(t)))e.preventDefault();};
    const drop=e=>{const asset=e.dataTransfer.getData('application/x-mycut-asset'),files=[...e.dataTransfer.types].includes('Files');if(!asset&&!files)return;e.preventDefault();if(!e.target.closest('.viewport')){setStatus('Drop images onto the canvas');return;}const svg=document.querySelector('.artboard>svg'),p=new DOMPoint(e.clientX,e.clientY).matrixTransform(svg.getScreenCTM().inverse());if(asset){const data=assetRef.current.find(a=>a.id===asset);if(data?.src){commandsRef.current.addAsset(data,p);}}else imports.current([...e.dataTransfer.files],{x:p.x,y:p.y});};
    window.addEventListener('paste',paste);window.addEventListener('dragover',over);window.addEventListener('drop',drop);window.addEventListener('blur',externalClipboard);return()=>{window.removeEventListener('paste',paste);window.removeEventListener('dragover',over);window.removeEventListener('drop',drop);window.removeEventListener('blur',externalClipboard);};
  },[]);
  useEffect(()=>{const keys=e=>{if(document.querySelector('[role=dialog][aria-modal=true]')||e.target.closest('[role=dialog],.context-menu')||['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)||e.target.isContentEditable||e.ctrlKey||e.metaKey||e.altKey||e.repeat)return;const key=shortcutKey(e),found=tools.find(t=>t.shortcut===key);if(found||key==='r'||key==='o'){e.preventDefault();chooseTool(key==='r'?'rectangle':key==='o'?'ellipse':found.id);}};window.addEventListener('keydown',keys);return()=>window.removeEventListener('keydown',keys);},[item?.id]);
  useEffect(()=>{
    const valid=selectedIds.filter(id=>items.some(i=>i.id===id));
    if(selected&&!items.some(i=>i.id===selected)){const fallback=valid.at(-1)||items[0]?.id||null;setSelected(fallback);setSelectedIds(valid.length?valid:fallback?[fallback]:[]);}
    else if(valid.length!==selectedIds.length)setSelectedIds(valid);
  },[items,selected,selectedIds]);
  function selectOnly(id){finish();if(!graphPinned)setGraphNode(null);setSelected(id);setSelectedIds(id?[id]:[]);}
  function selectMany(ids,primary){finish();setSelectedIds(ids);setSelected(primary||null);}
  function store(next){if(next!==ref.current)dirty.current=true;ref.current=next;setItems(next);}
  function storeHistory(next){historyRef.current=next;setHistory(next);}
  function commit(next,before=ref.current){storeHistory(transaction(historyRef.current,before,next));store(next);}
  function change(id,patch,record=true){
    const current=ref.current.find(n=>n.id===id);
    if(current&&patch.graph){try{const synced=syncExposedGraph({...current,...patch},patch.graph),propagated=syncExposedGraph({...current,...(patch.exposedParameters?{exposedParameters:patch.exposedParameters}:null)},synced.graph);patch={...patch,graph:propagated.graph,exposedParameters:synced.exposedParameters,objectEffects:synced.objectEffects};}catch(error){setStatus(error.message);return;}}
    if(current?.kind==='Shape')patch=shapeOutlinePatch(current,patch,evaluateScene(ref.current).get(id).world,toolId!=='shape');if(current?.graph&&['paint','erasures','nodeInputs'].some(key=>key in patch)){try{validateGraph(graphFor({...current,...patch}));}catch{setStatus('Graph limit reached: select an existing Paint_Mask to extend it');return;}}
    if('rotation' in patch&&!('x' in patch)){const n=ref.current.find(n=>n.id===id),box=selectionBoxes(ref.current).get(id);if(n&&box){const a=worldPoint(n,bounds(n),.5,.5,box),b=worldPoint({...n,...patch},bounds(n),.5,.5,box);patch={...patch,x:n.x+a.x-b.x,y:n.y+a.y-b.y};}}
    const next=updateItem(ref.current,id,patch);record?commit(next):store(next);setStatus('Sample updated · no project file modified');}
  useEffect(()=>{const expose=e=>{const {owner:id,node,key}=e.detail,owner=ref.current.find(n=>n.id===id);if(!owner||effectiveState(ref.current,id,'locked'))return;try{finish();const next=exposeParameter(owner,node,key);change(id,{graph:next.graph,exposedParameters:next.exposedParameters});setStatus('Parameter exposed in object Details');}catch(error){setStatus(error.message);}};window.addEventListener('mycut-expose-parameter',expose);return()=>window.removeEventListener('mycut-expose-parameter',expose);},[]);
  function begin(){editBefore.current=structuredClone(ref.current);}
  function finish(){if(editBefore.current){storeHistory(transaction(historyRef.current,editBefore.current,ref.current));editBefore.current=null;}}
  function cancel(){if(editBefore.current){store(editBefore.current);editBefore.current=null;}}
  function undo(){finish();const h=historyRef.current;if(!h.past.length)return;storeHistory({past:h.past.slice(0,-1),future:[ref.current,...h.future]});store(h.past.at(-1));setStatus('Undo');}
  function redo(){finish();const h=historyRef.current;if(!h.future.length)return;storeHistory({past:[...h.past,ref.current],future:h.future.slice(1)});store(h.future[0]);setStatus('Redo');}
  function canCommand(id,ids=selectedIds){return commandAllowed(id,ref.current,ids,{clipboard:clipboard.current.snapshot,history:historyRef.current});}
  function executeCommand(id,ids=selectedIds){
    finish();if(!canCommand(id,ids)){setStatus('Command unavailable: empty or locked selection');return;}
    setMenu(null);
    if(id==='undo'){undo();return;}if(id==='redo'){redo();return;}
    if(id==='selectAll'){selectMany(ref.current.map(n=>n.id),ref.current[0]?.id);return;}
    if(id==='copy'||id==='cut'){clipboard.current={snapshot:copyObjects(ref.current,ids),pasteCount:0,preferInternal:true};refreshClipboard(n=>n+1);if(id==='copy'){setStatus('Objects copied · internal clipboard');return;}}
    if(id==='delete'||id==='cut'){commit(deleteLayers(ref.current,ids));selectMany([],null);setStatus(id==='cut'?'Objects cut':'Objects deleted');return;}
    if(id==='paste'||id==='duplicate'){
      const next=id==='duplicate'?duplicateObjects(ref.current,ids):pasteObjects(ref.current,clipboard.current.snapshot,{offset:20*++clipboard.current.pasteCount});
      if(next.scene!==ref.current){commit(next.scene);selectMany(next.ids,next.ids[0]);setStatus(id==='paste'?'Objects pasted':'Objects duplicated');}
    }
  }
  function addAsset(data,p={x:80,y:50}){finish();const node={...(data.source??{}),...newNode('Image',data.name),src:data.src,width:data.width??960,height:data.height??600,x:p.x,y:p.y,...(data.graph?{graph:data.graph}:null),...(data.parentOffset?{parentOffset:data.parentOffset}:null)};commit([node,...ref.current]);selectOnly(node.id);setStatus('Image layer added');}
  async function exportLayer(){if(!item)return;try{const ids=new Set([item.id]);for(let i=0;i<ref.current.length;i++)for(const n of ref.current)if(ids.has(n.parentId))ids.add(n.id);const src=await layerPng(document.querySelector('.artboard>svg'),ids);storeAssets(old=>[...old,{id:crypto.randomUUID(),kind:'Image',name:item.name+'.png',src,width:960,height:600}]);setStatus('Layer exported to project assets');}catch(error){setStatus('Cannot export layer: '+error.message);}}
  async function saveProject(saveAs=false){if(projectBusy)return;finish();setMenu(null);setProjectBusy(true);setStatus('Saving project…');const scene=ref.current,resources=assetRef.current;try{if(!window.projectFiles)throw new Error('Project file bridge is unavailable');const text=encodeProject({items:scene,assets:resources,view:{zoom,pan},toolSettings}),result=await window.projectFiles.save(text,saveAs);if(result.error)throw new Error(result.error);if(result.canceled){setStatus('Save canceled');return;}setProjectName(result.name);dirty.current=ref.current!==scene||assetRef.current!==resources;setStatus(`Saved ${result.name}`);}catch(error){setStatus('Cannot save project: '+error.message);}finally{setProjectBusy(false);}}
  async function openProject(){if(projectBusy)return;finish();setMenu(null);setProjectBusy(true);try{if(!window.projectFiles)throw new Error('Project file bridge is unavailable');const result=await window.projectFiles.open(dirty.current);if(result.error)throw new Error(result.error);if(result.canceled){setStatus('Open canceled');return;}const data=decodeProject(result.text);editBefore.current=null;store(data.items);setAssets(data.assets);storeHistory({past:[],future:[]});setSelected(data.items[0]?.id??null);setSelectedIds(data.items.length?[data.items[0].id]:[]);setGraphNode(null);setSignalPreview(null);setGraphOpen(false);setGraphPinned(true);setTextRequest(null);setToolId('select');setToolSettings(Object.fromEntries(tools.map(t=>[t.id,{...t.defaults,...data.toolSettings?.[t.id]}])));setZoom(data.view?.zoom??86);setPan(data.view?.pan??{x:0,y:0});setProjectName(result.name);setDocumentRevision(n=>n+1);dirty.current=false;setStatus(`Opened ${result.name}`);}catch(error){setStatus('Cannot open project: '+error.message);}finally{setProjectBusy(false);}}
  projectActions.current={save:saveProject,open:openProject};
  commandsRef.current={run:executeCommand,can:canCommand,addAsset};
  useEffect(()=>{const handler=e=>{
    if((e.ctrlKey||e.metaKey)&&!e.altKey&&['KeyS','KeyO'].includes(e.code)){e.preventDefault();if(!e.repeat){if(e.code==='KeyS')projectActions.current.save(!!e.shiftKey);else projectActions.current.open();}return;}
    const active=document.activeElement,typing=['INPUT','TEXTAREA','SELECT'].includes(active?.tagName)||active?.isContentEditable;
    const id=commandForKey(e);if(id&&!e.defaultPrevented&&!typing&&!document.querySelector('[role=dialog][aria-modal=true]')&&!e.target.closest('.context-menu')){if(id==='paste'){const token=pasteHandled.current;if(!e.repeat)setTimeout(()=>{if(pasteHandled.current===token&&clipboard.current.snapshot)commandsRef.current.run(id);},50);}else {e.preventDefault();if(!e.repeat)commandsRef.current.run(id);}}
    if(e.key==='Escape'){setSettings(false);setMenu(null);}
  };window.addEventListener('keydown',handler);return()=>window.removeEventListener('keydown',handler);},[]);
  function add(){finish();const id=crypto.randomUUID();commit([{id,name:'New ellipse',kind:'Shape',x:430,y:300,sx:1,sy:1,rotation:0,opacity:1,visible:true,locked:false},...ref.current]);selectOnly(id);}
  function outlinerAction(kind,context){
    finish();
    if(kind.startsWith('effect:')){const owner=ref.current.find(n=>n.id===context.ids[0]);if(!owner||effectiveState(ref.current,owner.id,'locked'))return;try{const next=addObjectEffect(owner,kind.slice(7));change(owner.id,{graph:next.graph,objectEffects:next.objectEffects,exposedParameters:next.exposedParameters});selectOnly(owner.id);}catch(error){setStatus(error.message);}return;}
    if(kind==='attachToParent'){const child=ref.current.find(n=>n.id===context.ids[0]),parent=ref.current.find(n=>n.id===child?.parentId);if(!parent||effectiveState(ref.current,parent.id,'locked'))return;const next=attachSignal(ref.current,parent.id,child.id);if(next!==ref.current){const owner=next.find(n=>n.id===parent.id);try{owner.graph=validateGraph(arrangeGraph(graphFor(owner),true));}catch(error){setStatus(error.message);return;}commit(next);setStatus('Child added to parent effects');}return;}
    if(kind==='rename'){const next=renameLayer(ref.current,context.ids[0],context.name);if(next!==ref.current)commit(next);return;}
    if(kind==='edit'){selectOnly(context.ids[0]);requestAnimationFrame(()=>document.querySelector('[aria-label="Object name"]')?.focus());return;}
    if(kind==='delete'){executeCommand('delete',context.ids);return;}
    if(kind==='layer'){
      const node=newNode('Layer','New layer');const next=createNode(ref.current,node,context.parentId);
      if(next!==ref.current){commit(next);selectOnly(node.id);}return;
    }
    if(kind==='folder'||kind==='group'||kind==='groupLayer'){
      const node=newNode(kind==='groupLayer'?'Layer':'Folder',kind==='groupLayer'?'New layer':'New folder');
      const next=kind==='group'||kind==='groupLayer'?groupLayers(ref.current,context.ids,node):createNode(ref.current,node,context.parentId);
      if(next!==ref.current){commit(next);selectOnly(node.id);return next.find(n=>n.id===node.id);}
    }
  }
  function newNode(kind,name){return {id:crypto.randomUUID(),name,kind,x:0,y:0,sx:1,sy:1,rotation:0,opacity:1,visible:true,locked:false};}
  const graphItem=items.find(n=>n.id===graphOwner)??null;
  const maskTarget=graphNode?.channel&&(graphNode.ownerId===selected||graphNode.type==='NodeInput'&&graphNode.sourceId===selected)?graphNode:null;
  const graphValue=maskTarget&&graphItem?.[maskTarget.channel]?.[maskTarget.index];
  const activeGraphNode=graphNode&&graphItem&&graphNode.ownerId===graphItem.id?graphFor(graphItem).nodes.find(n=>n.id===graphNode.id):null;
  useEffect(()=>{if(graphNode){const owner=items.find(n=>n.id===graphNode.ownerId),node=owner&&graphFor(owner).nodes.find(n=>n.id===graphNode.id);if(!node||node.type==='NodeInput'&&node.sourceId!==graphNode.sourceId)setGraphNode(null);}if(signalPreview&&!items.some(n=>n.id===signalPreview.ownerId))setSignalPreview(null);},[items,graphNode,signalPreview]);
  const requestedSignal=signalPreview?.ownerId===graphOwner?signalPreview.id:(isParameter(activeGraphNode)?'output':activeGraphNode?.id),viewportSignal=graphOpen&&graphItem&&graphFor(graphItem).nodes.some(n=>n.id===requestedSignal)?requestedSignal:null;
  function changeGraph(patch,record=true){if(!maskTarget||!graphValue||effectiveState(items,graphItem.id,'locked'))return;const values=graphItem[maskTarget.channel].map((s,i)=>i===maskTarget.index?{...s,...patch}:s),next={[maskTarget.channel]:values};
    if(maskTarget.channel==='nodeInputs'&&patch.operation&&(graphItem.graph||!['Add','Subtract'].includes(patch.operation)))next.graph=changeGraphOperation(graphFor({...graphItem,...next}),`signal-op-${maskTarget.index}`,patch.operation);
    change(graphItem.id,next,record);
  }
  function setNodeOperation(type){if(!activeGraphNode||!graphItem||effectiveState(items,graphItem.id,'locked'))return;finish();const graph=changeGraphOperation(graphFor(graphItem),activeGraphNode.id,type),patch={graph};const match=/^signal-op-(\\d+)$/.exec(activeGraphNode.id);if(match)patch.nodeInputs=graphItem.nodeInputs.map((s,i)=>i===Number(match[1])?{...s,operation:type}:s);change(graphItem.id,patch);}
  function addSignal(id,position,origin){if(!graphItem||effectiveState(items,graphItem.id,'locked'))return;finish();const next=attachSignal(ref.current,graphItem.id,id,{combine:false,position});if(next===ref.current){setStatus('NodeInput must be a child of this object, used only once');return;}try{const owner=next.find(n=>n.id===graphItem.id);if(owner.graph)validateGraph(graphFor(owner));}catch(error){setStatus(error.message);return;}if(position){const owner=next.find(n=>n.id===graphItem.id),graph=graphFor(owner),source=graph.nodes.find(n=>n.type==='NodeInput'&&(owner.nodeInputs?.[n.index]?.sourceId??n.sourceId)===id);if(source)Object.assign(source,position);owner.graph=origin?.to?connectGraph(graph,source.id,origin.to,origin.port):graph;}commit(next);setStatus('Child added as an independent NodeInput');}
  function changeNodeParameter(graph,id,key,value){if(key==='$params')return validateGraph({...graph,nodes:graph.nodes.map(n=>n.id===id?{...n,params:value}:n)});return key==='coordinateSpace'?{...graph,nodes:graph.nodes.map(n=>n.id===id?changeMaskSpace(n,value,evaluateScene(ref.current).get(graphItem.id).world):n)}:setGraphParameter(graph,id,key,value);}
  function updateGraph(graph,record=true){if(!graphItem||effectiveState(ref.current,graphItem.id,'locked'))return;try{validateGraph(graph);change(graphItem.id,{graph},record);if(graphNode&&!graph.nodes.some(n=>n.id===graphNode.id))setGraphNode(null);}catch(error){setStatus(error.message);}}
  function resize(e,property,axis,min,max,placement){e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);const move=ev=>{const r=workspace.current.getBoundingClientRect();const value=axis==='x'?(placement==='left'?ev.clientX-r.left:r.right-ev.clientX):(placement==='top'?ev.clientY-r.top:r.bottom-ev.clientY);workspace.current.style.setProperty(property,`${Math.max(min,Math.min(max,value))}px`);};const stop=()=>{e.target.removeEventListener('pointermove',move);e.target.removeEventListener('pointerup',stop);e.target.removeEventListener('pointercancel',stop);};e.target.addEventListener('pointermove',move);e.target.addEventListener('pointerup',stop);e.target.addEventListener('pointercancel',stop);}
  const numeric=(key,label,axis,step)=> <NumberField label={label} axis={axis} value={item[key]} step={step} disabled={effectiveState(items,item.id,'locked')} begin={begin} finish={finish} cancel={cancel} onChange={value=>change(item.id,linked&&(key==='sx'||key==='sy')?{sx:value,sy:value}:{[key]:value},false)}/>;
  const drop=e=>{e.preventDefault();if(['Outliner','Details'].includes(e.dataTransfer.getData('text/plain')))setSwapped(s=>!s);};
  const inspector=<Panel title="Details" icon="settings" className="inspector" onDrop={drop}><div className="details-scroll">{activeGraphNode&&<GraphNodeDetails begin={begin} finish={finish} cancel={cancel} node={activeGraphNode} owner={graphItem} graph={graphFor(graphItem)} changeOperation={setNodeOperation} changeParameter={(key,value,record=true)=>{if(!effectiveState(items,graphItem.id,'locked')){const graph=graphFor(graphItem);change(graphItem.id,{graph:key==='enabled'?{...graph,nodes:graph.nodes.map(n=>n.id===activeGraphNode.id?{...n,enabled:value}:n)}:changeNodeParameter(graph,activeGraphNode.id,key,value)},record);}}} locked={effectiveState(items,graphItem.id,'locked')} Icon={Icon}/>} {item&&selectedIds.length===1&&<ObjectEffects Icon={Icon} owner={item} locked={effectiveState(items,item.id,'locked')} begin={begin} finish={finish} cancel={cancel} update={(next,record=true)=>change(item.id,{graph:next.graph,exposedParameters:next.exposedParameters,objectEffects:next.objectEffects},record)}/>} {activeGraphNode&&[...graphOperations,...filterTypes].includes(activeGraphNode.type)?null:item&&selectedIds.length===1?<>
    {graphValue&&<details open className="graph-node-properties"><summary>{graphNode.type}</summary><div className="properties"><label className="check"><input type="checkbox" checked={graphValue.enabled!==false} disabled={effectiveState(items,item.id,'locked')} onChange={()=>changeGraph({enabled:graphValue.enabled===false})}/>Enabled</label><NumberField label="Mask opacity" value={graphValue.opacity??1} step={.01} begin={begin} finish={finish} cancel={cancel} onChange={v=>changeGraph({opacity:Math.max(0,Math.min(1,v))},false)}/>{maskTarget.channel==='nodeInputs'?<label>Operation <select aria-label="Signal operation" value={graphValue.operation} onChange={e=>changeGraph({operation:e.target.value})}>{graphOperations.map(type=><option key={type}>{type}</option>)}</select></label>:<><Button icon="brush" onClick={()=>chooseTool('brush')}>Edit mask with brush</Button><Button icon="eraser" onClick={()=>chooseTool('eraser')}>Edit mask with eraser</Button></>}</div></details>}
    <div className="object-heading"><span className="object-kind"><Icon name={item.kind==='Folder'?'folder':item.kind==='Text'?'text':item.kind==='Image'?'image':'cube'} size={22}/></span><input aria-label="Object name" disabled={effectiveState(items,item.id,'locked')} value={item.name} onFocus={begin} onBlur={finish} onChange={e=>change(item.id,{name:e.target.value},false)}/><Button icon="lock" title="Toggle object lock" active={item.locked} onClick={()=>change(item.id,{locked:!item.locked})}/></div>
    <div className="definition">INSTANCE <span>·</span> {item.kind} <span className="tag">UI sample</span></div>
    {<details open className="transform-details"><summary>Transform <Button icon="reset" title="Reset transform" disabled={effectiveState(items,item.id,'locked')} onClick={e=>{e.preventDefault();commit(resetTransform(ref.current,item.id));}}/></summary><div className="properties adaptive-properties">
      <PropertyRow label="Scale" leading={<Button icon="flip" title="Link scale axes" active={linked} aria-pressed={linked} onClick={()=>setLinked(!linked)}/>}>{numeric('sx','Scale X','x',.01)}{numeric('sy','Scale Y','y',.01)}</PropertyRow>
      <PropertyRow label="Position">{numeric('x','Position X','x',1)}{numeric('y','Position Y','y',1)}</PropertyRow>
      <PropertyRow label="Rotation"><input aria-label="Rotation slider" type="range" min="-180" max="180" disabled={effectiveState(items,item.id,'locked')} value={item.rotation} onPointerDown={begin} onPointerUp={finish} onChange={e=>change(item.id,{rotation:Number(e.target.value)},!!editBefore.current===false)}/>{numeric('rotation','Rotation',null,1)}</PropertyRow>
      <PropertyRow label="Opacity"><input aria-label="Opacity slider" type="range" min="0" max="1" step=".01" disabled={effectiveState(items,item.id,'locked')} value={item.opacity} onPointerDown={begin} onPointerUp={finish} onChange={e=>change(item.id,{opacity:Number(e.target.value)},!editBefore.current)}/><span className="value-readout">{Math.round(item.opacity*100)}%</span></PropertyRow>
      <PropertyRow label="Flip"><Button icon="flip" title="Flip horizontal" disabled={effectiveState(items,item.id,'locked')} onClick={()=>change(item.id,{sx:-item.sx})}/><Button icon="flip" title="Flip vertical" className="button vertical-flip" disabled={effectiveState(items,item.id,'locked')} onClick={()=>change(item.id,{sy:-item.sy})}/></PropertyRow>
    </div></details>}
    {item.kind==='Shape'&&<details open><summary>Size</summary><div className="properties adaptive-properties"><PropertyRow label="Size"><NumberField label="Shape width" value={bounds(item)[0]} begin={begin} finish={finish} cancel={cancel} disabled={effectiveState(items,item.id,'locked')} onChange={v=>change(item.id,{width:Math.max(1,v)},false)}/><NumberField label="Shape height" value={bounds(item)[1]} begin={begin} finish={finish} cancel={cancel} disabled={effectiveState(items,item.id,'locked')} onChange={v=>change(item.id,{height:Math.max(1,v)},false)}/></PropertyRow></div></details>}
    {item.kind==='Text'&&<details open><summary>Text</summary><Button icon="text" disabled={effectiveState(items,item.id,'locked')} onClick={()=>{chooseTool('text');setTextRequest({id:item.id,token:crypto.randomUUID()});}}>Edit text on canvas</Button><textarea aria-label="Text content" disabled={effectiveState(items,item.id,'locked')} value={item.text} onFocus={begin} onBlur={finish} onChange={e=>{const patch=replaceText(item,e.target.value);change(item.id,{...patch,...fitText(patch.text,{...item,...patch})},false);}}/></details>}
    <details open><summary>Display</summary><div className="properties"><label className="check"><input type="checkbox" checked={item.visible} onChange={()=>change(item.id,{visible:!item.visible})}/>Visible in composition</label></div></details><Button icon="settings" title="Effects Graph" onClick={()=>{finish();setGraphOwner(item.id);setGraphNode(null);setGraphOpen(true);}}>Effects Graph</Button>
    </>:<p className="empty">{selectedIds.length?`${selectedIds.length} objects selected · use the Outliner menu for group actions`:'Select an object'}</p>}</div><footer className="panel-footer">{item?.name||'No selection'}<span>·</span> {item?.kind}</footer></Panel>;
  function reorder(source,target,side){finish();const next=moveLayers(ref.current,source,target,side);if(next===ref.current)return;commit(next);setStatus('Layer order changed · Undo available');}
  const tree=<Panel title="Outliner" icon="menu" className="outliner" onDrop={drop}><Outliner items={items} selectedIds={selectedIds} selectMany={selectMany} toggle={id=>change(id,{visible:!ref.current.find(i=>i.id===id).visible})} global={global} setGlobal={setGlobal} reorder={reorder} action={outlinerAction} commands={commandsRef.current} Icon={Icon} Button={Button}/></Panel>;
  return <DockProvider Icon={Icon}><div className={`app ${animations?'':'no-animation'}`} style={{zoom:scale/100,'--ui-scale':scale/100}}>
    <nav className="menubar"><span className="brand">M</span>{['File','Edit','Window','Help'].map(label=><div className="menu-wrap" key={label}><button className="menu-button" onClick={()=>setMenu(menu===label?null:label)}>{label}</button>{menu===label&&<div className="menu-popover">{label==='Edit'?commandSpecs.map(c=><button key={c.id} aria-label={c.label} disabled={!canCommand(c.id)} onClick={()=>executeCommand(c.id)}><span><Icon name={c.icon}/> {c.label}</span><kbd>{c.shortcut}</kbd></button>):label==='Window'?<><button onClick={()=>{setSwapped(!swapped);setMenu(null);}}>Swap Outliner / Details</button><button onClick={()=>{setSettings(true);setMenu(null);}}>Interface settings</button></>:label==='File'?<><button disabled={projectBusy} onClick={openProject}>Open project…<kbd>Ctrl+O</kbd></button><button disabled={projectBusy} onClick={()=>saveProject()}>Save project<kbd>Ctrl+S</kbd></button><button disabled={projectBusy} onClick={()=>saveProject(true)}>Save project as…<kbd>Ctrl+Shift+S</kbd></button><button onClick={()=>{store(initialScene());storeHistory({past:[],future:[]});selectOnly('card');setMenu(null);}}>Reset sample scene</button><p className="muted">{projectName}</p></>:<p>Electron + React editor prototype.</p>}</div>}</div>)}<span className="menubar-spacer"/><span className="study-label">ELECTRON / REACT</span><Button icon="settings" title="Interface settings" onClick={()=>setSettings(true)}/></nav>
    <div className="document-tabs"><span className="document-tab"><Icon name="image"/>Untitled composition <span className="dot"/></span><span className="muted">UI workspace study</span></div>
    <div className="main-toolbar"><Button icon="add" onClick={add}>Add object</Button><div className="divider"/><Button icon="undo" title="Undo" disabled={!history.past.length} onClick={undo}/><Button icon="redo" title="Redo" disabled={!history.future.length} onClick={redo}/><div className="divider"/><Button icon={tool.icon} active onClick={()=>chooseTool('select')}>{tool.label}</Button><span className="menubar-spacer"/><label className="zoom-label">Preview <select aria-label="Preview zoom" value={zoom} onChange={e=>setZoom(Number(e.target.value))}>{[...new Set([10,25,50,60,75,86,100,150,200,400,800,zoom])].sort((a,b)=>a-b).map(v=><option key={v} value={v}>{v}%</option>)}</select></label><Button icon="reset" title="Fit canvas" onClick={fitCanvas}/><Button icon="grid" title="Toggle canvas grid" active={grid} onClick={()=>setGrid(!grid)}/></div>
    <ToolParameters extra={toolId==='fill'&&toolValues.mode==='Edit'&&fillNodes(item,graphNode?.id).range?<ColorRangeEditor owner={item} node={fillNodes(item,graphNode?.id).range} value={fillNodes(item,graphNode?.id).range.params} disabled={effectiveState(items,item.id,'locked')} label="Tool color range" onChange={params=>{const range=fillNodes(item,graphNode?.id).range;change(item.id,{graph:validateGraph({...item.graph,nodes:item.graph.nodes.map(n=>n.id===range.id?{...n,params}:n)})});}}/>:null} tool={tool} Icon={Icon} values={toolValues} update={updateTool} begin={begin} finish={finish} cancel={cancel} readOnly={tool.matches(item,toolSettings[toolId])&&effectiveState(items,item?.id,'locked')} disabled={item?.kind!=='Image'||effectiveState(items,item?.id,'locked')} command={cmd=>{if(cmd==='importImage')imageInput.current.click();}}/>
    <input ref={imageInput} aria-label="Import image file" type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={importImage}/>
    <main className="workspace" ref={workspace}><div className="left-workspace"><Panel title="Viewport" icon="image" className="viewport-panel" actions={<span className="muted">2D composition</span>}><div className="canvas-workspace"><ToolBar active={tool} choose={chooseTool} Icon={Icon}/><Viewport transformSnap={toolSettings.select} graphPreviewNode={viewportSignal} graphPreviewOwner={graphOpen?graphOwner:null} key={documentRevision} items={items} selected={selected} selectedIds={selectedIds} select={selectOnly} change={change} begin={begin} finish={finish} cancel={cancel} grid={grid} zoom={zoom} setZoom={setZoom} settings={interaction} animations={animations} tool={tool} toolValues={toolValues} create={createCanvasNode} pan={pan} setPan={setPan} textRequest={textRequest} setToolMode={setToolMode} onEditObject={editObject} maskTarget={maskTarget} onTextSelection={rememberTextSelection} effectTarget={graphNode?.ownerId===selected?graphNode.id:null} onPixelPaste={(data,p)=>addAsset(data,p)} onSampleColor={color=>setToolSettings(old=>Object.fromEntries(Object.entries(old).map(([id,v])=>[id,['brush','shape','fill','gradient','eyedropper'].includes(id)?{...v,color}:v])))}/></div></Panel>
      <div className="horizontal-split" role="separator" aria-label="Resize content browser" onPointerDown={e=>resize(e,'--content-height','y',120,350)}/>
      <DockPanel id="content-browser" label="Content Browser" icon="folder" gestureOrder={2}><ProjectAssets assets={assets} addToCanvas={addAsset} exportLayer={exportLayer} canExport={!!item&&selectedIds.length===1} Icon={Icon}/></DockPanel><DockContent/></div>
      <div className="vertical-split" role="separator" aria-label="Resize sidebar" onPointerDown={e=>{const placement=workspace.current.querySelector('.dock-sidebar')?.dataset.placement,vertical=['top','bottom'].includes(placement);resize(e,vertical?'--dock-height':'--sidebar-width',vertical?'y':'x',vertical?180:285,vertical?Math.max(180,workspace.current.clientHeight-250):Math.max(285,workspace.current.clientWidth-360),placement);}}/>
      <DockPanel id="outliner" label="Outliner" icon="menu" gestureOrder={-1}>{tree}</DockPanel><DockPanel id="details" label="Details" icon="settings" gestureOrder={1}>{inspector}</DockPanel><DockSidebar swapped={swapped}/></main>
    <DockPanel id="effects-graph" label="Effects Graph" icon="settings" enabled={graphOpen} position={graphPosition} onClose={()=>{setGraphOpen(false);setGraphNode(null);setSignalPreview(null);}}><EffectsGraph previewNode={viewportSignal} previewSignal={node=>setSignalPreview(old=>old?.ownerId===graphItem.id&&old.id===node.id?{ownerId:graphItem.id,id:'output'}:{ownerId:graphItem.id,id:node.id})} settings={interaction} views={graphViews} item={graphItem} items={items} selected={graphNode} pinned={graphPinned} togglePin={()=>setGraphPinned(v=>!v)} changeParameter={(id,key,value,record=true)=>{if(key==='operation'){updateGraph(changeGraphOperation(graphFor(graphItem),id,value),record);return;}if(key==='maskOpacity'){const node=graphFor(graphItem).nodes.find(n=>n.id===id);if(node?.channel&&Number.isFinite(value))change(graphItem.id,{[node.channel]:graphItem[node.channel].map((s,i)=>i===node.index?{...s,opacity:Math.max(0,Math.min(1,value))}:s)},record);return;}if(key==='enabled')updateGraph({...graphFor(graphItem),nodes:graphFor(graphItem).nodes.map(n=>n.id===id?{...n,enabled:value}:n)},record);else updateGraph(changeNodeParameter(graphFor(graphItem),id,key,value),record);}} choose={node=>{finish();setSignalPreview(null);if(!node){setGraphNode(null);return;}if(node.type==='Input'){selectOnly(graphItem.id);setToolId('select');}else if(node.type==='Output'){selectOnly(graphItem.id);setToolId('select');}else if(node.type==='NodeInput'){const source=ref.current.find(n=>n.id===node.sourceId);if(source&&['Shape','Text'].includes(source.kind))editObject(source);else{selectOnly(node.sourceId);setToolId('select');}}else if(node.type==='Paint_Mask'){selectOnly(graphItem.id);setToolId('brush');setToolSettings(old=>({...old,brush:{...old.brush,mode:'Edit'}}));}else if(['Gradient','RectangleMask','ColorRange','Crop','RasterEffect','SolidColor'].includes(node.type)){const id=node.type==='Gradient'?'gradient':['RectangleMask','Crop'].includes(node.type)?'crop':['SolidColor','ColorRange'].includes(node.type)?'fill':node.params.tool;selectOnly(graphItem.id);if(tools.some(t=>t.id===id)){setToolId(id);setToolSettings(old=>({...old,[id]:{...old[id],mode:'Edit'}}));}}else{selectOnly(graphItem.id);setToolId('select');}setGraphNode({...node,ownerId:graphItem.id});}} createMask={(position,origin)=>{if(!graphItem||effectiveState(items,graphItem.id,'locked'))return;const index=graphItem.paint?.length??0,next={...graphItem,paint:[...(graphItem.paint??[]),{points:[],size:18,color:toolSettings.brush.color,opacity:1,manual:true}]};const graph=graphFor(next);if(position){const source=graph.nodes.find(n=>n.id===`paint-${index}`);Object.assign(source,position);}change(graphItem.id,{paint:next.paint,graph:origin?.to?connectGraph(graph,`paint-${index}`,origin.to,origin.port):graph});setSelected(graphItem.id);setSelectedIds([graphItem.id]);setGraphNode({...graph.nodes.find(n=>n.id===`paint-${index}`),ownerId:graphItem.id});setToolId('brush');setToolSettings(old=>({...old,brush:{...old.brush,mode:'Edit'}}));}} attach={addSignal} update={updateGraph} begin={begin} finish={finish} cancel={cancel} locked={!graphItem||effectiveState(items,graphItem.id,'locked')} Icon={Icon}/></DockPanel>
    <footer className="statusbar"><span className="ready-dot"/>{status}<span className="menubar-spacer"/><span>{items.length} objects</span><span>960 × 600</span><span>Electron · Chromium</span></footer>
    {settings&&<div className="modal-backdrop" onClick={()=>setSettings(false)}><section role="dialog" aria-modal="true" aria-label="Interface settings" className="settings-dialog" onClick={e=>e.stopPropagation()}>
      <header><h2>Interface settings</h2><Button icon="close" title="Close settings" onClick={()=>setSettings(false)}/></header><p className="muted">Changes affect this prototype only.</p>
      <label>Interface scale <select aria-label="Interface scale" value={scale} onChange={e=>setScale(Number(e.target.value))}>{[80,90,100,110,125].map(v=><option key={v} value={v}>{v}%</option>)}</select></label>
      <label className="check"><input type="checkbox" checked={animations} onChange={()=>setAnimations(!animations)}/>Animate buttons and zones</label>
      <label className="check"><input type="checkbox" checked={grid} onChange={()=>setGrid(!grid)}/>Show canvas grid</label>
      <fieldset className="interaction-settings"><legend>Interaction zones</legend>{[
        ['base','Base radius / px',8,32,1],['expansion','Fast-motion expansion / px',0,64,1],['coefficient','Mouse speed coefficient',0,.2,.005],['influence','Distance influence / px',40,400,5],['shrink','Zone shrink / px/s',10,400,5],['graphZoneScale','Node port zone size / ×',1,6,.25]
      ].map(([key,label,min,max,step])=><label key={key}><span>{label}</span><input aria-label={label} type="range" min={min} max={max} step={step} value={interaction[key]} onChange={e=>setInteraction(s=>({...s,[key]:Number(e.target.value)}))}/><output>{interaction[key]}</output></label>)}</fieldset>
      <Button icon="reset" onClick={()=>{setScale(100);setAnimations(true);setGrid(true);setSwapped(false);setInteraction(interactionDefaults);workspace.current?.style.removeProperty('--sidebar-top');workspace.current?.style.removeProperty('--sidebar-width');workspace.current?.style.removeProperty('--content-height');}}>Reset workspace</Button>
      <p className="muted note">Corners: proportional · edges: one axis · Shift: toggle proportion · Alt: scale from center. Ring: rotate · Shift: 15° snap · Ctrl: precision. Esc: cancel. Drag panel tabs to swap; use dividers to resize.</p>
    </section></div>}
  </div></DockProvider>;
}
createRoot(document.getElementById('root')).render(<App/>);
