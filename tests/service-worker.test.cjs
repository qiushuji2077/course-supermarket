'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../sw.js'), 'utf8');
const scope = 'https://example.test/course-supermarket/';
function harness({ keys = [], cached, fetcher = async () => new Response('fresh'), putFails = false } = {}) {
  const handlers = {}; const removed = []; const precached = [];
  const cache = { addAll: async (items) => precached.push(...items), match: async () => cached, put: async () => { if (putFails) throw new Error('full'); } };
  const self = { registration: { scope }, location: { origin: 'https://example.test' }, clients: { claim: async () => {} }, skipWaiting: async () => {}, addEventListener: (name, callback) => { handlers[name] = callback; } };
  vm.runInNewContext(source, { self, caches: { keys: async () => keys, delete: async (key) => removed.push(key), open: async () => cache }, fetch: fetcher, URL, Response });
  return { handlers, removed, precached };
}
test('cache cleanup never removes other projects or other scopes', async () => {
  const prefix = 'course-supermarket:' + scope + ':';
  const h = harness({ keys: ['other-app-v1', 'cs-legacy', prefix + 'old', prefix + '20260910a', 'course-supermarket:https://example.test/another/:old'] });
  let promise; h.handlers.activate({ waitUntil(value) { promise = value; } }); await promise;
  assert.deepEqual(h.removed, [prefix + 'old']);
});
test('offline shell includes every local script and stylesheet loaded by HTML', async () => {
  const h = harness(); let promise; h.handlers.install({ waitUntil(value) { promise = value; } }); await promise;
  const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  const assets = [...html.matchAll(/(?:src|href)="(\.\/assets\/[^" ]+\.(?:js|css)(?:\?[^" ]+)?)"/g)].map((match) => match[1]);
  for (const asset of assets) assert.ok(h.precached.includes(asset), asset);
});
test('offline course requests return this scope cached response', async () => {
  const h = harness({ cached: new Response('cached'), fetcher: async () => { throw new Error('offline'); } });
  let promise; h.handlers.fetch({ request: { method: 'GET', mode: 'cors', url: scope + 'assets/courses.js?v=20260906a' }, respondWith(value) { promise = value; } });
  assert.equal(await (await promise).text(), 'cached');
});
test('HTTP errors can fall back to the cached catalogue', async () => {
  const h = harness({ cached: new Response('cached'), fetcher: async () => new Response('unavailable', { status: 503 }) });
  let promise; h.handlers.fetch({ request: { method: 'GET', mode: 'cors', url: scope + 'assets/courses.js?v=20260906a' }, respondWith(value) { promise = value; } });
  assert.equal(await (await promise).text(), 'cached');
});
test('a full cache does not hide a successful response', async () => {
  const h = harness({ putFails: true }); let promise;
  h.handlers.fetch({ request: { method: 'GET', mode: 'cors', url: scope + 'assets/courses.js?v=20260906a' }, respondWith(value) { promise = value; } });
  assert.equal(await (await promise).text(), 'fresh');
});
test('out-of-scope, external and non-GET requests are untouched', () => {
  const h = harness();
  for (const request of [{ method: 'POST', url: scope }, { method: 'GET', url: 'https://elsewhere.test/' }, { method: 'GET', url: 'https://example.test/another/app.js' }]) {
    h.handlers.fetch({ request, respondWith() { assert.fail('unexpected interception'); } });
  }
});
