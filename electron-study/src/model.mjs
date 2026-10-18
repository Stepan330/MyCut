export function initialScene() {
  return [
    { id: 'title', name: 'Title', kind: 'Text', x: 78, y: 62, sx: 1, sy: 1, rotation: 0, opacity: 1, visible: true, locked: false, text: 'MyCut\nCreate. Shape. Color.' },
    { id: 'card', name: 'Studio image', kind: 'Image', x: 120, y: 238, sx: 1, sy: 1, rotation: -8, opacity: 1, visible: true, locked: false },
    { id: 'ellipse', name: 'Ellipse', kind: 'Shape', x: 730, y: 338, sx: 1, sy: 1, rotation: 0, opacity: 1, visible: true, locked: false },
    { id: 'background', name: 'Background', kind: 'Background', x: 0, y: 0, sx: 1, sy: 1, rotation: 0, opacity: 1, visible: true, locked: true },
  ];
}
export function updateItem(scene, id, patch) {
  const numeric = ['x', 'y', 'sx', 'sy', 'rotation', 'opacity','width','height','fontSize','brushSize','strokeWidth','cornerRadius','sides','innerRadius','lineWidth','arrowHead','heartBulge','tailX','tailY','lineHeight','letterSpacing','brightness','contrast','saturation'];
  for (const key of numeric) if (key in patch && !Number.isFinite(patch[key])) return scene;
  for(const key of ['width','height','fontSize','brushSize'])if(key in patch&&patch[key]<=0)return scene;
  return scene.map(item => item.id === id ? { ...item, ...patch, ...('opacity' in patch ? { opacity: Math.max(0, Math.min(1, patch.opacity)) } : {}) } : item);
}
export function filteredItems(scene, query, sort = null) {
  const q = query.trim().toLowerCase();
  const result = scene.filter(item => `${item.name} ${item.kind}`.toLowerCase().includes(q));
  if (sort) result.sort((a, b) => (a[sort.key].localeCompare(b[sort.key]) || a.id.localeCompare(b.id)) * sort.direction);
  return result;
}
export {bounds} from './scene-transform.mjs';
import {moveLayers} from './hierarchy.mjs';
// The scene array is the stacking order, topmost first. IDs and item objects
// remain unchanged; rejected/no-op drops must not create Undo transactions.
export function moveLayer(scene, sourceId, targetId, side) {
  return moveLayers(scene,[sourceId],targetId,side);
}
export function resetTransform(scene, id) {
  return updateItem(scene, id, { x: 0, y: 0, sx: 1, sy: 1, rotation: 0 });
}
export function transaction(history, before, after) {
  if (JSON.stringify(before) === JSON.stringify(after)) return history;
  return { past: [...history.past.slice(-49), structuredClone(before)], future: [] };
}
