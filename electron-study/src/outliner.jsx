import React,{useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {canModify,effectiveState,moveLayers,rangeSelection,treeRows} from './hierarchy.mjs';
import {menuSections} from './menu-model.mjs';
import {labelGesture} from './click-gesture.mjs';
import {effectPresets} from './object-effects.mjs';
import {commandSpecs,commandForKey} from './editor-commands.mjs';

function Submenu({action,anchor,keyboard,Icon,close,menuRef}){
  const ref=useRef();
  useEffect(()=>{
    const menu=ref.current,r=menu.getBoundingClientRect(),a=anchor.getBoundingClientRect();
    menu.style.left=`${a.right+r.width+2<innerWidth?a.right+2:Math.max(4,a.left-r.width-2)}px`;
    menu.style.top=`${Math.max(4,Math.min(a.top,innerHeight-r.height-4))}px`;
    if(keyboard)menu.querySelector('button:not(:disabled)')?.focus();
  },[action,anchor,keyboard]);
  return <div ref={el=>{ref.current=el;menuRef.current=el;}} role="menu" aria-label={`${action.label} actions`} className="context-menu context-submenu" onContextMenu={e=>e.preventDefault()}>
    {action.children.map(child=><button role="menuitem" aria-label={child.label} key={child.label} disabled={!child.enabled} onClick={()=>{close();child.run();}}><span className="context-icon"><Icon name={child.icon}/></span><span>{child.label}</span>{child.shortcut&&<kbd>{child.shortcut}</kbd>}</button>)}
  </div>;
}

// A menu shared by every Outliner context; unavailable actions remain visible.
function ContextMenu({context,actions,close,Icon,commands}){
  const ref=useRef();
  const [opened,setOpened]=useState(null),submenu=useRef();
  const sections=menuSections(actions,{creationContext:context.ids.length===0});
  useEffect(()=>{
    const menu=ref.current,rect=menu.getBoundingClientRect();
    menu.style.left=`${Math.max(4,Math.min(context.x,window.innerWidth-rect.width-4))}px`;
    menu.style.top=`${Math.max(4,Math.min(context.y,window.innerHeight-rect.height-4))}px`;
    menu.querySelector('button:not(:disabled)')?.focus();
    const outside=e=>{if(!menu.contains(e.target))close();};
    window.addEventListener('pointerdown',outside,true);window.addEventListener('resize',close);
    return()=>{window.removeEventListener('pointerdown',outside,true);window.removeEventListener('resize',close);};
  },[]);
  function keys(e){
    const activeMenu=e.target.closest('[role=menu]')||ref.current;
    const buttons=[...activeMenu.querySelectorAll('button:not(:disabled)')].filter(button=>button.closest('[role=menu]')===activeMenu);
    const command=commandForKey(e),shortcut=actions.flatMap(action=>action.children||[action]).find(action=>(command?action.commandId===command:action.shortcut===e.key)&&action.enabled);
    if(shortcut){e.preventDefault();e.stopPropagation();close();shortcut.run();return;}
    if(command){e.preventDefault();e.stopPropagation();close();if(commands.can(command,context.ids))commands.run(command,context.ids);return;}
    if((e.key==='ArrowLeft'||e.key==='Escape')&&activeMenu===submenu.current){e.preventDefault();e.stopPropagation();opened?.anchor.focus();setOpened(null);return;}
    if(e.key==='ArrowRight'){
      const action=actions.find(action=>action.label===document.activeElement.getAttribute('aria-label')&&action.children&&action.enabled);
      if(action){e.preventDefault();setOpened({action,anchor:document.activeElement,keyboard:true});}return;
    }
    if(e.key==='Escape'||e.key==='Tab'){e.preventDefault();e.stopPropagation();close();return;}
    if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){
      e.preventDefault();const index=buttons.indexOf(document.activeElement);
      buttons[e.key==='Home'?0:e.key==='End'?buttons.length-1:(index+(e.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length]?.focus();
    }
  }
  return createPortal(<div ref={ref} role="menu" aria-label="Outliner actions" className="context-menu" style={{left:context.x,top:context.y}} onKeyDown={keys} onContextMenu={e=>e.preventDefault()}>
    {sections.map(section=><div role="group" aria-label={section.label} className="context-section" key={section.id}>
      <div className="context-section-title" aria-hidden="true"><span>{section.label}</span><span className="context-section-rule"/></div>
      {section.actions.map(action=><button role="menuitem" aria-label={action.label} aria-haspopup={action.children?'menu':undefined} aria-expanded={action.children?opened?.action===action:undefined} key={action.label} disabled={!action.enabled} className={action.danger?'danger':''} title={action.enabled?'':action.reason||''}
        onPointerEnter={e=>setOpened(action.children&&action.enabled?{action,anchor:e.currentTarget,keyboard:false}:null)}
        onClick={e=>{if(action.children){setOpened({action,anchor:e.currentTarget,keyboard:true});return;}close();action.run();}}><span className="context-icon"><Icon name={action.icon}/></span><span>{action.label}</span>{action.children?<span className="submenu-arrow"><Icon name="chevron" size={12}/></span>:action.shortcut&&<kbd>{action.shortcut}</kbd>}</button>)}
    </div>)}
    {opened&&<Submenu {...opened} Icon={Icon} close={close} menuRef={submenu}/>}
  </div>,document.body);
}

function InlineRename({name,commit,cancel}){
  const [draft,setDraft]=useState(name),input=useRef(),done=useRef(false),composing=useRef(false);
  useEffect(()=>{input.current.focus();input.current.select();},[]);
  function finish(apply,restore=false){if(done.current)return;done.current=true;if(apply&&draft.trim())commit(draft.trim(),restore);else cancel(restore);}
  return <input ref={input} className="inline-rename" aria-label="Rename object inline" aria-invalid={!draft.trim()} title={draft.trim()?'Enter: apply · Escape: cancel':'Name cannot be empty'} maxLength={100} value={draft}
    onChange={e=>setDraft(e.target.value)} onPointerDown={e=>e.stopPropagation()} onClick={e=>e.stopPropagation()} onContextMenu={e=>e.stopPropagation()}
    onCompositionStart={()=>{composing.current=true;}} onCompositionEnd={()=>{composing.current=false;}}
    onKeyDown={e=>{e.stopPropagation();if(composing.current||e.nativeEvent.isComposing)return;if(e.key==='Enter'){e.preventDefault();if(draft.trim())finish(true,true);}else if(e.key==='Escape'){e.preventDefault();finish(false,true);}}}
    onBlur={()=>finish(true)}/>;
}

export function Outliner({items,selectedIds,selectMany,toggle,global,setGlobal,reorder,action,commands,Icon,Button}){
  const [query,setQuery]=useState(''),[sort,setSort]=useState(null),[open,setOpen]=useState(true),[collapsed,setCollapsed]=useState(new Set());
  const [dragging,setDragging]=useState(null),[drop,setDrop]=useState(null),[context,setContext]=useState(null),dragSource=useRef(null),anchor=useRef(null);
  const [editing,setEditing]=useState(null),tree=useRef();
  const lastLabelClick=useRef(null),pendingRename=useRef(null);
  function cancelPendingRename(){if(pendingRename.current)clearTimeout(pendingRename.current.timer);pendingRename.current=null;}
  const rows=treeRows(items,query,sort,collapsed),canReorder=!query.trim()&&!sort,layerType='application/x-mycut-layer';
  const parentIds=new Set(items.filter(n=>n.parentId).map(n=>n.parentId));
  const expandable=item=>item.kind==='Folder'||parentIds.has(item.id);
  const clearDrag=()=>{dragSource.current=null;setDragging(null);setDrop(null);};
  useEffect(()=>{if(selectedIds.length===1)anchor.current=selectedIds[0];},[selectedIds]);
  useEffect(()=>{if(pendingRename.current&&(selectedIds.length!==1||selectedIds[0]!==pendingRename.current.id))cancelPendingRename();},[selectedIds]);
  useEffect(()=>{
    const cancel=()=>cancelPendingRename();
    window.addEventListener('pointerdown',cancel,true);window.addEventListener('blur',cancel);
    return()=>{cancel();window.removeEventListener('pointerdown',cancel,true);window.removeEventListener('blur',cancel);};
  },[]);
  useEffect(()=>{const escape=e=>{if(e.key==='Escape'){cancelPendingRename();clearDrag();setContext(null);}};window.addEventListener('keydown',escape);return()=>window.removeEventListener('keydown',escape);},[]);
  useEffect(()=>{cancelPendingRename();},[items,query,sort,collapsed]);
  useEffect(()=>{if(!canReorder)clearDrag();},[canReorder]);
  useEffect(()=>{if(editing&&(!items.some(n=>n.id===editing.id)||!canModify(items,[editing.id])||!rows.some(n=>n.id===editing.id)))setEditing(null);},[items,query,sort,collapsed,editing]);
  function startRename(id){cancelPendingRename();lastLabelClick.current=null;const item=items.find(n=>n.id===id);if(!item||!canModify(items,[id])||!rows.some(n=>n.id===id))return;clearDrag();setContext(null);setEditing({id,name:item.name});}
  function endRename(name,restore=false){
    const id=editing.id;setEditing(null);if(name!==undefined)action('rename',{ids:[id],name});
    if(restore)requestAnimationFrame(()=>tree.current?.querySelector(`[data-layer-id="${CSS.escape(id)}"] .tree-label`)?.focus({preventScroll:true}));
  }
  function choose(e,id){
    if(e.shiftKey){selectMany(rangeSelection(rows,anchor.current||selectedIds[0],id),id);return;}
    if(e.ctrlKey||e.metaKey){const ids=selectedIds.includes(id)?selectedIds.filter(n=>n!==id):[...selectedIds,id];selectMany(ids,ids.includes(id)?id:ids.at(-1));}
    else selectMany([id],id);
    anchor.current=id;
  }
  function toggleFolder(id){setCollapsed(old=>{const next=new Set(old);next.has(id)?next.delete(id):next.add(id);return next;});}
  function labelClick(e,item){
    const current={id:item.id,time:performance.now(),x:e.clientX,y:e.clientY,detail:e.detail,folder:expandable(item),selected:selectedIds.length===1&&selectedIds[0]===item.id,modified:e.shiftKey||e.ctrlKey||e.metaKey||e.altKey};
    const gesture=labelGesture(lastLabelClick.current,current);lastLabelClick.current=current;
    if(gesture==='rename'){
      // Defer the candidate: the next native click may still complete a fast
      // double-click. Any pointer down cancels this pending rename first.
      pendingRename.current={id:item.id,timer:setTimeout(()=>{pendingRename.current=null;startRename(item.id);},500)};
      return;
    }
    choose(e,item.id);if(gesture==='toggle'){lastLabelClick.current=null;toggleFolder(item.id);}
  }
  function menu(e,id=null,parent=false){
    lastLabelClick.current=null;
    e.preventDefault();e.stopPropagation();
    const ids=id?(selectedIds.includes(id)?selectedIds:[id]):[];
    if(id&&!selectedIds.includes(id))selectMany(ids,id);
    const item=items.find(n=>n.id===id);
    const parentId=parent?null:item?.id??null;
    setContext({x:e.clientX,y:e.clientY,ids,parentId,caption:parent?'Composition':item?.name||'Empty space'});
  }
  function dragStart(e,id){
    lastLabelClick.current=null;
    const ids=selectedIds.includes(id)?selectedIds:[id];
    if(!canReorder||e.target.closest('.eye,.folder-toggle,.inline-rename')||!canModify(items,ids)){e.preventDefault();e.stopPropagation();return;}
    e.stopPropagation();setContext(null);if(!selectedIds.includes(id))selectMany(ids,id);
    dragSource.current={id,ids};setDragging(id);e.dataTransfer.effectAllowed='move';e.dataTransfer.setData(layerType,id);
  }
  // Center = child; top/bottom quarters = sibling insertion, for every type.
  function insertion(e,item){const r=e.currentTarget.getBoundingClientRect(),fraction=(e.clientY-r.top)/r.height;return fraction>=.25&&fraction<=.75?'inside':fraction<.5?'before':'after';}
  function dragOver(e,item){
    if(!canReorder||!dragSource.current||!e.dataTransfer.types.includes(layerType))return;
    e.preventDefault();e.stopPropagation();const side=insertion(e,item),allowed=moveLayers(items,dragSource.current.ids,item.id,side)!==items;
    e.dataTransfer.dropEffect=allowed?'move':'none';setDrop(allowed?{id:item.id,side}:null);
    const scroll=e.currentTarget.closest('.tree-scroll'),r=scroll.getBoundingClientRect();if(e.clientY<r.top+24)scroll.scrollBy(0,-10);else if(e.clientY>r.bottom-24)scroll.scrollBy(0,10);
  }
  function dropLayer(e,item){
    if(!e.dataTransfer.types.includes(layerType))return;e.preventDefault();e.stopPropagation();
    const source=dragSource.current;
    if(canReorder&&source&&e.dataTransfer.getData(layerType)===source.id){
      const side=insertion(e,item);reorder(source.ids,item.id,side);
      if(side==='inside')setCollapsed(old=>{const next=new Set(old);next.delete(item.id);return next;});
    }
    clearDrag();
  }
  function sortBy(key){setSort(s=>({key,direction:s?.key===key?-s.direction:1}));}
  function createFolder(kind){
    cancelPendingRename();lastLabelClick.current=null;
    const node=action(kind,context);if(!node)return;
    setQuery('');setSort(null);setOpen(true);
    setCollapsed(old=>{const next=new Set(old);let parent=node.parentId;const seen=new Set();while(parent&&!seen.has(parent)){seen.add(parent);next.delete(parent);parent=items.find(n=>n.id===parent)?.parentId;}return next;});
    setEditing({id:node.id,name:node.name});
    requestAnimationFrame(()=>tree.current?.querySelector(`[data-layer-id="${CSS.escape(node.id)}"]`)?.scrollIntoView({block:'nearest'}));
  }
  const mutable=context&&canModify(items,context.ids),single=context?.ids.length===1;
  const createAllowed=context&&(!context.parentId||!effectiveState(items,context.parentId,'locked'));
  const editCommands=context?commandSpecs.filter(c=>['cut','copy','paste','duplicate'].includes(c.id)).map(c=>({...c,commandId:c.id,enabled:commands.can(c.id,context.ids),run:()=>commands.run(c.id,context.ids)})):[];
  const actions=context?[
    {label:'Edit',group:'object',priority:10,icon:'edit',enabled:single&&mutable||editCommands.some(c=>c.enabled),reason:'Select objects or copy objects first',children:[
      {label:'Edit properties',icon:'settings',enabled:single&&mutable,run:()=>action('edit',context)},
      ...editCommands,
      {label:'Rename',icon:'edit',shortcut:'F2',enabled:single&&mutable,run:()=>startRename(context.ids[0])},
    ]},
    {label:'Effects',group:'object',priority:20,icon:'settings',enabled:single&&mutable,children:[...effectPresets.map(p=>({label:p.name,icon:'settings',enabled:single&&mutable,run:()=>action('effect:'+p.id,context)})),{label:'Add attachment to parent',icon:'layerAdd',enabled:single&&mutable&&!!items.find(n=>n.id===context.ids[0])?.parentId&&!effectiveState(items,items.find(n=>n.id===context.ids[0])?.parentId,'locked'),run:()=>action('attachToParent',context)}]},
    {label:'Delete',commandId:'delete',shortcut:'Delete',group:'manage',priority:90,icon:'delete',danger:true,enabled:mutable,reason:'Locked objects or their folders cannot be deleted',run:()=>action('delete',context)},
    {label:'Move to new folder',group:'hierarchy',priority:10,icon:'move',enabled:mutable,reason:'Select unlocked objects',run:()=>createFolder('group')},
    {label:'Move to new layer',group:'hierarchy',priority:20,icon:'layerAdd',enabled:mutable,reason:'Select unlocked objects',run:()=>createFolder('groupLayer')},
    {label:'Create folder',group:'create',priority:20,icon:'folderAdd',enabled:createAllowed,run:()=>createFolder('folder')},
    {label:'Create new layer',group:'create',priority:10,icon:'layerAdd',enabled:createAllowed,run:()=>action('layer',context)},
  ]:[];
  return <><div className="outliner-tools"><div className="segmented"><button className={!global?'chosen':''} onClick={()=>setGlobal(false)}>Local · Layers</button><button className={global?'chosen':''} onClick={()=>setGlobal(true)}>Global</button></div></div>
    <label className="search"><Icon name="search"/><input aria-label="Search objects" placeholder="Search…" value={query} onChange={e=>setQuery(e.target.value)}/>{query&&<Button icon="close" title="Clear object search" onClick={()=>setQuery('')}/>}</label>
    {!canReorder&&<div className="reorder-notice"><span>{sort?'Sorted view':'Filtered view'} · drag disabled</span><button onClick={()=>{setQuery('');setSort(null);}}>Layer order</button></div>}
    <div className="tree-head"><span><Icon name="eye" size={14}/></span><button onClick={()=>sortBy('name')}>Item Label {sort?.key==='name'&&(sort.direction===1?'↑':'↓')}</button><button onClick={()=>sortBy('kind')}>Type {sort?.key==='kind'&&(sort.direction===1?'↑':'↓')}</button></div>
    <div ref={tree} className="tree-scroll" role="tree" aria-label="Scene objects" aria-multiselectable="true" onContextMenu={e=>menu(e)} onKeyDown={e=>{if(e.key==='F2'&&selectedIds.length===1){e.preventDefault();e.stopPropagation();startRename(selectedIds[0]);}}}>
      {global&&<div className="tree-context" onContextMenu={e=>menu(e,null,true)}><Icon name="folder"/> Project / UI exploration</div>}
      <button className="tree-root" onClick={()=>setOpen(!open)} onContextMenu={e=>menu(e,null,true)} aria-expanded={open||!!query}><span className={`disclosure ${open||query?'expanded':''}`}><Icon name="chevron" size={12}/></span><Icon name="cube"/>Untitled <span className="muted">(Editor)</span></button>
      {(open||query)&&rows.map(item=>{const locked=effectiveState(items,item.id,'locked'),isSelected=selectedIds.includes(item.id),movable=canReorder&&editing?.id!==item.id&&canModify(items,isSelected?selectedIds:[item.id]);return <div key={item.id} data-layer-id={item.id} draggable={movable} onDragStart={e=>dragStart(e,item.id)} onDragOver={e=>dragOver(e,item)} onDrop={e=>dropLayer(e,item)} onDragEnd={clearDrag} onContextMenu={e=>menu(e,item.id)} onDragLeave={e=>{if(!e.currentTarget.contains(e.relatedTarget))setDrop(null);}} title={locked?'Locked object':canReorder?'Drag to center: make child; top/bottom: reorder':'Return to Layer order to drag'} className={`tree-row ${isSelected?'selected':''} ${!effectiveState(items,item.id,'visible')?'invisible':''} ${dragging===item.id?'dragging':''} ${drop?.id===item.id?'drop-'+drop.side:''}`} role="treeitem" aria-selected={isSelected} aria-level={item.depth+1} aria-expanded={expandable(item)?!collapsed.has(item.id):undefined}>
        <button className="eye" aria-label={`${item.visible?'Hide':'Show'} ${item.name}`} onClick={()=>toggle(item.id)}><Icon name={item.visible?'eye':'hidden'} size={14}/></button>
        <div className="tree-label-cell" style={{paddingLeft:6+item.depth*14}}>{expandable(item)?<button className="folder-toggle" aria-label={`Toggle ${item.name}`} onClick={()=>{lastLabelClick.current=null;toggleFolder(item.id);}}><span className={`disclosure ${collapsed.has(item.id)?'':'expanded'}`}><Icon name="chevron" size={10}/></span></button>:<span className="tree-indent"/>}
        {editing?.id===item.id?<><Icon name={item.kind==='Folder'?'folder':item.kind==='Text'?'text':item.kind==='Shape'?'cube':'image'}/><InlineRename name={editing.name} commit={endRename} cancel={restore=>endRename(undefined,restore)}/></>:<button className="tree-label" onClick={e=>labelClick(e,item)}><Icon name={item.kind==='Folder'?'folder':item.kind==='Text'?'text':item.kind==='Shape'?'cube':'image'}/><span>{item.name}</span>{locked&&<Icon name="lock" size={12}/>}</button>}</div>
        <button className="tree-kind" onClick={e=>choose(e,item.id)}>{item.kind}</button></div>;})}
      {!rows.length&&<p className="empty">No matching objects</p>}
    </div><footer className="panel-footer">{rows.length} of {items.length} objects <span>·</span> {selectedIds.length} selected</footer>
    {context&&<ContextMenu context={context} actions={actions} close={()=>setContext(null)} Icon={Icon} commands={commands}/>}
  </>;
}
