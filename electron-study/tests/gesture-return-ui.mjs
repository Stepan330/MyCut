import {_electron as electron} from 'playwright';
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(fileURLToPath(new URL('../',import.meta.url))),env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
const app=await electron.launch({args:[root],env}),page=await app.firstWindow(),errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
  await page.getByRole('button',{name:'Group sidebar tabs',exact:true}).click();await page.locator('.sidebar').getByRole('button',{name:'Panel group settings',exact:true}).click();await page.getByRole('menuitemradio',{name:'Semicircle',exact:true}).click();
  const tabs=page.getByRole('tablist',{name:'Sidebar panels',exact:true}),r=await page.locator('.gesture-tab-strip').boundingBox();
  const selected=async name=>assert.equal(await tabs.getByRole('tab',{name,exact:true}).getAttribute('aria-selected'),'true');
  // Global moves simulate a path far above the tracking field, not a new hover entry.
  async function excursion(right,expired=false){right=!right;const x=r.x+r.width*(right?.25:.75),end=x+(right?1:-1)*Math.min(100,r.width*.3),y=r.y+r.height-3;await page.mouse.move(x,y+18);await page.mouse.move(x,y);await page.mouse.move(x,r.y+3,{steps:4});await page.evaluate(({x,end,r})=>{for(const [clientX,clientY] of [[x,r.y-220],[end,r.y-260]])document.body.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,clientX,clientY,pointerType:'mouse',buttons:0}));},{x,end,r});if(expired)await page.waitForTimeout(1600);await page.mouse.move(end,y+8);}
  await excursion(true);await page.waitForTimeout(50);await selected('Details');await excursion(false);await page.waitForTimeout(50);await selected('Outliner');await excursion(true,true);await selected('Outliner');
  await excursion(true);await page.waitForTimeout(50);await selected('Details');
  const header=await page.locator('.gesture-header').boundingBox(),gear=await page.locator('.gesture-header').getByRole('button',{name:'Panel group settings',exact:true}).boundingBox(),x=r.x+r.width*.2;await page.mouse.move(x,header.y+header.height+15);await page.mouse.move(x,r.y+r.height-2);await page.mouse.move(x,r.y+2,{steps:4});await page.mouse.move(gear.x+gear.width/2,gear.y+gear.height/2,{steps:6});await page.mouse.move(gear.x+gear.width/2,header.y+header.height+10,{steps:4});await page.waitForTimeout(50);await selected('Outliner');assert.equal(await page.getByRole('menu',{name:'Panel group options'}).count(),0,'crossing action icons does not cancel or click them');
  const normals=await page.locator('.gesture-deck-face').evaluateAll(nodes=>nodes.map(n=>{const m=new DOMMatrix(getComputedStyle(n).transform);return [m.m31,m.m32,m.m33];}));assert.ok(Math.abs(normals[0].reduce((s,v,i)=>s+v*normals[1][i],0))<.001,'card faces remain perpendicular');assert.equal(await page.locator('.gesture-deck-face svg').count(),2);assert.deepEqual(errors,[]);
  console.log('Gesture return UI passed: distant return in both directions, timeout rejection, perpendicular cards with panel icons.');
}finally{await app.close();}
