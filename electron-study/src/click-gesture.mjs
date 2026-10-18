// Native fast double-click wins. Rename requires a deliberate second single
// click on an already selected label, not a timer that fires after one click.
export function labelGesture(previous,current){
  if(current.modified||current.detail===0)return 'select';
  if(current.detail===2)return current.folder?'toggle':'select';
  const elapsed=previous?current.time-previous.time:0;
  if(current.detail===1&&current.selected&&previous?.id===current.id&&elapsed>=500&&elapsed<=1800&&Math.hypot(current.x-previous.x,current.y-previous.y)<=5)return 'rename';
  return 'select';
}
