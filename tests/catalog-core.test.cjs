'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const core = require('../assets/catalog-core.js');
const root = path.join(__dirname, '..');
const context = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(root, 'assets/courses.js'), 'utf8'), context);
const data = JSON.parse(JSON.stringify(context.window.COURSE_SUPERMARKET_DATA));
const courses = data.courses;
const a = courses[0];
const b = courses[1];
const base = { mode: 'problem', problem: '', stage: '全部', query: '', theme: '', subject: '', themeCluster: '' };
const plain = (value) => JSON.parse(JSON.stringify(value));
const backup = (items) => JSON.stringify({ schema: 'course-supermarket-selection', version: 1, items });

test('catalogue totals and unique public IDs agree', () => {
  assert.equal(courses.length, data.meta.courseCount);
  assert.equal(new Set(courses.map((course) => course.id)).size, courses.length);
  assert.equal(new Set(courses.map((course) => course.theme)).size, data.meta.directionCount);
});
test('valid existing notes survive the storage migration', () => {
  assert.deepEqual(plain(core.sanitizeSelection({ [a.id]: { note: '先共备' } }, courses)), { [a.id]: { note: '先共备' } });
});
test('unknown course IDs are discarded', () => {
  assert.equal(Object.keys(core.sanitizeSelection({ UNKNOWN: { note: 'x' } }, courses)).length, 0);
});
test('malformed selection roots are safe', () => {
  for (const value of [null, [], false, 123, 'text']) assert.equal(Object.keys(core.sanitizeSelection(value, courses)).length, 0);
});
test('malformed per-course values are discarded', () => {
  for (const value of [null, [], 3, 'text']) assert.equal(Object.keys(core.sanitizeSelection({ [a.id]: value }, courses)).length, 0);
});
test('non-string notes become empty strings', () => {
  assert.equal(core.sanitizeSelection({ [a.id]: { note: {} } }, courses)[a.id].note, '');
});
test('legacy overlong notes are bounded', () => {
  assert.equal(core.sanitizeSelection({ [a.id]: { note: '课'.repeat(6000) } }, courses)[a.id].note.length, core.NOTE_LIMIT);
});
test('prototype keys cannot pollute selection', () => {
  const result = core.sanitizeSelection(JSON.parse('{"__proto__":{"polluted":true}}'), courses);
  assert.equal(Object.getPrototypeOf(result), null);
  assert.equal({}.polluted, undefined);
});
test('blocked localStorage reads do not throw', () => {
  const result = core.loadSelection(() => { throw new Error('SecurityError'); }, 'test', courses);
  assert.equal(result.available, false);
  assert.equal(Object.keys(result.selection).length, 0);
});
test('invalid JSON in storage does not crash', () => {
  assert.equal(core.loadSelection(() => ({ getItem: () => '{bad' }), 'test', courses).available, false);
});
test('quota errors return an explicit unsaved status', () => {
  assert.equal(core.saveSelection(() => ({ setItem() { throw new Error('QuotaExceededError'); } }), 'test', {}), false);
});
test('successful writes keep the existing storage format', () => {
  let stored;
  assert.equal(core.saveSelection(() => ({ setItem(key, value) { stored = value; } }), 'test', { [a.id]: { note: '共备' } }), true);
  assert.deepEqual(JSON.parse(stored), { [a.id]: { note: '共备' } });
});
test('an empty query returns the whole catalogue without needing a problem card', () => {
  assert.equal(core.matchingCourses(courses, base).length, courses.length);
});
test('course IDs can be searched case-insensitively', () => {
  assert.equal(core.matchingCourses(courses, { ...base, query: a.id.toLowerCase() })[0].id, a.id);
});
test('full-width input and extra spaces normalize consistently', () => {
  assert.equal(core.normalize('  ＡＩ　 阅读  '), 'ai 阅读');
});
test('multiple search terms use AND, across course fields', () => {
  const matches = core.matchingCourses(courses, { ...base, query: `${a.id} ${a.title}` });
  assert.equal(matches.length, 1);
  assert.equal(matches[0].id, a.id);
  assert.equal(core.matchingCourses(courses, { ...base, query: `${a.id} 不存在的词qzx` }).length, 0);
});
test('stage options remain available after choosing one stage', () => {
  const before = core.availableStages(courses, base);
  const after = core.availableStages(courses, { ...base, stage: '小学' });
  assert.deepEqual(after, before);
});
test('catalogue stage labels outside the old enum are discoverable', () => {
  const options = core.availableStages(courses, base);
  for (const stage of new Set(courses.map((course) => course.stage))) assert.ok(options.includes(stage));
});
test('zero-result search keeps the chosen stage visible', () => {
  assert.ok(core.availableStages(courses, { ...base, stage: '小学', query: 'no-such-query-zqx' }).includes('小学'));
});
test('subject, problem, theme and stage filters remain effective', () => {
  const result = core.matchingCourses(courses, { ...base, mode: 'subject', subject: a.subject, stage: a.stage, theme: a.theme, problem: a.problems[0] });
  assert.ok(result.some((course) => course.id === a.id));
  assert.ok(result.every((course) => course.subject === a.subject && course.stage === a.stage && course.theme === a.theme));
});
test('helper operations never mutate published catalogue content', () => {
  const snapshot = JSON.stringify(courses);
  core.searchIndex(courses); core.matchingCourses(courses, base); core.availableStages(courses, base);
  core.makeBackup({ [a.id]: { note: 'x' } }, courses); core.discussionText(courses.slice(0, 2), {});
  assert.equal(JSON.stringify(courses), snapshot);
});
test('backup contains IDs and user notes, not copied course descriptions', () => {
  const value = JSON.parse(core.makeBackup({ [a.id]: { note: '共议' } }, courses, data.meta.generatedAt));
  assert.deepEqual(Object.keys(value.items[0]).sort(), ['id', 'note']);
  assert.equal(core.parseBackup(JSON.stringify(value), courses).selection[a.id].note, '共议');
});
test('invalid backup JSON, root, schema and version are rejected', () => {
  for (const value of ['bad', 'null', '[]', '{}', '{"schema":"course-supermarket-selection","version":2,"items":[]}']) assert.throws(() => core.parseBackup(value, courses));
});
test('UTF-8 BOM is accepted', () => {
  assert.equal(core.parseBackup('\uFEFF' + backup([{ id: a.id, note: '' }]), courses).selection[a.id].note, '');
});
test('invalid or duplicate backup rows are rejected atomically', () => {
  for (const items of [[{ id: a.id, note: '' }, null], [{ id: a.id, note: 3 }], [{ id: a.id, note: '' }, { id: a.id, note: 'x' }]]) assert.throws(() => core.parseBackup(backup(items), courses));
});
test('unknown IDs are counted and skipped', () => {
  const value = core.parseBackup(backup([{ id: a.id, note: 'x' }, { id: 'OLD-ID', note: 'x' }]), courses);
  assert.equal(value.unknown, 1);
  assert.deepEqual(Object.keys(value.selection), [a.id]);
});
test('oversized backups and notes are rejected', () => {
  assert.throws(() => core.parseBackup('x'.repeat(core.BACKUP_LIMIT + 1), courses));
  assert.throws(() => core.parseBackup(backup([{ id: a.id, note: 'x'.repeat(core.NOTE_LIMIT + 1) }]), courses));
});
test('import merges without removing existing choices or overwriting notes', () => {
  const current = { [a.id]: { note: '当前想法' } };
  const result = core.mergeSelection(current, { [a.id]: { note: '另一个想法' }, [b.id]: { note: '新想法' } }, courses);
  assert.equal(result.added, 1); assert.equal(result.conflicts, 1);
  assert.equal(result.selection[a.id].note, '当前想法');
  assert.equal(result.selection[b.id].note, '新想法');
  assert.equal(Object.keys(current).length, 1);
});
test('import fills an empty note and preserves HTML as plain text', () => {
  const raw = '<img src=x onerror=alert(1)>';
  const result = core.mergeSelection({ [a.id]: { note: '' } }, { [a.id]: { note: raw } }, courses);
  assert.equal(result.selection[a.id].note, raw);
});
test('discussion export keeps original facts, IDs, and clearly unfilled planning fields', () => {
  const text = core.discussionText([a], { [a.id]: { note: '先讨论材料' } });
  for (const value of [a.id, a.title, a.summary, a.practices[0], '先讨论材料', '首次试教安排：待共议']) assert.ok(text.includes(value));
});
test('HTML loads helpers before app, and review afterwards', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.ok(html.indexOf('src="./assets/catalog-core.js') < html.indexOf('src="./assets/app.js'));
  assert.ok(html.indexOf('src="./assets/app.js') < html.indexOf('src="./assets/review.js'));
  assert.equal((html.match(/id="clearFilter"/g) || []).length, 1);
  assert.ok(!html.includes('location.reload()'));
});


test('HTML discussion export escapes course and note text and supports offline printing', () => {
  const course = { id: 'TEST', title: '<script>alert(1)</script>', stage: '小学', subject: '劳动', theme: '生活', summary: '<img src=x onerror=alert(1)>', practices: ['<b>original</b>'] };
  const html = core.discussionHTML([course], { TEST: { note: '</p><script>bad()</script>' } });
  assert.ok(html.startsWith('<!doctype html>'));
  assert.ok(html.includes('首次试教安排：待共议'));
  assert.ok(html.includes('window.print()'));
  assert.ok(html.includes('&lt;script&gt;bad()&lt;/script&gt;'));
  assert.ok(!html.includes('<script>'));
  assert.ok(!html.includes('<img'));
});
