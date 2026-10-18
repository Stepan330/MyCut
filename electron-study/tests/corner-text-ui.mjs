import {_electron as electron} from 'playwright';
import assert from 'node:assert/strict';
import path from 'node:path';
import {mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const root=path.resolve(fileURLToPath(new URL('../',import.meta.url))),env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
const app=await electron.launch({args:[root],env}),page=await app.firstWindow(),errors=[];page.on('pageerror',e=>errors.push(e.message));
const settle=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
const at=(x,y)=>page.locator('.artboard>svg').evaluate((el,p)=>{const q=new DOMPoint(p.x,p.y).matrixTransform(el.getScreenCTM());return {x:q.x,y:q.y};},{x,y});
async function field(label,value){await page.getByLabel(label,{exact:true}).fill(String(value));await page.getByLabel(label,{exact:true}).press('Enter');await settle();}
async function drag(a,b){await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:10});await page.mouse.up();await settle();}
try{
  await page.getByRole('button',{name:'Shapes tool',exact:true}).click();await drag(await at(360,180),await at(650,430));
  const handles=page.locator('[data-corner-handle]');assert.equal(await handles.count(),4);
  await page.getByRole('button',{name:'Tool settings',exact:true}).click();await page.getByRole('button',{name:'Advanced settings',exact:true}).click();await field('Tool Corner radius',50);await page.getByRole('button',{name:'Close tool settings',exact:true}).click();
  for(const [i,u,v] of [[0,1,1],[1,-1,1],[2,-1,-1],[3,1,-1]]){
    const handle=handles.nth(i),r=await handle.boundingBox(),before=Number(await handle.getAttribute('aria-valuenow'));
    // Grab outside the visible 6 px dot, within the adaptive screen-space zone.
    const p={x:r.x+r.width/2+u*10,y:r.y+r.height/2};await drag(p,{x:p.x+u*8,y:p.y+v*8});
    assert.ok(Number(await handle.getAttribute('aria-valuenow'))>before,`corner ${i} uses inward signed movement and an enlarged grab zone`);
    const after=Number(await handle.getAttribute('aria-valuenow'));await page.getByRole('button',{name:'Undo',exact:true}).click();await settle();assert.equal(Number(await handle.getAttribute('aria-valuenow')),before);assert.ok(after>before);
  }
  await page.getByRole('button',{name:'Text tool',exact:true}).click();
  assert.equal(await page.locator('.tool-parameters [role=group][aria-label=Outline]').count(),1);
  assert.equal(await page.locator('.tool-parameters .parameter-caption:visible').count(),0);
  const p=await at(300,100);await page.mouse.click(p.x,p.y);const editor=page.getByLabel('Canvas text editor',{exact:true});await editor.fill('Outlined text\nПривет');await editor.press('Control+A');
  const selected=await editor.evaluate(()=>window.getSelection().toString().length);assert.ok(selected>0);
  await editor.click({button:'right'});await page.getByRole('button',{name:'Close tool settings',exact:true}).waitFor();
  await page.getByRole('button',{name:'Close tool settings',exact:true}).click();if(await editor.count())await editor.press('Control+Enter');
  await field('Tool Outline width',6);await page.getByLabel('Tool Outline',{exact:true}).fill('#ff3355');await page.getByLabel('Tool Outline',{exact:true}).press('Enter');await settle();
  const text=page.locator('[data-object] text').filter({hasText:'Outlined text'});assert.equal(await text.getAttribute('stroke'),'#ff3355');assert.equal(await text.getAttribute('paint-order'),'stroke fill');assert.equal(await text.getAttribute('data-document-stroke'),'6');
  const exports=[];for(const zoom of ['100','25','150']){await page.getByLabel('Preview zoom',{exact:true}).selectOption(zoom);await settle();await page.getByRole('button',{name:'Export layer to assets',exact:true}).click();await page.waitForFunction(n=>document.querySelectorAll('.asset .thumbnail img').length>=n,exports.length+1);exports.push(await page.locator('.asset .thumbnail img').last().getAttribute('src'));}
  assert.ok(exports[0]===exports[1],'100 vs 25 zoom text export');assert.ok(exports[1]===exports[2],'25 vs 150 zoom text export');
  const colored=await page.evaluate(async src=>{const image=new Image();image.src=src;await image.decode();const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data;let count=0;for(let i=0;i<pixels.length;i+=4)if(pixels[i]>200&&pixels[i+1]<110&&pixels[i+2]<140&&pixels[i+3]>200)count++;return count;},exports[0]);assert.ok(colored>100,'export contains the actual colored text outline');
  await page.getByLabel('Preview zoom',{exact:true}).selectOption('100');await settle();await mkdir(path.join(root,'test-results/corner-text'),{recursive:true});await page.screenshot({path:path.join(root,'test-results/corner-text/outlined-text.png')});assert.deepEqual(errors,[]);
  console.log('Corner/text UI passed: all four adaptive corner grabs and Undo, compact semantic controls, Outline group, text selection context menu, colored outline and zoom-independent PNG export.');
}finally{await app.close();}
