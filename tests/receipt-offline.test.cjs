const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync('index.html', 'utf8');
const code = html.match(/<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/)[1];
function setup() {
  const store = {};
  class DCLogic { constructor() { this.state = {}; this.props = {}; } setState(n) { Object.assign(this.state, n); } }
  const context = { DCLogic, Date, Math, window: { scrollY: 5300, scrollTo() {} }, localStorage: {
    getItem: k => store[k] || null, setItem: (k,v) => { store[k] = v; }
  }};
  vm.runInNewContext(fs.readFileSync('assets/design-catalog.js','utf8'), context);
  vm.runInNewContext(fs.readFileSync('assets/forum-catalog.js','utf8'), context);
  vm.runInNewContext(code + '\nthis.App = Component;', context);
  return { app: () => new context.App(), store };
}
test('receipt identity, school and browsing preferences survive reload and receipt links', () => {
  const {app} = setup(), a = app();
  a.setState({cart:['YW-001'],school:{name:'测试学校',contact:'老师',phone:'123',term:a.termOptions(new Date())[0],vision:'探索'},q:'语言馆',floor:'f1',stage:'小',kind:'k',counter:'语文',updatedOnly:true,forumSection:'all',limit:48});
  a.renderVals().submit();
  const b = app();
  for (const key of ['school','orderNo','orderDate','q','floor','stage','kind','counter','updatedOnly','limit']) assert.equal(JSON.stringify(b.st()[key]),JSON.stringify(a.st()[key]));
  assert.equal(b.stateOfHash('#receipt').screen,'receipt');
});
test('content edits invalidate identity but browsing and unchanged fields do not', () => {
  for (const change of [{cart:[]},{notes:{'YW-001':'新想法'}},{fusions:[{id:'f',name:'融合',sources:[]}]},{school:{name:'新学校'}}]) {
    const {app} = setup(), a = app(); a.setState({cart:['YW-001'],school:{name:'学校'}}); a.renderVals().submit();
    a.setState({q:'语言馆'}); assert.ok(a.st().orderNo);
    a.setState({school:a.st().school}); assert.ok(a.st().orderNo);
    a.setState(change); assert.equal(a.st().orderNo,''); assert.equal(a.st().orderDate,''); assert.equal(a.st().screen,'checkout');
    assert.equal(app().stateOfHash('#receipt').screen,'checkout');
  }
});
test('restoring a shortened cart or fusion selection discards receipt identity', () => {
  for (const selection of [
    {cart:['YW-001','missing-course'],fusions:[]},
    {cart:['YW-001'],fusions:[{name:'缺失来源',sources:['missing-course']}]},
    {cart:['YW-001'],fusions:[{name:'已移出来源',sources:['YW-001','YW-002']}]}
  ]) {
    const {app,store} = setup();
    store['course-market-cart-v2'] = JSON.stringify({...selection,orderNo:'KC-old',orderDate:'旧日期'});
    const a = app();
    assert.equal(a.st().orderNo,''); assert.equal(a.st().orderDate,'');
    assert.equal(a.stateOfHash('#receipt').screen,'checkout');
  }
});
test('restore accepts current terms and drops expired terms to the default', () => {
  const {app,store} = setup();
  const current = app().termOptions(new Date())[0];
  for (const term of [current,'2000年秋季学期','']) {
    store['course-market-cart-v2'] = JSON.stringify({cart:['YW-001'],school:{name:'学校',term},orderNo:'KC-saved',orderDate:'日期'});
    const a = app();
    assert.equal(a.st().school.term,term === current ? current : '');
    assert.equal(a.st().school.name,'学校');
    assert.equal(a.st().orderNo,term && term !== current ? '' : 'KC-saved');
  }
});
test('removed cart sources are pruned without discarding fusion ideas, including on reload', () => {
  const {app,store} = setup(), a = app();
  a.setState({cart:['YW-001','YW-002'],fusions:[{id:'f',name:'保留想法',sources:['YW-001','YW-002']}]});
  a.renderVals().cartItems[0].remove(); assert.deepEqual(Array.from(a.st().fusions[0].sources),['YW-002']);
  a.renderVals().cartItems[0].remove(); assert.equal(a.st().fusions[0].sources.length,0);
  store['course-market-cart-v2'] = JSON.stringify({cart:[],fusions:[{name:'旧记录',sources:['YW-001']}]});
  assert.equal(app().st().fusions[0].sources.length,0);
});
test('floor names are searchable, empty and unmatched searches remain valid', () => {
  const {app} = setup(), a = app(); const total = a.renderVals().matchCount;
  a.setState({q:'语言馆'}); assert.ok(a.renderVals().matchCount>0); assert.ok(a.renderVals().visible.every(c=>c.floorName==='语言馆'));
  a.setState({q:'不存在的课程xyz'}); assert.equal(a.renderVals().matchCount,0);
  a.setState({q:''}); assert.equal(a.renderVals().matchCount,total);
});
test('shelf navigation retains expanded items and captures scroll for restoration', () => {
  const {app} = setup(), a = app(); a.renderVals().loadMore(); const count = a.renderVals().visibleCount;
  a.renderVals().goCart(); assert.equal(a._shelfScroll,5300); a.renderVals().goBrowse();
  assert.equal(a._restoreShelf,true); assert.equal(a.renderVals().visibleCount,count);
  assert.match(html,/requestAnimationFrame\(function \(\) \{ window.scrollTo\(0, y\)/);
});
test('offline query navigations use the scoped cached shell; uncached assets still fail', async () => {
  const sw = fs.readFileSync('sw.js','utf8'); const requests=[]; const shell={ok:true};
  const context={URL,self:{location:{href:'https://example.test/site/sw.js'},addEventListener(){}},fetch:async()=>{throw Error('offline');},caches:{match:async r=>{requests.push(r);return typeof r==='string' ? shell : undefined;}}};
  vm.runInNewContext(sw,context);
  assert.equal(await context.networkFirst({mode:'navigate',url:'https://example.test/site/?from=singlemessage'}),shell);
  assert.equal(requests[0],'https://example.test/site/index.html');
  await assert.rejects(context.networkFirst({mode:'cors'}),/offline/);
});
test('mobile receipt stacks all six labelled cells only on screen, leaving print tables intact', () => {
  const css=fs.readFileSync('assets/design-responsive.css','utf8');
  assert.match(css,/@media screen and \(max-width: 560px\)/);
  assert.match(css,/\.receipt-scroll table \{ min-width: 0; \}/);
  assert.match(css,/\.receipt-scroll tbody, \.receipt-scroll tr, \.receipt-scroll td \{ display: block; \}/);
  assert.match(css,/nth-child\(6\)::before \{ content: '学校想法与调整'/);
});
