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
 for(const id of ['toString','constructor','__proto__','hasOwnProperty']){a.setState(a.stateOfHash('#course='+id));assert.equal(a.st().detail,null,id);assert.equal(a.renderVals().detailOpen,false);}
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

test('courses with step-by-step plans are ranked first by default and can be filtered or re-sorted',()=>{
 const a=app();const ids=new Set(Object.keys(forum.enrichments));
 a.setState({limit:9999});let v=a.renderVals();
 assert.equal(v.sort,'plan');assert.equal(v.planCount,ids.size);assert.equal(v.matchCount,a.db().courses.length);
 const order=v.visible.map(c=>c.id);
 assert.ok(order.slice(0,ids.size).every(id=>ids.has(id)));assert.ok(order.slice(ids.size).every(id=>!ids.has(id)));
 const rest=order.slice(ids.size),shelf=a.db().courses.map(c=>c.id).filter(id=>!ids.has(id));
 assert.deepEqual(rest,shelf);
 for(const c of v.visible)assert.equal(c.hasEnrichment,ids.has(c.id));
 v.toggleSort();a.setState({limit:9999});v=a.renderVals();
 assert.equal(v.sort,'code');assert.deepEqual(v.visible.map(c=>c.id),a.db().courses.map(c=>c.id));
 v.togglePlanOnly();a.setState({limit:9999});v=a.renderVals();
 assert.equal(v.planOnlyPressed,'true');assert.equal(v.matchCount,ids.size);assert.equal(v.hasFilters,true);
 v.togglePlanOnly();assert.equal(a.renderVals().planOnlyPressed,'false');
 a.setState({q:'阅读',sort:'plan',limit:9999});v=a.renderVals();
 const firstPlain=v.visible.findIndex(c=>!c.hasEnrichment);
 assert.ok(v.visible.slice(firstPlain<0?v.visible.length:firstPlain).every(c=>!c.hasEnrichment));
 assert.match(html,/class="plan-badge"[^>]*未经试教/);
});

test('release marker, service-worker cache and stylesheet version move together',()=>{
 const release=html.match(/data-release="([^"]+)"/)[1];
 assert.equal(sw.match(/SHELF_VERSION = '([^']+)'/)[1],release);
 const css=html.match(/design-responsive\.css\?v=([\w-]+)/)[1];
 assert.ok(sw.includes('./assets/design-responsive.css?v='+css));
});
