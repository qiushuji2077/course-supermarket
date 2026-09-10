/* Pure catalogue helpers. No network, DOM or course-content rewriting. */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CourseCatalogCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const NOTE_LIMIT = 4000;
  const BACKUP_LIMIT = 2 * 1024 * 1024;
  const STAGES = ['小学', '初中', '初高中', '九年一贯', '高中'];
  const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
  const noteText = (value) => typeof value === 'string' ? value.slice(0, NOTE_LIMIT) : '';
  const normalize = (value) => String(value ?? '').normalize('NFKC').toLowerCase().trim().replace(/\s+/g, ' ');

  function sanitizeSelection(value, courses) {
    const clean = Object.create(null);
    if (!isRecord(value)) return clean;
    const valid = new Set(courses.map((course) => course.id));
    for (const [id, item] of Object.entries(value)) {
      if (valid.has(id) && isRecord(item)) clean[id] = { note: noteText(item.note) };
    }
    return clean;
  }

  function loadSelection(getStorage, key, courses) {
    try {
      const raw = getStorage().getItem(key);
      return { selection: sanitizeSelection(raw ? JSON.parse(raw) : {}, courses), available: true };
    } catch {
      return { selection: Object.create(null), available: false };
    }
  }

  function saveSelection(getStorage, key, selection) {
    try {
      getStorage().setItem(key, JSON.stringify(selection));
      return true;
    } catch {
      return false;
    }
  }

  function searchIndex(courses) {
    return new Map(courses.map((course) => [course.id, normalize([
      course.id, course.subject, course.theme, course.title, course.subtitle,
      course.summary, ...(course.practices || []), ...(course.directions || []),
      ...(course.relatedSubjects || [])
    ].join(' '))]));
  }

  function matchingCourses(courses, state, options = {}) {
    const terms = normalize(state.query).split(' ').filter(Boolean);
    const index = options.index || searchIndex(courses);
    return courses.filter((course) => {
      if (state.problem && !(course.problems || []).includes(state.problem)) return false;
      if (state.mode === 'subject' && !options.ignoreSubject && course.subject !== state.subject) return false;
      if (state.mode === 'theme' && state.themeCluster && course.theme !== state.themeCluster) return false;
      if (!options.ignoreStage && state.stage && state.stage !== '全部' && course.stage !== state.stage) return false;
      if (state.mode === 'subject' && !options.ignoreThemeFilter && state.theme && course.theme !== state.theme) return false;
      return terms.every((term) => (index.get(course.id) || '').includes(term));
    });
  }

  function availableStages(courses, state, index) {
    const pool = matchingCourses(courses, state, { ignoreStage: true, ignoreThemeFilter: true, index });
    const found = new Set(pool.map((course) => course.stage));
    if (state.stage && state.stage !== '全部') found.add(state.stage);
    const order = [...STAGES, ...[...found].filter((stage) => !STAGES.includes(stage)).sort()];
    return ['全部', ...order.filter((stage) => found.has(stage))];
  }

  function makeBackup(selection, courses, generatedAt = '') {
    const clean = sanitizeSelection(selection, courses);
    return JSON.stringify({
      schema: 'course-supermarket-selection', version: 1,
      catalogGeneratedAt: generatedAt,
      items: Object.entries(clean).map(([id, value]) => ({ id, note: value.note }))
    }, null, 2);
  }

  function parseBackup(text, courses) {
    if (typeof text !== 'string' || text.length > BACKUP_LIMIT) throw new Error('备份文件过大，请选择 2 MB 以内的书篮备份。');
    let value;
    try { value = JSON.parse(text.replace(/^\uFEFF/, '')); }
    catch { throw new Error('无法读取这个文件，请选择课程超市导出的 JSON 备份。'); }
    if (!isRecord(value) || value.schema !== 'course-supermarket-selection' || value.version !== 1 || !Array.isArray(value.items)) {
      throw new Error('备份格式或版本不受支持，当前书篮没有改变。');
    }
    if (value.items.length > 5000) throw new Error('备份条目过多，当前书篮没有改变。');
    const valid = new Set(courses.map((course) => course.id));
    const selection = Object.create(null);
    let unknown = 0;
    for (const item of value.items) {
      if (!isRecord(item) || typeof item.id !== 'string' || typeof item.note !== 'string') throw new Error('备份中有不完整的条目，当前书篮没有改变。');
      if (item.note.length > NOTE_LIMIT) throw new Error(`单条想法超过 ${NOTE_LIMIT} 字，当前书篮没有改变。`);
      if (!valid.has(item.id)) { unknown += 1; continue; }
      if (Object.hasOwn(selection, item.id)) throw new Error('备份中有重复课程，当前书篮没有改变。');
      selection[item.id] = { note: item.note };
    }
    return { selection, unknown };
  }

  function mergeSelection(current, incoming, courses) {
    const selection = sanitizeSelection(current, courses);
    const cleanIncoming = sanitizeSelection(incoming, courses);
    let added = 0;
    let conflicts = 0;
    for (const [id, item] of Object.entries(cleanIncoming)) {
      if (!Object.hasOwn(selection, id)) { selection[id] = item; added += 1; }
      else if (!selection[id].note) selection[id].note = item.note;
      else if (item.note && selection[id].note !== item.note) conflicts += 1;
    }
    return { selection, added, conflicts };
  }

  function discussionText(courses, selection) {
    const lines = ['# 课程超市 · 选课研讨单', '', '以下课程信息沿用公开目录；学校想法由使用者填写。', '课程条目供研讨参考，课时、材料与具体教案需结合学校实际继续确认。', ''];
    for (const course of courses) {
      lines.push(`## ${course.id}｜${course.title}`, '', `学科：${course.subject}　主题：${course.theme}　学段：${course.stage}`, '');
      if (course.subtitle) lines.push(course.subtitle, '');
      lines.push('### 课程原文', '', course.summary || '', '');
      if (course.practices?.length) lines.push('### 主要做法', '', ...course.practices.map((item) => `- ${item}`), '');
      lines.push('### 学校的想法', '', noteText(selection[course.id]?.note) || '待共议', '', '### 下一步共议', '', '适用年级：待共议', '场地与材料：待共议', '负责教师：待共议', '首次试教安排：待共议', '想观察的学生表现：待共议', '', '---', '');
    }
    lines.push('请保留课程编号，便于后续沟通与定制。');
    return lines.join('\n');
  }


  function discussionHTML(courses, selection) {
    const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
    const questions = ['适用年级', '场地与材料', '负责教师', '首次试教安排', '想观察的学生表现'];
    return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>课程超市 · 选课研讨单</title>
<style>body{max-width:900px;margin:40px auto;padding:0 24px;color:#28241e;background:#faf8f3;font:16px/1.8 "PingFang SC","Microsoft YaHei",sans-serif}h1,h2,h3{font-family:"Songti SC",serif;line-height:1.5}header{border-bottom:2px solid #8c2a22;padding-bottom:24px}header p,.meta{color:#675f55}article{padding:30px 0;border-bottom:1px solid #d9cebc}h2 small{display:block;font:12px/1.8 monospace;color:#8c2a22}li{margin:10px 0}.note{white-space:pre-wrap;overflow-wrap:anywhere;padding:16px;background:#efe9dd}.next p{min-height:42px;border-bottom:1px dotted #d9cebc}button{font:inherit;padding:10px 18px;background:#8c2a22;color:white;border:0;cursor:pointer}@page{size:A4;margin:18mm}@media print{body{margin:0;padding:0;max-width:none;background:white;font-size:11pt}button{display:none}h2,h3{break-after:avoid}.next p{break-inside:avoid}article{padding:20px 0}}</style></head><body>
<header><p>从选中，到想清楚</p><h1>课程超市 · 选课研讨单</h1><p>共 ${courses.length} 门。课程信息沿用公开目录，学校想法由使用者填写。具体课时、材料与教案需结合学校实际继续确认。</p><button type="button" onclick="window.print()">打印或存为 PDF</button><p>本文件包含填写的想法，分享前请检查。文件可以离线阅读。</p></header>
${courses.map((course) => `<article><h2><small>${esc(course.id)}</small>${esc(course.title)}</h2><p class="meta">${esc(course.stage)} / ${esc(course.subject)} / ${esc(course.theme)}</p>${course.subtitle ? `<p>${esc(course.subtitle)}</p>` : ''}<h3>课程原文</h3><p>${esc(course.summary)}</p>${course.practices?.length ? `<h3>主要做法</h3><ul>${course.practices.map((item) => `<li>${esc(item)}</li>`).join('')}</ul>` : ''}<h3>学校的想法</h3><p class="note">${esc(noteText(selection[course.id]?.note) || '待共议')}</p><h3>下一步共议</h3><div class="next">${questions.map((question) => `<p>${question}：待共议</p>`).join('')}</div></article>`).join('')}
<footer><p>请保留课程编号，便于后续沟通与定制。</p></footer></body></html>`;
  }

  return Object.freeze({ NOTE_LIMIT, BACKUP_LIMIT, normalize, sanitizeSelection, loadSelection, saveSelection, searchIndex, matchingCourses, availableStages, makeBackup, parseBackup, mergeSelection, discussionText, discussionHTML });
});
