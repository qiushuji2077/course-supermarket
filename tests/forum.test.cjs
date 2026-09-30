const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const crypto = require('node:crypto');
const html=fs.readFileSync('index.html','utf8');
const raw=fs.readFileSync('assets/design-catalog.js','utf8');
const forumText=fs.readFileSync('assets/forum-catalog.js','utf8');
const ctx={window:{}};vm.runInNewContext(raw,ctx);vm.runInNewContext(forumText,ctx);
const original=ctx.window.COURSE_MARKET_CATALOG,forum=ctx.window.COURSE_MARKET_FORUM;
const all=original.concat(forum.additions);
const code=html.match(/<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/)[1];
function app(missing=false){
 class DCLogic{constructor(){this.state={};this.props={};}setState(n){this.state={...this.state,...n};}}
 const context={window:{...ctx.window,scrollTo(){}},localStorage:{getItem(){return null;},setItem(){}},DCLogic,Date,Math};
 if(missing)delete context.window.COURSE_MARKET_FORUM;
 vm.runInNewContext(code+'\nthis.Component=Component;',context);return new context.Component();
}
test('original 612 records stay byte-identical and additions have unique valid IDs',()=>{
 assert.equal(crypto.createHash('sha256').update(raw).digest('hex'),'0e67f653b5c9605612b20b9821610e22a1920c666d2ca42f4afba0f150fc3005');
 assert.equal(original.length,612);assert.equal(new Set(all.map(c=>c[2])).size,all.length);
 for(const c of all){assert.equal(c.length,10);assert.ok(c.slice(0,9).every(x=>typeof x==='string'&&x.trim()));assert.match(c[2],/^[A-Z]{2}-\d{3}$/);assert.ok(Array.isArray(c[9]));assert.equal(c[9].length,3);}
});
test('all forum records have explicit evidence boundary and complete proposed teaching plans',()=>{
 assert.equal(Object.keys(forum.enrichments).length+Object.keys(forum.references).length,38);assert.equal(forum.additions.length,Object.keys(forum.enrichments).length-1);
 const required=['suitableGrades','prerequisites','duration'];
 const expansions=Object.entries(forum.enrichments).concat(Object.entries(forum.references).map(([id,r])=>[id,r.enrichment]));
 for(const [id,e]of expansions){
  assert.ok(all.some(c=>c[2]===id)||forum.references[id]);assert.ok(e.originalBrief);assert.ok(e.evidenceBoundary);assert.equal(e.hasVerified,e.verifiedPractice.length>0);assert.equal(e.noVerified,!e.hasVerified);
  for(const k of required)assert.ok(typeof e.plan[k]==='string'&&e.plan[k].trim(),id+':'+k);
  for(const k of ['objectives','studentTasks','materials','steps','assessment','safety','adaptation'])assert.ok(Array.isArray(e.plan[k])&&e.plan[k].length>0,id+':'+k);
  for(const x of e.plan.steps){assert.ok(x.title);assert.ok(x.activity);assert.ok(x.minutes);}
 }
 assert.match(html,/教学推演 · 未经试教/);assert.match(html,/不是原学校已实施的完整教案/);
});
test('24 sections form a complete navigable index without orphan links',()=>{
 assert.equal(forum.sections.length,24);assert.equal(new Set(forum.sections.map(s=>s.id)).size,24);
 for(const section of forum.sections){assert.ok(section.title);assert.ok(section.summary);assert.ok(Array.isArray(section.practices));for(const id of section.courseIds)assert.ok(forum.enrichments[id]);for(const id of section.referenceIds)assert.ok(forum.references[id]);}
 for(const id of Object.keys(forum.enrichments))assert.ok(forum.sections.some(s=>s.courseIds.includes(id)),id);
 for(const id of Object.keys(forum.references))assert.ok(forum.sections.some(s=>s.referenceIds.includes(id)),id);
});
test('public payload excludes evidence files, source URLs and private metadata',()=>{
 assert.ok(!/https?:\/\/|drive\.google|internalSource|sourceIds|"sources"|workspace\/|file_id|researchId/.test(forumText));
});
test('new-data filter, section filter, search and details expose the same records',()=>{
 const a=app();a.renderVals().showForumOnly();let v=a.renderVals();assert.equal(v.matchCount,Object.keys(forum.enrichments).length);
 for(const section of forum.sections.filter(s=>s.courseIds.length)){
  a.renderVals().forumSections.find(s=>s.id===section.id).pick();assert.equal(a.renderVals().matchCount,section.courseIds.length);
 }
 a.renderVals().showAllCourses();const id=forum.additions[0][2];a.setState({q:id.toLowerCase()});v=a.renderVals();assert.equal(v.matchCount,1);v.visible[0].open();assert.equal(a.renderVals().detail.hasEnrichment,true);assert.ok(a.renderVals().detail.enrichment.plan.steps.length>0);
});
test('new records work in cart, local receipt and refresh lookup',()=>{
 const a=app(),id=forum.additions[0][2];a.setState({q:id});a.renderVals().visible[0].toggle();assert.equal(a.renderVals().cartCount,1);a.renderVals().onSchoolName({target:{value:'测试学校'}});a.renderVals().submit();assert.equal(a.renderVals().isReceipt,true);assert.equal(a.renderVals().receiptRows[0].code,id);
});
test('extension load failure preserves original catalog and shows a warning',()=>{
 const a=app(true),v=a.renderVals();assert.equal(v.courseTotal,612);assert.equal(v.forumUnavailable,true);assert.match(html,/更新资料未能加载/);
});
test('new assets use cache-busted versions and network-first offline update',()=>{
 const sw=fs.readFileSync('sw.js','utf8');assert.match(sw,/20260930-forum-v1/);assert.match(sw,/forum-catalog/);assert.ok(sw.includes("key.startsWith('cs-')"));assert.match(sw,/await cache.addAll/);assert.match(html,/forum-catalog\.js\?v=20260930-forum-v1/);
});

