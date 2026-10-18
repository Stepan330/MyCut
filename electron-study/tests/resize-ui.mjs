import {_electron as electron} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(fileURLToPath(new URL('../',import.meta.url)));
const results=process.env.MYCUT_UI_RESULTS||path.join(root,'test-results/smart-resize');await mkdir(results,{recursive:true});
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
const app=await electron.launch({args:[root],env});const page=await app.firstWindow(),errors=[];page.on('pageerror',e=>errors.push(e.message));
const settle=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
const transform=()=>page.locator('[data-object="card"]').getAttribute('transform');
const value=async name=>Number(await page.getByLabel(name,{exact:true}).inputValue());
const point=(x,y)=>page.locator('[data-object="card"]').evaluate((el,[x,y])=>{const p=new DOMPoint(x,y).matrixTransform(el.getScreenCTM());return {x:p.x,y:p.y};},[x,y]);
const close=(a,b)=>assert.ok(Math.hypot(a.x-b.x,a.y-b.y)<1,`anchor moved ${JSON.stringify({a,b})}`);
async function startHandle(index,offset=0){await settle();const r=await page.locator(`[data-handle="${index}"]`).boundingBox();assert.ok(r);const p={x:r.x+r.width/2+offset,y:r.y+r.height/2};await page.mouse.move(p.x,p.y);await page.mouse.down();return p;}
async function dragHandle(index,dx,dy,keys=[]){for(const key of keys)await page.keyboard.down(key);const p=await startHandle(index);await page.mouse.move(p.x+dx,p.y+dy,{steps:8});await page.mouse.up();for(const key of keys)await page.keyboard.up(key);await settle();}
async function undo(){await page.getByRole('button',{name:'Undo',exact:true}).click();await settle();}
try{
  await page.locator('[data-handle="7"]').waitFor();const original=await transform(),anchor=await point(0,0);
  const p=await startHandle(7,10);await settle();assert.equal(await transform(),original);
  await page.mouse.move(p.x+70,p.y+45,{steps:10});await page.mouse.up();await settle();
  assert.ok(await value('Scale X')>1);assert.equal(await value('Scale X'),await value('Scale Y'));close(anchor,await point(0,0));
  await undo();assert.equal(await transform(),original);assert.equal(await page.getByRole('button',{name:'Undo',exact:true}).isEnabled(),false);
  await page.getByRole('button',{name:'Redo',exact:true}).click();await settle();assert.ok(await value('Scale X')>1);await undo();
  await dragHandle(4,70,0);assert.ok(await value('Scale X')>1);assert.equal(await value('Scale Y'),1);close(await point(0,0),anchor);await undo();
  await dragHandle(7,90,0,['Shift']);assert.notEqual(await value('Scale X'),await value('Scale Y'));await undo();
  const center=await point(210,125);await dragHandle(7,65,35,['Alt']);close(center,await point(210,125));await undo();
  const cancelStart=await startHandle(7);await page.mouse.move(cancelStart.x+80,cancelStart.y+30,{steps:5});assert.notEqual(await transform(),original);
  await page.keyboard.press('Escape');await page.mouse.up();await settle();assert.equal(await transform(),original);assert.equal(await page.getByRole('button',{name:'Undo',exact:true}).isEnabled(),false);
  await page.getByRole('button',{name:'Toggle object lock',exact:true}).click();await settle();assert.equal(await page.locator('[data-handle]').count(),0);await undo();assert.equal(await page.locator('[data-handle]').count(),8);
  await page.getByRole('button',{name:'Interface settings',exact:true}).click();await page.getByLabel('Interface scale',{exact:true}).selectOption('125');
  assert.equal(await page.getByLabel('Base radius / px',{exact:true}).inputValue(),'16');
  await page.getByRole('button',{name:'Close settings',exact:true}).click();await settle();
  assert.ok(await page.locator('.app').evaluate(el=>Math.abs(el.getBoundingClientRect().bottom-window.innerHeight)<2));
  await page.getByLabel('Preview zoom',{exact:true}).selectOption('60');await settle();
  const zoomAnchor=await point(0,0);await dragHandle(7,50,30);close(zoomAnchor,await point(0,0));assert.ok(await value('Scale X')>1);await undo();
  // The hit region extends beyond the visible 7px handle even at a different UI scale.
  const hover=await startHandle(7,11);await page.mouse.move(hover.x+30,hover.y+25,{steps:5});await page.mouse.up();await settle();assert.ok(await value('Scale X')>1);await undo();
  const r=await page.locator('[data-handle="7"]').boundingBox();await page.mouse.move(r.x+r.width/2,r.y+r.height/2);
  await page.waitForFunction(()=>Number(document.querySelector('[data-zone="resize"]')?.getAttribute('fill-opacity'))>.15);
  await page.screenshot({path:path.join(results,'resize-zone.png')});
  assert.deepEqual(errors,[]);
  console.log('Resize Electron checks passed: expanded-zone no-jump, anchored rotated corner, edge, Shift, Alt, one Undo/Redo, Escape, lock, 125% UI + 60% preview, visual zone.');
}finally{await app.close();}
