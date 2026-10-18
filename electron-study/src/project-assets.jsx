import React,{useState} from 'react';
export function ProjectAssets({assets,addToCanvas,exportLayer,canExport,Icon}){
  const [query,setQuery]=useState(''),[folder,setFolder]=useState('All'),[selected,setSelected]=useState('composition');
  return <section className="panel content-browser" aria-label="Project assets"><div className="project-asset-toolbar"><label className="search"><Icon name="search"/><input aria-label="Search assets" placeholder="Search project assets…" value={query} onChange={e=>setQuery(e.target.value)}/></label><button className="button" disabled={!canExport} onClick={exportLayer}><Icon name="image"/>Export layer to assets</button></div><div className="content-body"><aside className="folders">{['All','Compositions','Images'].map(f=><button key={f} className={folder===f?'chosen':''} onClick={()=>setFolder(f)}><Icon name="folder"/>{f==='All'?'Content':f}</button>)}</aside><div className="asset-grid">{assets.filter(a=>(folder==='All'||folder==='Compositions'&&a.kind==='Composition'||folder==='Images'&&a.kind==='Image')&&a.name.toLowerCase().includes(query.toLowerCase())).map(a=><button key={a.id} className={`asset ${selected===a.id?'selected':''}`} draggable={a.kind==='Image'} onDragStart={e=>e.dataTransfer.setData('application/x-mycut-asset',a.id)} onClick={()=>setSelected(a.id)} onDoubleClick={()=>a.kind==='Image'&&addToCanvas(a)} title={a.kind==='Image'?'Double-click or drag onto canvas':'Current composition'}><div className="thumbnail">{a.src?<img src={a.src} alt=""/>:<Icon name="image" size={30}/>}</div><span className="asset-name">{a.name}</span><span className="asset-kind">{a.kind}</span></button>)}</div></div></section>;
}

