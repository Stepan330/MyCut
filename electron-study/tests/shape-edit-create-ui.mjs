import {_electron as electron} from 'playwright';
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(fileURLToPath(new URL('../',import.meta.url))),env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
const app=await electron.launch({args:[root],env}),page=await app.firstWindow(),errors=[];page.on('pageerror',e=>errors.push(e.message));
const settle=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
const at=(x,y)=>page.locator('.artboard>svg').evaluate((el,p)=>{const q=new DOMPoint(p.x,p.y).matrixTransform(el.getScreenCTM());return {x:q.x,y:q.y};},{x,y});
async function drag(a,b){await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:12});await page.mouse.up();await settle();}
const center=async locator=>{const r=await locator.boundingBox();return {x:r.x+r.width/2,y:r.y+r.height/2};};
try{
  await page.getByRole('button',{name:'Shapes tool',exact:true}).click();await drag(await at(440,140),await at(740,340));
  const shapeId=await page.locator('.canvas-object').last().getAttribute('data-object'),shape=page.locator(`[data-object="${shapeId}"] [data-document-stroke]`);
  const corners=page.locator('[data-corner-handle]'),resize=page.locator('[data-handle="0"]'),round=await center(corners.first()),size=await center(resize);
  assert.ok(Math.hypot(round.x-size.x,round.y-size.y)>60,'rounding control is inset away from resize');
  const radius=await corners.first().getAttribute('aria-valuenow'),before=await page.getByLabel('Scale X',{exact:true}).inputValue();
  await drag(size,{x:size.x-24,y:size.y-18});assert.notEqual(await page.getByLabel('Scale X',{exact:true}).inputValue(),before,'resize control resizes instead of rounding');assert.equal(await corners.first().getAttribute('aria-valuenow'),radius);
  await page.getByRole('button',{name:'Undo',exact:true}).click();await settle();
  const blank=await at(900,80),count=await page.locator('[data-object]').count();await page.mouse.click(blank.x,blank.y);await settle();
  assert.equal(await corners.count(),0);assert.equal(await page.locator('.artboard .selection').count(),0);assert.equal(await page.locator('[data-object]').count(),count,'blank click only deselects');
  await page.mouse.click(blank.x,blank.y);await settle();assert.equal(await page.locator('[data-object]').count(),count,'another blank click does not create a tiny shape');
  const start=await at(700,410),end=await at(880,510);await page.mouse.move(start.x,start.y);await page.mouse.down();await page.mouse.move(end.x,end.y,{steps:12});await settle();assert.equal(await page.getByLabel('Tool Mode',{exact:true}).inputValue(),'Create','drag enters creation mode');await page.mouse.up();await settle();
  assert.equal(await page.locator('[data-object]').count(),count+1);assert.equal(await page.getByLabel('Tool Mode',{exact:true}).inputValue(),'Edit');assert.equal(await corners.count(),4);
  const oldWidth=await shape.getAttribute('width');await page.getByRole('button',{name:'Undo',exact:true}).click();await settle();assert.equal(await page.locator('[data-object]').count(),count);assert.equal(await shape.getAttribute('width'),oldWidth,'creating does not alter original shape');
  // Escape during the next creation restores the scene.
  await page.mouse.click(blank.x,blank.y);await drag(await at(700,410),await at(710,420));await page.getByRole('button',{name:'Undo',exact:true}).click();await settle();
  await page.mouse.move(start.x,start.y);await page.mouse.down();await page.mouse.move(end.x,end.y,{steps:5});await page.keyboard.press('Escape');await page.mouse.up();await settle();assert.equal(await page.locator('[data-object]').count(),count);
  assert.deepEqual(errors,[]);console.log('Shape edit/create UI passed: separated rounding/resize controls, resize priority, empty-click deselection, thresholded new-shape drag, Undo and Escape.');
}finally{await app.close();}
