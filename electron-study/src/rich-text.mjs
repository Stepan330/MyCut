// Character offsets are UTF-16, matching DOM ranges and persisted JS strings.
export const inlineTextKeys=['fontFamily','fontSize','fontWeight','fontStyle','color','stroke','strokeWidth','letterSpacing'];
export const textDefaults={fontFamily:'Roboto',fontSize:44,fontWeight:'600',fontStyle:'normal',color:'#d6f2f4',stroke:'#123541',strokeWidth:0,letterSpacing:0};
export function textStyle(item,offset=0){
  const style={...textDefaults};for(const key of inlineTextKeys)if(item[key]!==undefined)style[key]=item[key];
  for(const run of item.textRuns??[])if(offset>=run.start&&offset<run.end)Object.assign(style,run.style);
  return style;
}
export function textFragments(item,start=0,end=(item.text??'').length){
  const cuts=[...new Set([start,end,...(item.textRuns??[]).flatMap(r=>[r.start,r.end]).filter(n=>n>start&&n<end)])].sort((a,b)=>a-b);
  return cuts.slice(0,-1).map((n,i)=>({start:n,end:cuts[i+1],text:item.text.slice(n,cuts[i+1]),style:textStyle(item,n)}));
}
function merge(runs){
  const result=[];for(const run of runs){if(run.end<=run.start||!Object.keys(run.style).length)continue;const last=result.at(-1);if(last?.end===run.start&&JSON.stringify(last.style)===JSON.stringify(run.style))last.end=run.end;else result.push({...run,style:{...run.style}});}return result;
}
export function formatTextRange(item,start,end,patch){
  start=Math.max(0,Math.min(item.text.length,start));end=Math.max(start,Math.min(item.text.length,end));
  const cuts=[...new Set([0,item.text.length,start,end,...(item.textRuns??[]).flatMap(r=>[r.start,r.end])])].sort((a,b)=>a-b);
  const runs=cuts.slice(0,-1).map((n,i)=>{const style={...(item.textRuns??[]).find(r=>n>=r.start&&n<r.end)?.style};if(n>=start&&n<end)Object.assign(style,patch);return {start:n,end:cuts[i+1],style};});
  return merge(runs);
}
export function clearTextOverrides(item,keys){
  return merge((item.textRuns??[]).map(r=>({...r,style:Object.fromEntries(Object.entries(r.style).filter(([key])=>!keys.includes(key)))})));
}
export function replaceText(item,next){
  const previous=item.text??'';let start=0;while(start<previous.length&&start<next.length&&previous[start]===next[start])start++;
  let oldEnd=previous.length,newEnd=next.length;while(oldEnd>start&&newEnd>start&&previous[oldEnd-1]===next[newEnd-1]){oldEnd--;newEnd--;}
  const delta=newEnd-oldEnd,runs=[];
  for(const r of item.textRuns??[]){if(r.start<start)runs.push({...r,end:Math.min(r.end,start)});if(r.end>oldEnd)runs.push({...r,start:Math.max(r.start,oldEnd)+delta,end:r.end+delta});}
  const inherit=(item.textRuns??[]).find(r=>start>r.start&&start<=r.end)??(item.textRuns??[]).find(r=>start>=r.start&&start<r.end);
  if(newEnd>start&&inherit)runs.push({start,end:newEnd,style:inherit.style});
  return {text:next,textRuns:merge(runs.sort((a,b)=>a.start-b.start))};
}
export const textFont=s=>`${s.fontStyle} ${s.fontWeight} ${s.fontSize}px ${s.fontFamily}`;
export function layoutText(item,ctx){
  const text=item.text??'',fragments=textFragments({...item,text}),lines=[],limit=item.textType==='Paragraph'?Math.max(1,(item.width??320)-16):Infinity;
  let line={parts:[],width:0,size:item.fontSize??44,height:(item.fontSize??44)*(item.lineHeight??1.25)},offset=0;
  const push=()=>{lines.push(line);line={parts:[],width:0,size:item.fontSize??44,height:(item.fontSize??44)*(item.lineHeight??1.25)};};
  for(const fragment of fragments)for(const char of fragment.text){
    const style=fragment.style;ctx.font=textFont(style);const width=ctx.measureText(char).width+style.letterSpacing;
    if(char==='\n'){push();offset+=char.length;continue;}if(line.parts.length&&line.width+width>limit)push();
    let part=line.parts.at(-1);if(!part||part.end!==offset||JSON.stringify(part.style)!==JSON.stringify(style)){part={text:'',start:offset,end:offset,x:line.width,style};line.parts.push(part);}
    part.text+=char;offset+=char.length;part.end=offset;line.width+=width;line.size=Math.max(line.size,style.fontSize);line.height=Math.max(line.height,style.fontSize*(item.lineHeight??1.25));
  }
  push();let top=0;const width=item.textType==='Paragraph'?item.width??320:Math.ceil(Math.max(80,...lines.map(l=>l.width+16)));
  const parts=[];for(const l of lines){const x=item.textAlign==='center'?(width-l.width)/2:item.textAlign==='right'?width-l.width:0;for(const p of l.parts)parts.push({...p,x:p.x+x,y:top+l.size});top+=l.height;}
  return {parts,width,height:Math.ceil(Math.max((item.fontSize??44)*1.4,top+12))};
}
