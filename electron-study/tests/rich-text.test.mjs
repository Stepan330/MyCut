import {test} from 'node:test';
import assert from 'node:assert/strict';
import {formatTextRange,textStyle,textFragments,replaceText,clearTextOverrides,layoutText} from '../src/rich-text.mjs';
import {encodeProject,decodeProject} from '../src/project-file.mjs';
const item=()=>({id:'text',name:'Text',kind:'Text',text:'Alpha Beta Gamma',x:0,y:0,sx:1,sy:1,rotation:0});
test('formatting applies only to selected offsets and merges overlapping styles without losing neighbors',()=>{
  let n=item();n.textRuns=formatTextRange(n,0,5,{color:'#ff0000'});n.textRuns=formatTextRange(n,6,10,{fontSize:72});n.textRuns=formatTextRange(n,2,8,{fontStyle:'italic'});
  assert.equal(textStyle(n,0).color,'#ff0000');assert.equal(textStyle(n,3).fontStyle,'italic');assert.equal(textStyle(n,7).fontSize,72);assert.equal(textStyle(n,9).fontStyle,'normal');assert.equal(textStyle(n,12).fontSize,44);
  assert.equal(textFragments(n).map(p=>p.text).join(''),n.text);assert.ok(clearTextOverrides(n,['color']).every(r=>r.style.color===undefined));
});
test('insertion, replacement and deletion rebase runs and inherit the edited word style',()=>{
  const n=item();n.textRuns=formatTextRange(n,0,5,{color:'#ff0000'});n.textRuns=formatTextRange(n,6,10,{fontSize:72});
  const next={...n,...replaceText(n,'Alphax Beta Gamma')};assert.equal(textStyle(next,5).color,'#ff0000');assert.equal(textStyle(next,7).fontSize,72);
  const deleted={...n,...replaceText(n,'Beta Gamma')};assert.equal(textStyle(deleted,0).fontSize,72);assert.equal(textStyle(deleted,5).color,'#d6f2f4');
});
test('mixed fonts, Unicode offsets, line heights and paragraph wrapping use one layout contract',()=>{
  const n={...item(),text:'😀A\nB',textRuns:[{start:2,end:3,style:{fontSize:80}}]},ctx={measureText:s=>({width:[...s].length*10})};
  const l=layoutText(n,ctx);assert.equal(l.parts.map(p=>p.text).join(''),'😀AB');assert.equal(l.parts[0].end,2);assert.equal(l.parts[1].y,80);assert.ok(l.height>130);
  assert.ok(layoutText({...n,textType:'Paragraph',width:25},ctx).height>l.height);
});
test('projects roundtrip styled fragments and reject hostile or overlapping ranges',()=>{
  const n=item();n.textRuns=formatTextRange(n,0,5,{fontSize:72,color:'#ff0000'});
  assert.deepEqual(decodeProject(encodeProject({items:[n],assets:[]})).items[0],n);
  for(const run of [{start:0,end:500,style:{color:'#fff000'}},{start:0,end:2,style:{fontSize:-3}},{start:0,end:2,style:{unknown:'x'}},{start:0,end:2,style:{color:'url(x)'}}])assert.throws(()=>encodeProject({items:[{...n,textRuns:[run]}],assets:[]}));
  assert.throws(()=>encodeProject({items:[{...n,textRuns:[{start:0,end:5,style:{}},{start:4,end:8,style:{}}]}],assets:[]}));
});