export async function layerPng(svg,ids,{inputOnly=false,opaqueLayer=false,outputFrom=null,world=null,waitForEffects=true,region=null}={}){
  if(waitForEffects){const started=performance.now();let settled=0;while(settled<2){await new Promise(requestAnimationFrame);if(svg.querySelector('[data-live-busy="true"]'))settled=0;else settled++;if(performance.now()-started>10000)throw Error('Effects are still rendering; try again shortly');}const error=svg.querySelector('[data-live-error]:not([data-live-error=""])');if(error)throw Error(error.getAttribute('data-live-error'));}
  const clone=svg.cloneNode(true);clone.querySelectorAll('[data-signal-ghost],[data-signal-frame-ghost]').forEach(n=>n.remove());for(const output of clone.querySelectorAll('[data-graph-prefix]'))output.querySelector('use')?.setAttribute('href','#'+output.dataset.graphPrefix+'-output');clone.setAttribute('xmlns','http://www.w3.org/2000/svg');clone.setAttribute('width','960');clone.setAttribute('height','600');
  for(const shape of clone.querySelectorAll('[data-document-stroke]')){shape.setAttribute('stroke-width',shape.dataset.documentStroke);if(shape.dataset.documentDash)shape.setAttribute('stroke-dasharray',shape.dataset.documentDash);}

  if(opaqueLayer)for(const node of clone.querySelectorAll('[data-object]'))node.setAttribute('opacity','1');
  if(outputFrom)for(const output of clone.querySelectorAll('[data-graph-output]'))if(ids.has(output.dataset.graphOutput))output.querySelector('use')?.setAttribute('href','#'+outputFrom);
  if(inputOnly||outputFrom){for(const output of clone.querySelectorAll('[data-graph-output]')){const use=output.querySelector('use'),href=use?.getAttribute('href');if(inputOnly&&href?.endsWith('-output'))use.setAttribute('href',href.slice(0,-7)+'-input');}for(const node of clone.querySelectorAll('[filter]'))if(node.getAttribute('filter').startsWith('url(#adjust-'))node.removeAttribute('filter');}
  // A standalone SVG image cannot access the document's @font-face. Bake only
  // text glyphs with the already-loaded browser font, retaining object transforms.
  await document.fonts.ready;
  for(const owner of clone.querySelectorAll('[data-object]')){
    const original=svg.querySelector(`[data-object="${CSS.escape(owner.dataset.object)}"]`),texts=[...(original?.querySelectorAll('text')??[])];
    for(const [index,text] of [...owner.querySelectorAll('text')].entries()){
      if(!texts[index])continue;
      // SVG getBBox varies with font hinting at viewport zoom. Measure glyphs
      // at their intrinsic font size so exported pixels never depend on zoom.
      const attr=(span,key,fallback)=>span.getAttribute(key)??text.getAttribute(key)??fallback,spans=[...text.querySelectorAll('tspan')],measure=document.createElement('canvas').getContext('2d');
      const configure=(ctx,span)=>{ctx.font=`${attr(span,'font-style','normal')} ${attr(span,'font-weight',600)} ${attr(span,'font-size',44)}px ${attr(span,'font-family','Roboto')}`;ctx.letterSpacing=`${attr(span,'letter-spacing',0)}px`;ctx.textAlign=attr(span,'text-anchor','start')==='middle'?'center':attr(span,'text-anchor','start')==='end'?'right':'left';ctx.fillStyle=attr(span,'fill','#fff');ctx.strokeStyle=attr(span,'stroke','#123541');ctx.lineJoin='round';};
      const boxes=spans.map(span=>{configure(measure,span);const m=measure.measureText(span.textContent),x=Number(span.getAttribute('x')),y=Number(span.getAttribute('y'));return {left:x-m.actualBoundingBoxLeft,right:x+m.actualBoundingBoxRight,top:y-m.actualBoundingBoxAscent,bottom:y+m.actualBoundingBoxDescent};});
      if(!boxes.length)continue;const box={x:Math.min(...boxes.map(b=>b.left)),y:Math.min(...boxes.map(b=>b.top))};box.width=Math.max(...boxes.map(b=>b.right))-box.x;box.height=Math.max(...boxes.map(b=>b.bottom))-box.y;if(!box.width||!box.height)continue;
      const matrix=texts[index].getCTM(),rootMatrix=svg.getCTM(),scale=Math.round(Math.hypot(matrix.a,matrix.b)/Math.hypot(rootMatrix.a,rootMatrix.b)*1e8)/1e8,stroke=span=>Number(span.dataset.documentStroke??text.dataset.documentStroke??0)/Math.max(.0001,scale),padding=2+Math.max(0,...spans.map(stroke))/2;
      const ratio=Math.min(2,4096/(box.width+padding*2),4096/(box.height+padding*2)),glyph=document.createElement('canvas');glyph.width=Math.ceil((box.width+padding*2)*ratio);glyph.height=Math.ceil((box.height+padding*2)*ratio);
      const ctx=glyph.getContext('2d');ctx.scale(ratio,ratio);ctx.translate(padding-box.x,padding-box.y);
      for(const span of spans){configure(ctx,span);const x=Number(span.getAttribute('x')),y=Number(span.getAttribute('y')),width=stroke(span);if(width>0){ctx.lineWidth=width;ctx.strokeText(span.textContent,x,y);}ctx.fillText(span.textContent,x,y);}
      const image=document.createElementNS('http://www.w3.org/2000/svg','image');for(const [key,value] of Object.entries({x:box.x-padding,y:box.y-padding,width:box.width+padding*2,height:box.height+padding*2,href:glyph.toDataURL('image/png')}))image.setAttribute(key,String(value));text.replaceWith(image);
    }
  }
  if(outputFrom&&world){
    // Graph sources can live inside a parent's SVG defs, without a standalone
    // object on the canvas. Keep those resources and evaluate the requested
    // branch in its owner's world frame instead of deleting its definition.
    const ns='http://www.w3.org/2000/svg',resources=document.createElementNS(ns,'defs');for(const defs of [...clone.querySelectorAll('defs')]){resources.append(...defs.childNodes);defs.remove();}clone.replaceChildren(resources);const group=document.createElementNS(ns,'g'),use=document.createElementNS(ns,'use');group.setAttribute('transform',`matrix(${world.join(' ')})`);use.setAttribute('href','#'+outputFrom);group.append(use);clone.append(group);
  }else{
    for(const node of [...clone.children])if(node.tagName.toLowerCase()!=='defs'&&!node.querySelector('[data-object]'))node.remove();
    for(const node of clone.querySelectorAll('[data-object]')){if(!ids.has(node.dataset.object))node.remove();else node.querySelectorAll('.selection,.selection-transition,[data-corner-handle]').forEach(n=>n.remove());}
  }
  if(region){clone.setAttribute('viewBox',`${region.x} ${region.y} ${region.width} ${region.height}`);const ratio=Math.min(1,4096/region.width,4096/region.height);clone.setAttribute('width',Math.ceil(region.width*ratio));clone.setAttribute('height',Math.ceil(region.height*ratio));}
  const src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(new XMLSerializer().serializeToString(clone)),image=new Image();image.src=src;await image.decode();
  const canvas=document.createElement('canvas');canvas.width=region?image.naturalWidth:960;canvas.height=region?image.naturalHeight:600;canvas.getContext('2d').drawImage(image,0,0);return canvas.toDataURL('image/png');
}
