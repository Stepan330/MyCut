import {_electron as electron} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(fileURLToPath(new URL('../',import.meta.url))),results=process.env.MYCUT_UI_RESULTS||path.join(root,'test-results/workflow');await mkdir(results,{recursive:true});
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
const app=await electron.launch({args:[root],env}),page=await app.firstWindow(),errors=[];page.on('pageerror',e=>errors.push(e.message));
const settle=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
const selected=()=>page.locator('[role=treeitem][aria-selected=true]').getAttribute('data-layer-id');
const choose=name=>page.getByRole('button',{name:`${name} tool`,exact:true}).click();
const point=(x,y)=>page.locator('.artboard>svg').evaluate((el,p)=>{const a=new DOMPoint(p.x,p.y).matrixTransform(el.getScreenCTM());return {x:a.x,y:a.y};},{x,y});
async function drag(a,b){const p=await point(...a),q=await point(...b);await page.mouse.move(p.x,p.y);await page.mouse.down();await page.mouse.move(q.x,q.y,{steps:10});await page.mouse.up();await settle();}
try{
  await page.locator('[data-layer-id="ellipse"]').waitFor();await page.locator('[data-layer-id="ellipse"]').click({button:'right'});await page.getByRole('menuitem',{name:'Move to new folder',exact:true}).click();await page.getByLabel('Rename object inline',{exact:true}).press('Enter');const parent=await selected();
  await page.locator('[data-layer-id="title"] .tree-label').click();const center=await point(802,410);await page.mouse.click(center.x,center.y);assert.equal(await selected(),parent);await page.mouse.click(center.x,center.y);assert.equal(await selected(),'ellipse');
  // Third press is a drag, slightly away from the previous two clicks. It must
  // move the drilled child, not silently switch the drag back to its parent.
  const childX=Number(await page.getByLabel('Position X',{exact:true}).inputValue());
  await drag([808,415],[828,430]);assert.equal(await selected(),'ellipse');assert.ok(Number(await page.getByLabel('Position X',{exact:true}).inputValue())>childX);
  await drag([828,430],[848,440]);assert.equal(await selected(),'ellipse');
  await page.locator('.tree-root').click({button:'right'});await page.getByRole('menuitem',{name:'Create new layer',exact:true}).click();const layer=await selected(),count=await page.getByRole('treeitem').count();
  await choose('Brush');await page.getByLabel('Tool Size',{exact:true}).fill('25.123');await page.getByLabel('Tool Size',{exact:true}).press('Enter');assert.equal(await page.getByLabel('Tool Size',{exact:true}).inputValue(),'25.123');
  const size=await page.getByLabel('Tool Size',{exact:true}).boundingBox();await page.mouse.move(size.x+size.width/2,size.y+size.height/2);await page.mouse.down();await page.mouse.move(size.x+size.width/2+5,size.y+size.height/2,{steps:5});await page.mouse.up();assert.equal(await page.getByLabel('Tool Size',{exact:true}).inputValue(),'30');
  await drag([120,350],[300,380]);await drag([200,400],[360,440]);assert.equal(await selected(),layer);assert.equal(await page.getByRole('treeitem').count(),count);assert.equal(await page.locator(`[data-object="${layer}"] [data-paint-stroke]`).count(),2);assert.equal(await page.locator('.selection,[data-handle]').count(),0);
  await choose('Selection');assert.equal(await page.locator('[data-handle]').count(),8);await choose('Brush');await page.getByRole('button',{name:'Toggle object lock',exact:true}).click();await drag([200,400],[300,420]);assert.equal(await page.locator(`[data-object="${layer}"] [data-paint-stroke]`).count(),2);await page.getByRole('button',{name:'Undo',exact:true}).click();
  await page.getByRole('button',{name:'Shapes tool',exact:true}).click({button:'right'});await page.getByRole('menu',{name:'Shape types',exact:true}).getByRole('menuitem',{name:'Ellipse',exact:true}).click();assert.equal(await page.getByLabel('Tool Shape',{exact:true}).inputValue(),'ellipse');
  await drag([420,130],[545,230]);assert.equal(await page.getByLabel('Tool Mode',{exact:true}).inputValue(),'Edit');assert.equal(await page.getByLabel('Shape width',{exact:true}).inputValue(),'120');const ellipse=await selected(),afterCount=await page.getByRole('treeitem').count();assert.equal(await page.locator('[data-handle]').count(),8);
  await page.getByLabel('Shape width',{exact:true}).fill('125.123');await page.getByLabel('Shape width',{exact:true}).press('Enter');assert.equal(await page.getByLabel('Shape width',{exact:true}).inputValue(),'125.123');
  await drag([470,175],[490,190]);assert.equal(await selected(),ellipse);assert.equal(await page.getByRole('treeitem').count(),afterCount);
  await page.getByLabel('Tool Mode',{exact:true}).selectOption('Create');await page.getByLabel('Tool Shape',{exact:true}).selectOption('rectangle');await drag([500,300],[620,420]);assert.equal(await page.getByRole('treeitem').count(),afterCount+1);assert.equal(await page.getByLabel('Tool Mode',{exact:true}).inputValue(),'Edit');
  assert.equal(await page.locator('.tool-parameters>strong').count(),0);await page.screenshot({path:path.join(results,'layer-paint-shape-modes.png')});assert.deepEqual(errors,[]);console.log('Workflow UI passed: parent-first/repeat child pick, persistent selected paint layer, hidden drawing frame, lock guard, exact typing/coarse scrub, shape popup/create→edit and no duplicate shape while editing.');
}finally{await app.close();}
