const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8');
const code=html.match(/<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/)[1];
const text=fs.readFileSync('assets/suggestion-catalog.js','utf8');
const base={window:{}};
vm.runInNewContext(fs.readFileSync('assets/design-catalog.js','utf8'),base);
vm.runInNewContext(fs.readFileSync('assets/forum-catalog.js','utf8'),base);
const withLayer={window:{...base.window}};
vm.runInNewContext(text,withLayer);
const layer=withLayer.window.COURSE_MARKET_SUGGESTIONS;
const original=base.window.COURSE_MARKET_CATALOG;
function app(win){
 class DCLogic{constructor(){this.state={};this.props={};}setState(n){this.state={...this.state,...n};}}
 const context={window:{...win,scrollTo(){}},localStorage:{getItem(){return null;},setItem(){}},DCLogic,Date,Math,setTimeout(){}};
 vm.runInNewContext(code+'\nthis.Component=Component;',context);return new context.Component();
}

test('suggestion layer covers exactly the courses whose grade is only a school stage',()=>{
 const vague=original.filter(c=>/^(小学|初中|高中)$/.test(c[6]));
 assert.equal(vague.length,162);
 assert.equal(Object.keys(layer.items).sort().join(),vague.map(c=>c[2]).sort().join());
 for(const c of vague){
  const s=layer.items[c[2]];
  assert.equal(s.length,3,c[2]);
  for(const v of s)assert.ok(typeof v==='string'&&v.trim().length>1,c[2]);
  assert.match(s[0],/年级/,c[2]);
  assert.equal(/^[一二三四五六]/.test(s[0]),c[6]==='小学',c[2]+' 建议年级应落在原学段内');
 }
});

test('suggestion layer is labelled as unconfirmed and carries no private fields or links',()=>{
 assert.match(layer.label,/建议/);assert.match(layer.label,/未经原校确认/);
 assert.match(layer.note,/未经原校确认/);assert.match(layer.note,/未经试教/);
 assert.doesNotMatch(text,/https?:|www\.|特色度|实施度|主推|在库|验证:|来源学校/);
});

test('cards and details show suggestions as a separate labelled block, original grade untouched',()=>{
 const a=app(withLayer.window);a.setState({limit:9999});
 const v=a.renderVals();
 const tagged=v.visible.filter(c=>c.hasSuggestion);
 assert.equal(tagged.length,162);
 const c=v.visible.find(x=>x.id==='KX-036');
 assert.equal(c.gradeText,'小学');assert.equal(c.grade,'小学');
 assert.equal(c.suggestGrade,'四年级');assert.match(c.suggestLabel,/未经原校确认/);
 assert.equal(v.visible.find(x=>x.id==='YW-001').hasSuggestion,false);
 a.setState(a.stateOfHash('#course=KX-036'));
 const d=a.renderVals().detail;
 assert.equal(d.hasSuggestion,true);assert.equal(d.gradeText,'小学');
 assert.ok(d.suggestHours&&d.suggestMaterials&&d.suggestNote);
 assert.match(html,/class="suggest-chip"[^>]*>建议：/);
 assert.match(html,/class="suggest-box"[\s\S]{0,700}\{\{detail\.suggestLabel\}\}/);
});

test('search finds a suggested grade, and the receipt keeps the original grade wording',()=>{
 const a=app(withLayer.window);a.setState({q:'四年级 小灯泡',limit:9999});
 let v=a.renderVals();
 assert.equal(v.visible.map(c=>c.id).join(),'KX-036');
 v.visible[0].toggle();
 a.setState({q:'',school:{name:'测试学校',contact:'张老师',phone:'13800000000',term:'',vision:''},orderNo:'CS-TEST',orderDate:'2026-11-20',screen:'receipt'});
 v=a.renderVals();
 assert.match(v.receiptText,/\[KX-036\] 点亮小灯泡（[^）]*小学/);
 assert.doesNotMatch(v.receiptText,/四年级/);
});

test('page works without the suggestion layer',()=>{
 const a=app(base.window);a.setState({limit:9999});
 const v=a.renderVals();
 assert.equal(v.matchCount,638);
 assert.ok(v.visible.every(c=>!c.hasSuggestion));
 a.setState(a.stateOfHash('#course=KX-036'));
 assert.equal(a.renderVals().detail.hasSuggestion,false);
});

test('suggestion layer is precached and refreshed with the shelf',()=>{
 const sw=fs.readFileSync('sw.js','utf8');
 const tag=html.match(/suggestion-catalog\.js\?v=([\w-]+)/)[1];
 assert.ok(sw.includes("./assets/suggestion-catalog.js?v="+tag));
 assert.match(sw,/\(forum\|suggestion\)-catalog/);
});
