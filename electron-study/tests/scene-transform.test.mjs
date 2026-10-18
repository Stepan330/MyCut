import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initialScene,updateItem,transaction} from '../src/model.mjs';
import {moveLayers,createNode} from '../src/hierarchy.mjs';
import {evaluateScene,identity,inverse,multiply,transformPoint,localMatrix} from '../src/scene-transform.mjs';
const near=(a,b)=>a.forEach((v,i)=>assert.ok(Math.abs(v-b[i])<1e-8,`${a} != ${b}`));
test('reparenting keeps full world affine matrix even with rotated nonuniform mirrored parents',()=>{
  let scene=initialScene().map(n=>n.id==='card'?{...n,sx:2,sy:-.7,rotation:37}:n);
  const before=evaluateScene(scene).get('ellipse').world;
  scene=moveLayers(scene,['ellipse'],'card','inside');near(evaluateScene(scene).get('ellipse').world,before);
  scene=moveLayers(scene,['ellipse'],'title','inside');near(evaluateScene(scene).get('ellipse').world,before);
  scene=moveLayers(scene,['ellipse'],'title','after');near(evaluateScene(scene).get('ellipse').world,before);
});
test('parent translation rotation scale and reflection propagate recursively without rewriting child data',()=>{
  let scene=moveLayers(initialScene(),['ellipse'],'card','inside');scene=moveLayers(scene,['card'],'title','inside');
  const before=evaluateScene(scene),child=scene.find(n=>n.id==='ellipse');
  for(const patch of [{x:178,y:12},{rotation:90},{sx:-2,sy:.5}]){
    const next=updateItem(scene,'title',patch),after=evaluateScene(next);
    const delta=multiply(after.get('title').world,inverse(before.get('title').world));
    near(after.get('ellipse').world,multiply(delta,before.get('ellipse').world));
    assert.equal(next.find(n=>n.id==='ellipse'),child);
    assert.equal(transaction({past:[],future:[]},scene,next).past.length,1);
  }
});
test('ancestor opacities multiply and local values are retained',()=>{
  let scene=moveLayers(initialScene(),['ellipse'],'card','inside');scene=moveLayers(scene,['card'],'title','inside');
  scene=updateItem(updateItem(updateItem(scene,'title',{opacity:.5}),'card',{opacity:.4}),'ellipse',{opacity:.7});
  assert.ok(Math.abs(evaluateScene(scene).get('ellipse').opacity-.14)<1e-10);
  assert.equal(scene.find(n=>n.id==='ellipse').opacity,.7);
});
test('folder transforms are identity by default and affect descendants when edited',()=>{
  const folder={id:'f',name:'Folder',kind:'Folder',x:0,y:0,sx:1,sy:1,rotation:0,opacity:1,visible:true,locked:false};
  let scene=createNode(initialScene(),folder);scene=moveLayers(scene,['card'],'f','inside');
  near(localMatrix(folder),identity());const before=evaluateScene(scene).get('card').world;
  const after=evaluateScene(updateItem(scene,'f',{x:80,y:-20})).get('card').world;
  near(after,multiply([1,0,0,1,80,-20],before));
});
test('singular parent rejects keep-world reparent and inverse is guarded',()=>{
  const scene=updateItem(initialScene(),'card',{sx:0});assert.equal(inverse(localMatrix(scene.find(n=>n.id==='card'))),null);
  assert.equal(moveLayers(scene,['ellipse'],'card','inside'),scene);
  const m=[2,1,.3,-4,70,-20],p={x:30,y:12};const result=transformPoint(inverse(m),transformPoint(m,p));near([result.x,result.y],[p.x,p.y]);
});
