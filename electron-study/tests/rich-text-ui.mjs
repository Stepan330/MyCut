import {_electron as electron} from 'playwright';
import assert from 'node:assert/strict';
import path from 'node:path';
import {mkdir,readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const root=path.resolve(fileURLToPath(new URL('../',import.meta.url))),env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
const app=await electron.launch({args:[root],env}),page=await app.firstWindow(),errors=[];page.on('pageerror',e=>errors.push(e.message));
const settle=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
const editor=page.getByLabel('Canvas text editor',{exact:true});
async function select(start,end){await editor.evaluate((el,{start,end})=>{el.focus();const walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT),range=document.createRange();let node,offset=0,started=false;while(node=walker.nextNode()){const length=node.textContent.length;if(!started&&start<=offset+length){range.setStart(node,Math.max(0,start-offset));started=true;}if(end<=offset+length){range.setEnd(node,Math.max(0,end-offset));break;}offset+=length;}const selection=window.getSelection();selection.removeAllRanges();selection.addRange(range);document.dispatchEvent(new Event('selectionchange'));},{start,end});await settle();}
async function field(label,value){await page.getByLabel(label,{exact:true}).fill(String(value));await page.getByLabel(label,{exact:true}).press('Enter');await settle();}
try{
  await page.getByRole('button',{name:'Text tool',exact:true}).click();const p=await page.locator('.artboard>svg').evaluate(el=>{const p=new DOMPoint(390,100).matrixTransform(el.getScreenCTM());return {x:p.x,y:p.y};});await page.mouse.click(p.x,p.y);await editor.fill('Alpha Beta\nGamma');await select(0,5);
  const id=await page.locator('[role=treeitem][aria-selected=true]').getAttribute('data-layer-id'),spans=page.locator(`[data-object="${id}"] text tspan`);
  const selectedRect=await editor.evaluate(()=>{const r=window.getSelection().getRangeAt(0).getBoundingClientRect();return {x:r.x+5,y:r.y+r.height/2};});await page.mouse.click(selectedRect.x,selectedRect.y,{button:'right'});
  await page.getByRole('button',{name:'Close tool settings',exact:true}).waitFor();assert.equal(await editor.count(),1,'opening parameters must not end text editing');
  assert.equal(await page.evaluate(()=>CSS.highlights.get('mycut-text-selection')?.size),1,'selection remains visibly highlighted while parameters have focus');
  await page.getByLabel('Settings Color',{exact:true}).fill('#ff2244');await page.getByLabel('Settings Color',{exact:true}).press('Enter');await settle();
  assert.equal(await spans.filter({hasText:'Alpha'}).getAttribute('fill'),'#ff2244');assert.equal(await spans.filter({hasText:' Beta'}).getAttribute('fill'),'#d6f2f4');
  await page.getByRole('button',{name:'Close tool settings',exact:true}).click();await select(6,10);await field('Tool Font size',70);await page.getByLabel('Tool Font',{exact:true}).selectOption('Georgia');await page.getByLabel('Tool Outline',{exact:true}).fill('#22ff88');await field('Tool Outline width',3);
  const beta=spans.filter({hasText:'Beta'});assert.equal(await beta.getAttribute('font-size'),'70');assert.equal(await beta.getAttribute('font-family'),'Georgia');assert.equal(await beta.getAttribute('stroke'),'#22ff88');assert.equal(await beta.getAttribute('data-document-stroke'),'3');assert.equal(await spans.filter({hasText:'Gamma'}).getAttribute('font-size'),'44');
  // Selecting another fragment updates the controls instead of reformatting it.
  await select(0,5);assert.equal(await page.getByLabel('Tool Font size',{exact:true}).inputValue(),'44');assert.equal(await page.getByLabel('Tool Color',{exact:true}).inputValue(),'#ff2244');
  await select(6,10);await editor.press('End');await editor.press('!');await settle();assert.match(await editor.textContent(),/Beta!/);assert.equal(await spans.filter({hasText:'Beta!'}).getAttribute('font-family'),'Georgia','typing retains word formatting');
  await editor.press('Control+Enter');assert.equal(await editor.count(),0);
  const exports=[];for(const zoom of ['100','25']){await page.getByLabel('Preview zoom',{exact:true}).selectOption(zoom);await settle();await page.getByRole('button',{name:'Export layer to assets',exact:true}).click();await page.waitForFunction(n=>document.querySelectorAll('.asset .thumbnail img').length>=n,exports.length+1);exports.push(await page.locator('.asset .thumbnail img').last().getAttribute('src'));}assert.ok(exports[0]===exports[1],'mixed formatting export does not depend on zoom');
  const colors=await page.evaluate(async src=>{const image=new Image();image.src=src;await image.decode();const canvas=document.createElement('canvas');canvas.width=960;canvas.height=600;const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);const data=ctx.getImageData(0,0,960,600).data;let red=0,green=0;for(let i=0;i<data.length;i+=4){if(data[i]>200&&data[i+1]<90)red++;if(data[i]<100&&data[i+1]>200&&data[i+2]<180)green++;}return {red,green};},exports[0]);assert.ok(colors.red>50&&colors.green>50,'PNG retains different fragment colors and outline');
  await page.getByRole('button',{name:'Undo',exact:true}).click();await settle();assert.ok(!(await spans.allTextContents()).join('').includes('!'),'typing is undoable without removing styles');
  await page.getByLabel('Preview zoom',{exact:true}).selectOption('100');await settle();await mkdir(path.join(root,'test-results/rich-text'),{recursive:true});
  const file=path.join(root,'test-results/rich-text/styled.mycutproject');await app.evaluate(({dialog},file)=>{dialog.showSaveDialog=async()=>({canceled:false,filePath:file});dialog.showOpenDialog=async()=>({canceled:false,filePaths:[file]});dialog.showMessageBox=async()=>({response:1});},file);
  await page.locator('.viewport').focus();await page.keyboard.press('Control+s');await page.waitForFunction(()=>document.querySelector('.statusbar').textContent.includes('Saved styled.mycutproject'));const saved=JSON.parse(await readFile(file,'utf8')),savedText=saved.items.find(n=>n.id===id);assert.ok(savedText.textRuns.some(r=>r.style.fontSize===70));
  await page.getByLabel('Text content',{exact:true}).fill('Changed');await page.getByLabel('Text content',{exact:true}).press('Tab');await page.keyboard.press('Control+o');await page.waitForFunction(()=>document.querySelector('.statusbar').textContent.includes('Opened styled.mycutproject'));assert.equal(await beta.getAttribute('font-size'),'70');assert.equal(await spans.filter({hasText:'Alpha'}).getAttribute('fill'),'#ff2244');
  await page.screenshot({path:path.join(root,'test-results/rich-text/mixed-formatting.png')});assert.deepEqual(errors,[]);
  console.log('Rich text UI passed: retained selection/highlight through settings, independent word fonts/size/color/outline, typing inheritance, Undo, mixed PNG colors, zoom-independent export and native project save/open.');
}finally{await app.close();}
