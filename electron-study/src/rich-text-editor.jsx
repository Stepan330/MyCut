import React,{useEffect,useLayoutEffect,useRef} from 'react';
import {textFragments,replaceText} from './rich-text.mjs';
export function readTextSelection(host){
  const selection=window.getSelection();if(!selection?.rangeCount||!host.contains(selection.anchorNode)||!host.contains(selection.focusNode))return null;
  const range=selection.getRangeAt(0),before=range.cloneRange();before.selectNodeContents(host);before.setEnd(range.startContainer,range.startOffset);
  return {start:before.toString().length,end:before.toString().length+range.toString().length};
}
export function textRange(host,start,end){
  const walker=document.createTreeWalker(host,NodeFilter.SHOW_TEXT),range=document.createRange();let node,offset=0,first=null,last=null;
  while(node=walker.nextNode()){const length=node.textContent.length;if(!first&&start<=offset+length)first={node,offset:Math.max(0,start-offset)};if(end<=offset+length){last={node,offset:Math.max(0,end-offset)};break;}offset+=length;}
  if(!first)return null;last??=first;range.setStart(first.node,first.offset);range.setEnd(last.node,last.offset);return range;
}
export function RichTextEditor({item,onChange,onSelection,begin,finish,end}){
  const host=useRef(),range=useRef({start:0,end:(item.text??'').length}),cfg=useRef(),composing=useRef(false);cfg.current={item,onChange,onSelection,begin,finish,end};
  function highlight(){
    if(!globalThis.CSS?.highlights)return;CSS.highlights.delete('mycut-text-selection');
    if(document.activeElement===host.current||range.current.start===range.current.end)return;
    const selected=textRange(host.current,range.current.start,range.current.end);if(selected)CSS.highlights.set('mycut-text-selection',new Highlight(selected));
  }
  function remember(){const selected=readTextSelection(host.current);if(selected){range.current=selected;cfg.current.onSelection({id:cfg.current.item.id,...selected});}return selected;}
  useLayoutEffect(()=>{
    if(composing.current)return;
    const node=host.current,focused=document.activeElement===node,selected=readTextSelection(node)??range.current;
    node.replaceChildren(...textFragments(item).map(fragment=>{const span=document.createElement('span'),s=fragment.style;span.textContent=fragment.text;Object.assign(span.style,{fontFamily:s.fontFamily,fontSize:s.fontSize+'px',fontWeight:s.fontWeight,fontStyle:s.fontStyle,color:s.color,letterSpacing:s.letterSpacing+'px',WebkitTextStroke:s.strokeWidth+'px '+s.stroke,paintOrder:'stroke fill'});return span;}));
    range.current={start:Math.min(selected.start,item.text.length),end:Math.min(selected.end,item.text.length)};
    if(focused){const selectedRange=textRange(node,range.current.start,range.current.end);if(selectedRange){const selection=window.getSelection();selection.removeAllRanges();selection.addRange(selectedRange);}}
    highlight();
  },[item.text,item.textRuns,item.fontFamily,item.fontSize,item.fontWeight,item.fontStyle,item.color,item.stroke,item.strokeWidth,item.letterSpacing]);
  useEffect(()=>{
    const node=host.current;node.focus({preventScroll:true});const selected=textRange(node,0,(cfg.current.item.text??'').length);if(selected){const selection=window.getSelection();selection.removeAllRanges();selection.addRange(selected);}remember();
    const change=()=>{if(document.activeElement===node)remember();};
    const outside=e=>{const target=e.target;if(node.contains(target)||target.closest('.tool-parameters,.dock-tool-settings')||target.closest('[data-dock-group]')?.querySelector('[data-dock-panel="tool-settings"]'))return;cfg.current.end(false);};
    document.addEventListener('selectionchange',change);document.addEventListener('pointerdown',outside,true);
    return()=>{document.removeEventListener('selectionchange',change);document.removeEventListener('pointerdown',outside,true);CSS.highlights?.delete('mycut-text-selection');};
  },[]);
  function changed(){remember();const current=cfg.current;current.onChange(replaceText(current.item,(host.current.innerText??'').replace(/\r/g,'')));}
  return <div ref={host} className="canvas-text-editor" contentEditable suppressContentEditableWarning role="textbox" aria-label="Canvas text editor" aria-multiline="true" spellCheck={false} style={{fontFamily:item.fontFamily??'Roboto',fontSize:item.fontSize??44,lineHeight:item.lineHeight??1.25,textAlign:item.textAlign??'left',whiteSpace:item.textType==='Paragraph'?'pre-wrap':'pre',overflowWrap:item.textType==='Paragraph'?'anywhere':'normal'}} onPointerDown={e=>e.stopPropagation()} onContextMenu={()=>remember()} onSelect={remember} onKeyUp={remember} onPointerUp={remember} onFocus={()=>{cfg.current.begin();CSS.highlights?.delete('mycut-text-selection');}} onBlur={()=>{remember();cfg.current.finish();highlight();}} onInput={changed} onCompositionStart={()=>{composing.current=true;}} onCompositionEnd={()=>{composing.current=false;changed();}} onPaste={e=>{e.preventDefault();document.execCommand('insertText',false,e.clipboardData.getData('text/plain'));}} onKeyDown={e=>{e.stopPropagation();if(e.key==='Escape'){e.preventDefault();cfg.current.end(true);}else if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)){e.preventDefault();cfg.current.end(false);}else if(e.key==='Enter'){e.preventDefault();document.execCommand('insertText',false,'\n');}}}/>;
}