test('teacher references remain viewable without becoming student selections',()=>{
 const a=app();for(const [id,r]of Object.entries(forum.references)){a.setState({detail:id});const v=a.renderVals();assert.equal(v.detail.canSelect,false);assert.equal(v.detail.isReference,true);assert.equal(v.detail.name,r.title);assert.ok(v.detail.enrichment.plan.steps.length>0);assert.ok(!a.db().courses.some(c=>c.id===id));}
});
test('service-worker update completes new cache before activation and preserves unrelated caches',async()=>{
 const sw=fs.readFileSync('sw.js','utf8');
 async function check(fail){
  const events={},log=[],requests=[];
  const context={URL,Request,fetch:async()=>{},caches:{open:async()=>({addAll:async(rs)=>{requests.push(...rs.map(r=>r.url));log.push('cache');if(fail)throw Error('network failed');}}),keys:async()=>['cs-old','other-app','cs-20260930-forum-v1'],delete:async(k)=>log.push('delete:'+k)},self:{location:{href:'https://example.test/site/sw.js',origin:'https://example.test'},addEventListener:(k,v)=>events[k]=v,skipWaiting:async()=>log.push('takeover'),clients:{claim:async()=>log.push('claim')}}};
  vm.runInNewContext(sw,context);let pending;events.install({waitUntil:p=>pending=p});if(fail){await assert.rejects(pending,/network failed/);assert.ok(!log.includes('takeover'));return;}await pending;assert.deepEqual(log,['cache','takeover']);assert.ok(requests.includes('https://example.test/site/assets/forum-catalog.js?v=20260930-forum-v1'));events.activate({waitUntil:p=>pending=p});await pending;assert.ok(log.includes('delete:cs-old'));assert.ok(!log.includes('delete:other-app'));assert.ok(!log.includes('delete:cs-20260930-forum-v1'));
 }
 await check(false);await check(true);
});
test('all static assets referenced by the page exist',()=>{
 for(const m of html.matchAll(/(?:src|href)="\.\/([^"?]+)(?:\?[^"]*)?"/g))assert.ok(fs.existsSync(m[1]),m[1]);
});
