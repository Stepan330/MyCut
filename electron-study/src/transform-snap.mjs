export const snapActive=(settings,kind,ctrl=false)=>!!settings?.[kind+'Snap']||!!ctrl;
export const snapValue=(value,step)=>Number((Math.round(value/step)*step).toFixed(8));
export function snapMove(point,settings={},ctrl=false){const step=settings.moveStep??10;return snapActive(settings,'move',ctrl)?{x:snapValue(point.x,step),y:snapValue(point.y,step)}:point;}
export function snapRotation(angle,settings={},ctrl=false){return snapActive(settings,'rotate',ctrl)?snapValue(angle,settings.rotateStep??15):angle;}
