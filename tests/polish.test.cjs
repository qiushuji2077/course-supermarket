const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const html=fs.readFileSync('index.html','utf8');
const sw=fs.readFileSync('sw.js','utf8');
const ctx={window:{}};
vm.runInNewContext(fs.readFileSync('assets/design-catalog.js','utf8'),ctx);
vm.runInNewContext(fs.readFileSync('assets/forum-catalog.js','utf8'),ctx);
const forum=ctx.window.COURSE_MARKET_FORUM;
const code=html.match(/<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/)[1];
function app(){
 class DCLogic{constructor(){this.state={};this.props={};}setState(n){this.state={...this.state,...n};}}
 const context={window:{...ctx.window,scrollTo(){}},localStorage:{getItem(){return null;},setItem(){}},DCLogic,Date,Math,setTimeout(){}};
 vm.runInNewContext(code+'\nthis.Component=Component;',context);return new context.Component();
}

test('search matches every space-separated keyword and can be cleared in one step',()=>{
 const a=app();const total=a.renderVals().matchCount;
 assert.equal(a.renderVals().hasFilters,false);
 a.setState({q:'阅读'});const one=a.renderVals().matchCount;
 a.setState({q:'阅读  小学'});const v=a.renderVals();
 assert.ok(v.matchCount>0&&v.matchCount<=one&&one<total);assert.equal(v.hasFilters,true);
 const text=c=>[c.code,c.name,c.subject,c.intro,c.grade].concat(c.steps).join(' ');
 const expected=a.db().courses.filter(c=>text(c).includes('阅读')&&text(c).includes('小学')).length;
 assert.equal(v.matchCount,expected);
 a.setState({q:'  '});assert.equal(a.renderVals().matchCount,total);assert.equal(a.renderVals().hasFilters,false);
 a.setState({q:'阅读',stage:'primary',updatedOnly:true});a.renderVals().showAllCourses();
 const cleared=a.renderVals();assert.equal(cleared.matchCount,total);assert.equal(cleared.hasFilters,false);
});

test('term choices follow the current date instead of a fixed school year',()=>{
 const a=app();
 assert.deepEqual([...a.termOptions(new Date(2026,10,19))],['2026年秋季学期','2027年春季学期','2026-2027学年']);
 assert.deepEqual([...a.termOptions(new Date(2027,2,1))],['2027年春季学期','2027年秋季学期','2027-2028学年']);
 assert.deepEqual([...a.termOptions(new Date(2027,7,1))],['2027年秋季学期','2028年春季学期','2027-2028学年']);
 assert.ok(!/'2026年秋季学期'/.test(code));
});

test('address hash maps to steps and course details without trusting unknown values',()=>{
 const a=app();const ref=Object.keys(forum.references)[0];
 assert.equal(a.routeOf({screen:'browse',detail:null}),'');
 assert.equal(a.routeOf({screen:'cart',detail:null}),'#cart');
 assert.equal(a.routeOf({screen:'browse',detail:'YW-001'}),'#course=YW-001');
 assert.deepEqual({...a.stateOfHash('#course=YW-001')},{screen:'browse',detail:'YW-001'});
 assert.deepEqual({...a.stateOfHash('#course='+ref)},{screen:'browse',detail:ref});
 assert.deepEqual({...a.stateOfHash('#course=NOPE-999')},{screen:'browse',detail:null});
 assert.deepEqual({...a.stateOfHash('#course=%E0%A4%A')},{screen:'browse',detail:null});
 assert.deepEqual({...a.stateOfHash('#checkout')},{screen:'checkout',detail:null});
 assert.deepEqual({...a.stateOfHash('#receipt')},{screen:'checkout',detail:null});
 assert.deepEqual({...a.stateOfHash('#anything')},{screen:'browse',detail:null});
 assert.deepEqual({...a.stateOfHash('')},{screen:'browse',detail:null});
 a.setState({cart:['YW-001'],school:{name:'示例学校',contact:'',phone:'',term:'',vision:''}});a.renderVals().submit();
 assert.deepEqual({...a.stateOfHash('#receipt')},{screen:'receipt',detail:null});
});

test('copied receipt text carries the same selection, notes and local-only statement',()=>{
 const a=app();const enriched=Object.keys(forum.enrichments)[0];
 assert.equal(a.renderVals().receiptText,'');
 a.setState({cart:['YW-001',enriched],notes:{'YW-001':'改为每周一节'},school:{name:'示例学校',contact:'',phone:'',term:'',vision:''}});
 a.renderVals().submit();const v=a.renderVals(),t=v.receiptText;
 assert.ok(t.includes('回执编号：'+v.orderNo));assert.ok(t.includes('学校名称：示例学校'));
 for(const r of v.receiptRows){assert.ok(t.includes('['+r.code+'] '+r.name));}
 assert.ok(t.includes('改为每周一节'));assert.match(t,/未经试教的教学推演/);
 assert.ok(t.includes('本次未设置融合课程'));assert.match(t,/本机生成，未向任何服务器发送/);
 assert.ok(!/已发送|已提交/.test(t));
});

test('release marker, service-worker cache and stylesheet version move together',()=>{
 const release=html.match(/data-release="([^"]+)"/)[1];
 assert.equal(sw.match(/SHELF_VERSION = '([^']+)'/)[1],release);
 const css=html.match(/design-responsive\.css\?v=([\w-]+)/)[1];
 assert.ok(sw.includes('./assets/design-responsive.css?v='+css));
});
