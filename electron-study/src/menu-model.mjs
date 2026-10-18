// Importance belongs to the action descriptor, not to incidental render order.
const groups={object:{label:'Object',priority:10},hierarchy:{label:'Hierarchy',priority:20},create:{label:'Create',priority:30},manage:{label:'Manage',priority:90}};
export function menuSections(actions,{creationContext=false}={}){
  return Object.entries(groups).map(([id,group])=>({id,label:group.label,priority:creationContext&&id==='create'?0:group.priority,
    actions:actions.filter(action=>action.group===id).toSorted((a,b)=>(a.priority??50)-(b.priority??50)),
  })).filter(group=>group.actions.length).toSorted((a,b)=>a.priority-b.priority);
}
