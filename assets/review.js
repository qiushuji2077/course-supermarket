/* Local-only course deliberation. All course facts stay in courses.js. */
(() => {
  'use strict';
  const app = window.CourseSupermarket;
  const core = window.CourseCatalogCore;
  if (!app || !core) return;
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const picks = new Set();
  const drawer = document.querySelector('#selectionDrawer');
  const panel = document.createElement('section');
  panel.className = 'review-tools';
  panel.setAttribute('aria-label', '书篮研讨与备份');
  panel.innerHTML = `
    <p class="review-eyebrow">从选中，到想清楚</p>
    <h3>一起看看，哪几门适合这所学校。</h3>
    <p class="review-help" id="compareHelp">勾选 2–4 门课程并排比较。研讨单包含书篮里的全部课程，可用浏览器打开、打印。</p>
    <div class="review-tool-actions">
      <button type="button" class="secondary-button" id="compareCourses" disabled>并排比较（0/4）</button>
      <button type="button" class="secondary-button" id="downloadDiscussion" disabled>下载研讨单</button>
    </div>
    <div class="review-backup-actions">
      <button type="button" class="text-button" id="backupSelection" disabled>备份书篮</button>
      <button type="button" class="text-button" id="restoreSelection">导入书篮备份</button>
      <input type="file" id="backupFile" accept=".json,application/json" hidden />
    </div>
    <p class="review-storage" id="storageNotice" role="status"></p>
    <p class="review-privacy">书篮与想法仅保存在本机浏览器。备份和研讨单会包含你填写的想法，分享前请自行检查。</p>
  `;
  document.querySelector('#selectionSummary').after(panel);
  const compareButton = panel.querySelector('#compareCourses');
  const discussionButton = panel.querySelector('#downloadDiscussion');
  const backupButton = panel.querySelector('#backupSelection');
  const fileInput = panel.querySelector('#backupFile');
  const storageNotice = panel.querySelector('#storageNotice');

  const dialog = document.createElement('dialog');
  dialog.className = 'review-dialog';
  dialog.setAttribute('aria-labelledby', 'reviewTitle');
  dialog.setAttribute('aria-describedby', 'reviewDescription');
  dialog.innerHTML = `
    <div class="review-dialog-head">
      <div><p class="review-eyebrow">选课共议</p><h2 id="reviewTitle">把课程放在一起，把选择想得更清楚。</h2></div>
      <button type="button" class="icon-button" id="closeReview">返回书篮</button>
    </div>
    <p class="review-description" id="reviewDescription">对照公开目录里的学段、意图与做法。学校想法可直接填写，不给课程打分。</p>
    <p class="review-swipe">在手机上可左右滑动对照表，查看其他课程。</p>
    <div class="review-table-wrap" role="region" aria-label="课程对照，可横向滚动" tabindex="0"><table class="review-table" id="reviewTable"></table></div>
    <p class="review-storage" id="reviewStorageNotice" role="status"></p>
    <p class="review-footnote">还需要共议：适用年级、场地与材料、负责教师、首次试教安排，以及想观察的学生表现。具体课时与资源需另行确认。</p>
    <button type="button" class="primary-button" id="reviewDownload">下载整个书篮的研讨单</button>
  `;
  document.body.append(dialog);
  dialog.querySelector('#closeReview').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => { app.openSelection(); compareButton.focus({ preventScroll: true }); });

  function sync() {
    const selected = app.selectedCourses();
    const ids = new Set(selected.map((course) => course.id));
    for (const id of picks) if (!ids.has(id)) picks.delete(id);
    compareButton.textContent = `并排比较（${picks.size}/4）`;
    compareButton.disabled = picks.size < 2;
    discussionButton.disabled = backupButton.disabled = selected.length === 0;
    const available = app.storageAvailable();
    const notice = available
      ? '已保存在本机。清理浏览器数据会移除书篮，换设备前请下载备份。'
      : '本次修改暂未写入本机，当前页面仍可继续使用。关闭前请下载书篮备份，避免丢失。';
    if (storageNotice.textContent !== notice) storageNotice.textContent = notice;
    storageNotice.classList.toggle('is-warning', !available);
    const dialogNotice = dialog.querySelector('#reviewStorageNotice');
    if (dialogNotice.textContent !== notice) dialogNotice.textContent = notice;
    dialogNotice.classList.toggle('is-warning', !available);
  }

  function refresh() {
    sync();
    drawer.querySelectorAll('.selection-item').forEach((item) => {
      if (item.querySelector('[data-compare]')) return;
      const course = app.data.courses.find((row) => row.id === item.dataset.courseId);
      if (!course) return;
      const label = document.createElement('label');
      label.className = 'compare-choice';
      label.innerHTML = `<input type="checkbox" data-compare="${esc(course.id)}" ${picks.has(course.id) ? 'checked' : ''} aria-label="加入比较：${esc(course.title)}" aria-describedby="compareHelp" />加入比较`;
      item.prepend(label);
    });
  }

  drawer.addEventListener('change', (event) => {
    const checkbox = event.target.closest('[data-compare]');
    if (!checkbox) return;
    const id = checkbox.dataset.compare;
    if (checkbox.checked && picks.size >= 4) {
      checkbox.checked = false;
      app.showToast('一次比较 2–4 门课程，请先取消其中一门。');
      return;
    }
    if (checkbox.checked) picks.add(id); else picks.delete(id);
    sync();
  });

  function openComparison() {
    const courses = app.selectedCourses().filter((course) => picks.has(course.id));
    if (courses.length < 2 || courses.length > 4) return;
    const notes = app.getSelection();
    const cell = (label, render) => `<tr><th scope="row">${label}</th>${courses.map((course) => `<td>${render(course)}</td>`).join('')}</tr>`;
    dialog.querySelector('#reviewTable').innerHTML = `
      <caption class="sr-only">${courses.length} 门课程的公开信息与学校想法</caption>
      <thead><tr><th scope="col">一起看什么</th>${courses.map((course) => `<th scope="col"><span class="review-id">${esc(course.id)}</span><h3>${esc(course.title)}</h3></th>`).join('')}</tr></thead>
      <tbody>
        ${cell('学段与方向', (course) => `${esc(course.stage)}<br>${esc(course.subject)} / ${esc(course.theme)}`)}
        ${cell('课程意图与内容', (course) => esc(course.summary) || '公开目录暂未说明')}
        ${cell('主要做法', (course) => course.practices?.length ? `<ul>${course.practices.map((item) => `<li>${esc(item)}</li>`).join('')}</ul>` : '公开目录暂未说明')}
        ${cell('关联学科', (course) => esc((course.relatedSubjects || []).join('、')) || '公开目录暂未说明')}
        ${cell('学校的想法', (course) => `<label class="sr-only" for="review-note-${esc(course.id)}">${esc(course.title)}：学校的想法</label><textarea id="review-note-${esc(course.id)}" data-review-note="${esc(course.id)}" maxlength="${core.NOTE_LIMIT}" placeholder="为什么适合本校？准备从哪里试起？">${esc(notes[course.id]?.note)}</textarea>`)}
      </tbody>
    `;
    app.closeSelection({ restoreFocus: false });
    if (!dialog.open) dialog.showModal();
  }
  compareButton.addEventListener('click', openComparison);
  dialog.addEventListener('input', (event) => {
    if (event.target.matches('[data-review-note]')) app.setNote(event.target.dataset.reviewNote, event.target.value);
  });

  function download(text, name, type) {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const dateStamp = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  };
  function downloadDiscussion() {
    const courses = app.selectedCourses();
    if (!courses.length) return;
    download(core.discussionHTML(courses, app.getSelection()), `课程超市_选课研讨单_${dateStamp()}.html`, 'text/html;charset=utf-8');
    app.showToast('已发起研讨单下载，包含整个书篮。');
  }
  discussionButton.addEventListener('click', downloadDiscussion);
  dialog.querySelector('#reviewDownload').addEventListener('click', downloadDiscussion);
  backupButton.addEventListener('click', () => {
    download(core.makeBackup(app.getSelection(), app.data.courses, app.data.meta.generatedAt), `课程超市_书篮备份_${dateStamp()}.json`, 'application/json;charset=utf-8');
    app.showToast('已发起书篮备份下载，分享前请检查其中的想法。');
  });
  panel.querySelector('#restoreSelection').addEventListener('click', () => { fileInput.value = ''; fileInput.click(); });
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    try {
      if (file.size > core.BACKUP_LIMIT) throw new Error('备份文件过大，请选择 2 MB 以内的书篮备份。');
      const parsed = core.parseBackup(await file.text(), app.data.courses);
      const count = Object.keys(parsed.selection).length;
      if (!count) throw new Error(`没有可导入的课程${parsed.unknown ? `，${parsed.unknown} 条编号已不在当前目录` : ''}。当前书篮没有改变。`);
      const preview = core.mergeSelection(app.getSelection(), parsed.selection, app.data.courses);
      const message = [`发现 ${count} 门有效课程，将新增 ${preview.added} 门。`, '现有书篮会保留；同一课程已有的想法优先保留。'];
      if (preview.conflicts) message.push(`${preview.conflicts} 条想法不同，将保留当前文字。`);
      if (parsed.unknown) message.push(`${parsed.unknown} 条编号不在当前目录，将跳过。`);
      if (!window.confirm(message.join('\n') + '\n确认导入？')) return;
      const merged = app.importSelection(parsed.selection);
      app.showToast(`已导入：新增 ${merged.added} 门${merged.conflicts ? `，保留 ${merged.conflicts} 条已有想法` : ''}${parsed.unknown ? `，跳过 ${parsed.unknown} 条旧编号` : ''}。`);
    } catch (error) {
      app.showToast(error instanceof Error ? error.message : '导入未完成，当前书篮没有改变。');
    } finally {
      fileInput.value = '';
    }
  });
  window.CourseReview = Object.freeze({ refresh, sync });
  refresh();
})();
