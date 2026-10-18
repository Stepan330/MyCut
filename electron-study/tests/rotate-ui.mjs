import {_electron as electron} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(fileURLToPath(new URL('../',import.meta.url))),results=process.env.MYCUT_UI_RESULTS||path.join(root,'test-results/rotation');await mkdir(results,{recursive:true});
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
const app=await electron.launch({args:[root],env});const page=await app.firstWindow(),errors=[];page.on('pageerror',e=>errors.push(e.message));
const settle=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
const rotation=async()=>Number(await page.getByLabel('Rotation',{exact:true}).inputValue());
const transform=()=>page.locator('[data-object="card"]').getAttribute('transform');
async function geometry(){await settle();return page.locator('[data-object="card"]').evaluate(el=>{
  const m=el.getScreenCTM(),center=new DOMPoint(210,125).matrixTransform(m);
  const points=[[0,0],[420,0],[0,250],[420,250]].map(([x,y])=>new DOMPoint(x,y).matrixTransform(m));
  return {x:center.x,y:center.y,radius:Math.max(64,...points.map(p=>Math.hypot(p.x-center.x,p.y-center.y)+28))};
});}
function at(g,angle){return {x:g.x+Math.cos(angle)*g.radius,y:g.y+Math.sin(angle)*g.radius};}
async function turn(from,to,keys=[]){const g=await geometry();for(const key of keys)await page.keyboard.down(key);const start=at(g,from);await page.mouse.move(start.x,start.y);await page.mouse.down();
  for(let i=1;i<=16;i++){const p=at(g,from+(to-from)*i/16);await page.mouse.move(p.x,p.y);}
  await page.mouse.up();for(const key of keys)await page.keyboard.up(key);await settle();return g;
}
async function undo(){await page.getByRole('button',{name:'Undo',exact:true}).click();await settle();}
try{
  await page.locator('[data-rotation-ring] line').first().waitFor();const original=await transform(),g=await geometry();
  const start=at(g,0);await page.mouse.move(start.x,start.y);
  await page.waitForFunction(()=>document.querySelector('[data-zone="rotate"]'));
  const zoneCenter=await page.locator('[data-zone="rotate"]').evaluate(el=>{
    const p=new DOMPoint(Number(el.getAttribute('cx')),Number(el.getAttribute('cy'))).matrixTransform(el.getScreenCTM());return {x:p.x,y:p.y};
  });
  assert.ok(Math.hypot(zoneCenter.x-start.x,zoneCenter.y-start.y)<1,'rotation hover zone must follow the cursor on the ring');
  const count=await page.locator('[data-rotation-ring] line').count();assert.ok(count>0&&count<192);
  const opacities=await page.locator('[data-rotation-ring] line').evaluateAll(lines=>lines.map(l=>Number(l.getAttribute('stroke-opacity'))));assert.ok(Math.max(...opacities)>.8);assert.ok(Math.min(...opacities)<=.14);
  await page.screenshot({path:path.join(results,'rotation-ring-hover.png')});
  await turn(0,Math.PI/3);assert.ok(Math.abs(await rotation()-52)<.02);
  const after=await geometry();assert.ok(Math.hypot(after.x-g.x,after.y-g.y)<1);
  assert.equal(await page.getByLabel('Scale X',{exact:true}).inputValue(),'1');
  await undo();assert.equal(await transform(),original);assert.equal(await page.getByRole('button',{name:'Undo',exact:true}).isEnabled(),false);
  await page.getByRole('button',{name:'Redo',exact:true}).click();await settle();assert.ok(Math.abs(await rotation()-52)<.02);await undo();
  await turn(0,.6,['Shift']);assert.equal((await rotation())%15,0);await undo();
  await turn(0,1,['Control']);assert.ok(Math.abs(await rotation()-(-8+180/Math.PI*.1))<.02);await undo();
  const cancelG=await geometry(),a=at(cancelG,0),b=at(cancelG,.6);await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:6});assert.notEqual(await transform(),original);
  await page.keyboard.press('Escape');await page.mouse.up();await settle();assert.equal(await transform(),original);
  // Existing corner scaling wins near a ring cutout, not rotation.
  const corner=await page.locator('[data-handle="7"]').boundingBox();await page.mouse.move(corner.x+corner.width/2,corner.y+corner.height/2);await page.mouse.down();await page.mouse.move(corner.x+60,corner.y+40,{steps:6});await page.mouse.up();await settle();
  assert.equal(await rotation(),-8);assert.ok(Number(await page.getByLabel('Scale X',{exact:true}).inputValue())>1);await undo();
  await page.getByRole('button',{name:'Toggle object lock',exact:true}).click();await settle();assert.equal(await page.locator('[data-rotation-ring] line').count(),0);await undo();
  await page.getByRole('button',{name:'Hide Studio image',exact:true}).click();await settle();assert.equal(await page.locator('[data-rotation-ring] line').count(),0);await undo();
  assert.deepEqual(errors,[]);console.log('Rotation Electron checks passed: ring gaps/fade, local zone, rotation, stable center, unchanged scale, Undo/Redo, Shift, Ctrl, Escape, resize priority, locked/hidden.');
}finally{await app.close();}
