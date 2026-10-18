import {_electron as electron} from 'playwright';
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(fileURLToPath(new URL('../',import.meta.url))),env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
const app=await electron.launch({args:[root],env}),page=await app.firstWindow(),errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
  await page.getByRole('button',{name:'Group sidebar tabs',exact:true}).click();
  await page.locator('.sidebar').getByRole('button',{name:'Panel group settings',exact:true}).click();await page.getByRole('menuitemradio',{name:'Semicircle',exact:true}).click();
  await page.locator('[data-gesture-mode=arc]').waitFor();await page.emulateMedia({reducedMotion:'no-preference'});
  const tabs=page.getByRole('tablist',{name:'Sidebar panels',exact:true}),r=await page.locator('.gesture-tab-strip').boundingBox();
  await page.evaluate(()=>{window.arcPresses=0;window.addEventListener('pointerdown',()=>window.arcPresses++,true);});
  const selected=async name=>assert.equal(await tabs.getByRole('tab',{name,exact:true}).getAttribute('aria-selected'),'true');
  async function arc(right,slow=false){right=!right;const x=r.x+r.width*(right?.25:.7),dx=(right?1:-1)*Math.min(100,r.width*.35),bottom=r.y+r.height-3,top=r.y+3;
    await page.mouse.move(x,bottom+16);await page.mouse.move(x,bottom,{steps:3});
    for(const [a,b] of [[x,top],[x+dx*.5,top-6],[x+dx,top],[x+dx,bottom+8]]){await page.mouse.move(a,b,{steps:6});if(slow)await page.waitForTimeout(180);}
  }
  await arc(true);await selected('Details');assert.ok(await page.locator('[data-gesture-animating=true]').count()>0);
  await arc(false,true);await selected('Outliner');assert.equal(await page.evaluate(()=>window.arcPresses),0);
  await page.mouse.move(r.x+r.width/2,r.y+r.height/2);await page.mouse.move(r.x+r.width-5,r.y+r.height/2);await page.waitForTimeout(200);await selected('Outliner');
  assert.equal(await page.locator('.dock-drop-highlight').count(),0);
  await page.getByRole('button',{name:'Brush tool',exact:true}).click();await page.getByRole('button',{name:'Tool settings',exact:true}).click();await page.getByRole('button',{name:'Advanced settings',exact:true}).click();
  const panel=page.getByRole('dialog',{name:'Brush settings',exact:true});assert.equal(await panel.locator('.advanced-parameter-marker').count(),8);
  for(const row of await panel.locator('label').all())assert.equal(await row.locator(':scope > span > svg').count(),1);
  assert.deepEqual(errors,[]);console.log('Arc tabs UI passed: zero presses, mirrored arcs, slow path, animation, no position-mode leakage; all eight Advanced brush parameters marked.');
}finally{await app.close();}
