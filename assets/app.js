(() => {
  'use strict';

  const data = window.COURSE_SUPERMARKET_DATA;
  if (!data) {
    document.body.innerHTML = '<main class="load-error"><strong>课程数据未能读取</strong><p>请刷新页面。如果问题仍然存在，请使用离线版。</p></main>';
    return;
  }

  const STORAGE_KEY = 'course-supermarket-selection-v1';
  const SHELF_COUNT = 5;
  const PREVIEW_PER_GROUP = 8;

  const themeIndex = buildThemeIndex();
  const state = {
    mode: 'problem',
    problem: '',
    subject: data.subjects[0]?.name || '',
    themeCluster: '',
    themeQuery: '',
    stage: '全部',
    theme: '',
    query: '',
    expandedAisles: new Set(),
    selection: loadSelection()
  };

  const els = {
    courseTotal: document.querySelector('#courseTotal'),
    directionTotal: document.querySelector('#directionTotal'),
    subjectTotal: document.querySelector('#subjectTotal'),
    updateTime: document.querySelector('#updateTime'),
    searchInput: document.querySelector('#searchInput'),
    themeSearch: document.querySelector('#themeSearch'),
    browse: document.querySelector('#browse'),
    problemGrid: document.querySelector('#problemGrid'),
    subjectGrid: document.querySelector('#subjectGrid'),
    themeGrid: document.querySelector('#themeGrid'),
    clearFilter: document.querySelector('#clearFilter'),
    themeSelectWrap: document.querySelector('#themeSelectWrap'),
    shelfTitle: document.querySelector('#shelfTitle'),
    departmentCode: document.querySelector('#departmentCode'),
    activeGuide: document.querySelector('#activeGuide'),
    resultCount: document.querySelector('#resultCount'),
    stageFilter: document.querySelector('#stageFilter'),
    themeFilter: document.querySelector('#themeFilter'),
    shelfUnit: document.querySelector('#shelfUnit'),
    selectionCount: document.querySelector('#selectionCount'),
    dockCount: document.querySelector('#dockCount'),
    openSelection: document.querySelector('#openSelection'),
    openSelectionBottom: document.querySelector('#openSelectionBottom'),
    cartDock: document.querySelector('#cartDock'),
    selectionDrawer: document.querySelector('#selectionDrawer'),
    drawerBackdrop: document.querySelector('#drawerBackdrop'),
    closeSelection: document.querySelector('#closeSelection'),
    continueShopping: document.querySelector('#continueShopping'),
    selectionSummary: document.querySelector('#selectionSummary'),
    selectionList: document.querySelector('#selectionList'),
    makeReceipt: document.querySelector('#makeReceipt'),
    courseDialog: document.querySelector('#courseDialog'),
    closeDialog: document.querySelector('#closeDialog'),
    dialogContent: document.querySelector('#dialogContent'),
    receiptDialog: document.querySelector('#receiptDialog'),
    closeReceipt: document.querySelector('#closeReceipt'),
    receiptContent: document.querySelector('#receiptContent'),
    downloadReceipt: document.querySelector('#downloadReceipt'),
    copyReceipt: document.querySelector('#copyReceipt'),
    printReceipt: document.querySelector('#printReceipt'),
    toast: document.querySelector('#toast'),
    printSheet: document.querySelector('#printSheet')
  };

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function buildThemeIndex() {
    const map = new Map();
    data.courses.forEach((course) => {
      if (!map.has(course.theme)) {
        map.set(course.theme, { name: course.theme, count: 0, subjects: new Set() });
      }
      const item = map.get(course.theme);
      item.count += 1;
      item.subjects.add(course.subject);
    });
    return [...map.values()]
      .map((item) => ({ ...item, subjects: [...item.subjects].sort((a, b) => a.localeCompare(b, 'zh-CN')) }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'zh-CN'));
  }

  function loadSelection() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      const validIds = new Set(data.courses.map((course) => course.id));
      return Object.fromEntries(Object.entries(saved).filter(([id]) => validIds.has(id)));
    } catch {
      return {};
    }
  }

  function saveSelection() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.selection));
    updateSelectionCount();
  }

  function selectedCourses() {
    const byId = new Map(data.courses.map((course) => [course.id, course]));
    return Object.keys(state.selection).map((id) => byId.get(id)).filter(Boolean);
  }

  function initMeta() {
    els.courseTotal.textContent = data.meta.courseCount;
    els.directionTotal.textContent = data.meta.directionCount;
    els.subjectTotal.textContent = data.meta.subjectCount;
    els.updateTime.textContent = `内容更新于 ${data.meta.generatedAt}`;
  }

  function problemDefinition() {
    return data.problems.find((item) => item.id === state.problem);
  }

  function themeDefinition() {
    return themeIndex.find((item) => item.name === state.themeCluster);
  }

  function coursesForProblem(problemId = state.problem) {
    return data.courses.filter((course) => !problemId || course.problems.includes(problemId));
  }

  function subjectCount(subject) {
    return matchingCourses({ ignoreSubject: true, ignoreThemeFilter: true })
      .filter((course) => course.subject === subject).length;
  }

  function setMode(mode, { scroll = true } = {}) {
    if (!['problem', 'subject', 'theme'].includes(mode)) return;
    state.mode = mode;
    if (mode !== 'problem') state.problem = '';
    if (mode !== 'theme') state.themeCluster = '';
    if (mode !== 'subject') state.theme = '';
    state.stage = '全部';
    state.expandedAisles = new Set();
    render();
    if (scroll) {
      const target = document.querySelector(`[data-panel="${mode}"]`) || els.browse;
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function syncModeButtons() {
    document.querySelectorAll('[data-mode]').forEach((button) => {
      const active = button.dataset.mode === state.mode;
      button.classList.toggle('active', active);
      if (button.parentElement?.classList.contains('mode-nav')) {
        button.setAttribute('aria-current', active ? 'page' : 'false');
      }
    });
    document.querySelectorAll('[data-panel]').forEach((panel) => {
      panel.hidden = panel.dataset.panel !== state.mode;
    });
    document.body.dataset.browseMode = state.mode;
    els.themeSelectWrap.hidden = state.mode !== 'subject';
  }

  function renderProblems() {
    els.problemGrid.innerHTML = data.problems.map((item, index) => `
      <button class="guide-card ${state.problem === item.id ? 'active' : ''}" style="--i:${index}" type="button" data-problem="${escapeHtml(item.id)}">
        <span class="guide-count">${item.count} 门相关课程</span>
        <h3>${escapeHtml(item.question)}</h3>
        <p>${escapeHtml(item.hint)}</p>
      </button>
    `).join('');
  }

  function renderSubjects() {
    els.subjectGrid.innerHTML = data.subjects.map((item) => {
      const count = subjectCount(item.name);
      return `
        <button class="aisle-card ${state.subject === item.name ? 'active' : ''}" type="button" data-subject="${escapeHtml(item.name)}" ${count === 0 ? 'disabled' : ''}>
          <span>${escapeHtml(item.code)}</span>
          <strong>${escapeHtml(item.name)}</strong>
          <small>${count} 门可选</small>
        </button>
      `;
    }).join('');
  }

  function visibleThemes() {
    const query = state.themeQuery.toLowerCase();
    return themeIndex.filter((item) => {
      if (state.problem && !data.courses.some((course) => course.theme === item.name && course.problems.includes(state.problem))) return false;
      if (!query) return true;
      const haystack = [item.name, ...item.subjects].join(' ').toLowerCase();
      return haystack.includes(query);
    });
  }

  function themeCard(item, index, size) {
    return `
      <button class="theme-card ${size} ${state.themeCluster === item.name ? 'active' : ''}" style="--i:${index % 16}" type="button" data-theme-name="${escapeHtml(item.name)}">
        <strong>${escapeHtml(item.name)}</strong>
        <span>${item.count} 门</span>
        <small>${escapeHtml(item.subjects.slice(0, 3).join('、'))}${item.subjects.length > 3 ? ' 等' : ''}</small>
      </button>
    `;
  }

  function renderThemes() {
    const themes = visibleThemes();
    if (!themes.length) {
      els.themeGrid.innerHTML = '<div class="theme-empty">没有相符的主题。换个词试试，或清除检索。</div>';
      return;
    }
    const featured = themes.filter((item) => item.count >= 5);
    const rest = themes.filter((item) => item.count < 5);
    els.themeGrid.innerHTML = `
      ${featured.length ? `<div class="theme-featured">${featured.map((item, index) => themeCard(item, index, item.count >= 8 ? 'theme-card-lg' : 'theme-card-md')).join('')}</div>` : ''}
      ${rest.length ? `${featured.length ? '<p class="theme-more-label">更多主题</p>' : ''}<div class="theme-chips">${rest.map((item, index) => themeCard(item, index, 'theme-card-sm')).join('')}</div>` : ''}
    `;
  }

  function matchingCourses({ ignoreSubject = false, ignoreThemeFilter = false } = {}) {
    return data.courses.filter((course) => {
      if (state.problem && !course.problems.includes(state.problem)) return false;
      if (state.mode === 'subject' && !ignoreSubject && course.subject !== state.subject) return false;
      if (state.mode === 'theme' && state.themeCluster && course.theme !== state.themeCluster) return false;
      if (state.stage !== '全部' && course.stage !== state.stage) return false;
      if (state.mode === 'subject' && !ignoreThemeFilter && state.theme && course.theme !== state.theme) return false;
      if (state.query) {
        const haystack = [course.id, course.subject, course.theme, course.title, course.subtitle, course.summary, ...course.practices, ...course.directions].join(' ').toLowerCase();
        if (!haystack.includes(state.query.toLowerCase())) return false;
      }
      return true;
    });
  }

  function availableStages() {
    const order = ['全部', '小学', '初中', '初高中', '九年一贯', '高中'];
    const pool = matchingCourses({ ignoreThemeFilter: true });
    const stages = new Set(pool.map((course) => course.stage));
    return order.filter((stage) => stage === '全部' || stages.has(stage));
  }

  function renderStageFilter() {
    if (!availableStages().includes(state.stage)) state.stage = '全部';
    els.stageFilter.innerHTML = availableStages().map((stage) => `
      <button type="button" class="${state.stage === stage ? 'active' : ''}" data-stage="${stage}">${stage}</button>
    `).join('');
  }

  function renderThemeFilter() {
    if (state.mode !== 'subject') return;
    const themes = [...new Set(matchingCourses({ ignoreThemeFilter: true }).map((course) => course.theme))].sort((a, b) => a.localeCompare(b, 'zh-CN'));
    if (state.theme && !themes.includes(state.theme)) state.theme = '';
    els.themeFilter.innerHTML = `<option value="">全部方向</option>${themes.map((theme) => `
      <option value="${escapeHtml(theme)}" ${state.theme === theme ? 'selected' : ''}>${escapeHtml(theme)}</option>
    `).join('')}`;
  }

  function distributeToShelves(courses) {
    const grouped = new Map();
    courses.forEach((course) => {
      if (!grouped.has(course.theme)) grouped.set(course.theme, []);
      grouped.get(course.theme).push(course);
    });
    const rows = Array.from({ length: SHELF_COUNT }, () => ({ themes: [], courses: [] }));
    [...grouped.entries()]
      .sort(([themeA, coursesA], [themeB, coursesB]) => coursesB.length - coursesA.length || themeA.localeCompare(themeB, 'zh-CN'))
      .forEach(([theme, items]) => {
        const target = rows.reduce((best, row) => row.courses.length < best.courses.length ? row : best, rows[0]);
        target.themes.push(theme);
        target.courses.push(...items.sort((a, b) => a.id.localeCompare(b.id)));
      });
    return rows;
  }

  function packClass(course) {
    return `pack-${[...course.id].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 7}`;
  }

  function productCard(course, index, variant = '') {
    const selected = Boolean(state.selection[course.id]);
    return `
      <article class="product-card ${packClass(course)} ${selected ? 'selected' : ''} ${variant}" style="--i:${index % 12}" data-course-id="${course.id}" tabindex="0" aria-label="${escapeHtml(`${course.id} ${course.title}`)}">
        <div class="product-top">
          <span class="product-id">${course.id}</span>
          <span class="product-badge">${escapeHtml(course.stage)}</span>
        </div>
        <p class="product-theme">${escapeHtml(course.subject)} · ${escapeHtml(course.theme)}</p>
        <h3>${escapeHtml(course.title)}</h3>
        <p class="product-summary">${escapeHtml(course.summary)}</p>
        <div class="product-bottom">
          <span class="barcode" aria-hidden="true"></span>
          <button class="put-button ${selected ? 'selected' : ''}" type="button" data-action="select">${selected ? '已入篮' : '放入书篮 >'}</button>
        </div>
      </article>
    `;
  }

  function groupBySubject(courses) {
    const grouped = new Map();
    courses.forEach((course) => {
      if (!grouped.has(course.subject)) grouped.set(course.subject, []);
      grouped.get(course.subject).push(course);
    });
    return data.subjects
      .map((item) => ({ name: item.name, code: item.code, courses: grouped.get(item.name) || [] }))
      .filter((item) => item.courses.length);
  }

  function renderGuidedAisle(courses) {
    const groups = groupBySubject(courses);
    if (!groups.length) {
      els.shelfUnit.innerHTML = '<div class="empty-state"><strong>这批条件里没有课程</strong><p>换一个问题、主题或学段，或者清除已选条件。</p></div>';
      return;
    }
    els.shelfUnit.innerHTML = `
      <div class="aisle-jump" aria-label="按学科跳转">
        ${groups.map((group) => `<button type="button" data-jump="${escapeHtml(group.name)}">${escapeHtml(group.name)} ${group.courses.length}</button>`).join('')}
      </div>
      ${groups.map((group) => {
        const expanded = state.expandedAisles.has(group.name);
        const visible = expanded ? group.courses : group.courses.slice(0, PREVIEW_PER_GROUP);
        const rest = group.courses.length - visible.length;
        return `
        <section class="aisle-group" id="aisle-${escapeHtml(group.code)}" data-aisle-name="${escapeHtml(group.name)}">
          <div class="aisle-group-head">
            <h3>${escapeHtml(group.name)}</h3>
            <span>${group.courses.length} 门</span>
          </div>
          <div class="aisle-cards">
            ${visible.map((course, index) => productCard(course, index, 'as-open')).join('')}
          </div>
          ${rest ? `<button class="aisle-more" type="button" data-expand="${escapeHtml(group.name)}">展开其余 ${rest} 门</button>` : ''}
        </section>
      `;
      }).join('')}
    `;
  }

  function renderSubjectShelves(courses) {
    const rows = distributeToShelves(courses);
    els.shelfUnit.innerHTML = rows.map((row, index) => `
      <section class="shelf-row" aria-label="第 ${index + 1} 层书栏">
        <div class="shelf-row-head">
          <span><b>第 ${index + 1} 层</b> 书栏</span>
          <em>${row.themes.length ? escapeHtml(row.themes.join(' / ')) : '本层暂无相符课程'}</em>
        </div>
        <div class="shelf-track">
          ${row.courses.length ? row.courses.map((course, courseIndex) => productCard(course, courseIndex)).join('') : '<div class="shelf-empty">本层暂无相符课程</div>'}
        </div>
        <div class="shelf-board" aria-hidden="true"></div>
      </section>
    `).join('');
  }

  function renderPrompt(title, text) {
    els.shelfTitle.textContent = title;
    els.departmentCode.textContent = '等待取阅';
    els.activeGuide.textContent = text;
    els.resultCount.textContent = '0';
    els.shelfUnit.innerHTML = `<div class="empty-state"><strong>${escapeHtml(title)}</strong><p>${escapeHtml(text)}</p></div>`;
  }

  function renderDepartment() {
    const problem = problemDefinition();
    const theme = themeDefinition();

    if (state.mode === 'problem' && !state.problem) {
      renderPrompt('先选一个问题', '点上面的问题卡片，相关课程会按学科摊开。也可以改走学科书架或领域主题。');
      return;
    }
    if (state.mode === 'theme' && !state.themeCluster) {
      renderPrompt('先选一个主题', '点上面的主题进入。主题会穿过学科，适合学校已经有一个想做的方向。');
      return;
    }

    const courses = matchingCourses();
    els.resultCount.textContent = courses.length;

    if (state.mode === 'subject') {
      els.shelfTitle.textContent = `${state.subject}书架`;
      els.departmentCode.textContent = '学科书架';
      els.activeGuide.textContent = problem ? `当前问题：${problem.short}` : '按学科取阅';
      renderSubjectShelves(courses);
      return;
    }

    if (state.mode === 'theme') {
      els.shelfTitle.textContent = theme.name;
      els.departmentCode.textContent = '领域主题';
      els.activeGuide.textContent = `${theme.subjects.join('、')} · ${theme.count} 门在这个主题里`;
      renderGuidedAisle(courses);
      return;
    }

    els.shelfTitle.textContent = problem.short;
    els.departmentCode.textContent = '问题导购';
    els.activeGuide.textContent = problem.question;
    renderGuidedAisle(courses);
  }

  function renderFilters() {
    const anyFilter = Boolean(state.problem || state.themeCluster || state.stage !== '全部' || state.theme || state.query);
    els.clearFilter.hidden = !(state.mode === 'problem' && anyFilter);
    renderStageFilter();
    renderThemeFilter();
  }

  function render() {
    syncModeButtons();
    renderProblems();
    renderSubjects();
    renderThemes();
    renderFilters();
    renderDepartment();
    updateSelectionCount();
  }

  function chooseProblem(problemId) {
    state.problem = state.problem === problemId ? '' : problemId;
    state.stage = '全部';
    state.theme = '';
    state.expandedAisles = new Set();
    render();
    document.querySelector('#results').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function chooseSubject(subject) {
    state.subject = subject;
    state.stage = '全部';
    state.theme = '';
    state.expandedAisles = new Set();
    render();
    document.querySelector('#results').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function chooseTheme(name) {
    state.themeCluster = state.themeCluster === name ? '' : name;
    state.stage = '全部';
    state.expandedAisles = new Set();
    render();
    if (state.themeCluster) document.querySelector('#results').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function clearFilters() {
    state.problem = '';
    state.themeCluster = '';
    state.stage = '全部';
    state.theme = '';
    state.query = '';
    state.themeQuery = '';
    state.expandedAisles = new Set();
    els.searchInput.value = '';
    if (els.themeSearch) els.themeSearch.value = '';
    render();
  }

  function courseFromEvent(event) {
    const product = event.target.closest('[data-course-id]');
    return product ? data.courses.find((course) => course.id === product.dataset.courseId) : null;
  }

  function toggleSelection(course) {
    if (state.selection[course.id]) {
      delete state.selection[course.id];
      showToast(`${course.id} 已放回书架`);
    } else {
      state.selection[course.id] = { note: '' };
      showToast(`${course.id} 已放入书篮`);
      els.cartDock.classList.remove('bump');
      requestAnimationFrame(() => els.cartDock.classList.add('bump'));
    }
    saveSelection();
    renderDepartment();
    if (els.selectionDrawer.classList.contains('open')) renderSelection();
    if (els.courseDialog.open) renderDialog(course);
  }

  function renderDialog(course) {
    const selected = Boolean(state.selection[course.id]);
    els.dialogContent.innerHTML = `
      <span class="dialog-code">课程编号 ${course.id}</span>
      <h2>${escapeHtml(course.title)}</h2>
      <p class="dialog-theme">${escapeHtml(course.subject)} / ${escapeHtml(course.theme)}</p>
      ${course.subtitle ? `<p class="dialog-subtitle">${escapeHtml(course.subtitle)}</p>` : ''}
      <p class="dialog-summary">${escapeHtml(course.summary)}</p>
      ${course.practices.length ? `<h3>主要做法</h3><ul class="practice-list">${course.practices.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` : ''}
      <div class="dialog-meta">
        <span>${escapeHtml(course.stage)}</span>
        ${course.relatedSubjects.length > 1 ? `<span>关联学科：${escapeHtml(course.relatedSubjects.join('、'))}</span>` : ''}
      </div>
      <button class="primary-button" id="dialogSelect" type="button">${selected ? '放回书架' : '放入书篮'}</button>
    `;
    els.dialogContent.querySelector('#dialogSelect').addEventListener('click', () => toggleSelection(course));
  }

  function openDialog(course) {
    renderDialog(course);
    els.courseDialog.showModal();
  }

  function updateSelectionCount() {
    const count = Object.keys(state.selection).length;
    els.selectionCount.textContent = count;
    els.dockCount.textContent = count;
  }

  function renderSelection() {
    const courses = selectedCourses();
    const subjects = new Set(courses.map((course) => course.subject));
    els.selectionSummary.textContent = courses.length
      ? `书篮里有 ${courses.length} 门课程，来自 ${subjects.size} 个学科。可以写下学校的第一反应，然后导出流水单。`
      : '书篮还是空的。关掉这里，去书架上把有感觉的课程放进来。';
    els.selectionList.innerHTML = courses.length ? courses.map((course) => `
      <article class="selection-item" data-course-id="${course.id}">
        <div class="selection-item-top">
          <div>
            <span class="course-id">${course.id} / ${escapeHtml(course.subject)}</span>
            <h3>${escapeHtml(course.theme)}｜${escapeHtml(course.title)}</h3>
          </div>
          <button class="remove-button" type="button" data-action="remove">放回书架</button>
        </div>
        <p class="selection-blurb">${escapeHtml(course.summary)}</p>
        <label for="note-${course.id}">学校的想法</label>
        <textarea id="note-${course.id}" data-note placeholder="例如：想先在三年级试做；可结合本地资源。">${escapeHtml(state.selection[course.id]?.note || '')}</textarea>
      </article>
    `).join('') : '<div class="selection-empty"><strong>书篮还是空的</strong><span>先去逛书架，看到有感觉的就放进来。</span></div>';
    els.makeReceipt.disabled = courses.length === 0;
  }

  function openSelection() {
    renderSelection();
    els.drawerBackdrop.hidden = false;
    els.selectionDrawer.setAttribute('aria-hidden', 'false');
    requestAnimationFrame(() => els.selectionDrawer.classList.add('open'));
    document.body.style.overflow = 'hidden';
  }

  function closeSelection() {
    els.selectionDrawer.classList.remove('open');
    els.selectionDrawer.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    setTimeout(() => { els.drawerBackdrop.hidden = true; }, 230);
  }

  function receiptRows() {
    return selectedCourses().map((course) => ({
      id: course.id,
      subject: course.subject,
      theme: course.theme,
      title: course.title,
      summary: course.summary || course.practices.join('；'),
      note: state.selection[course.id]?.note || ''
    }));
  }

  function receiptNumber() {
    const now = new Date();
    const compact = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    return `CS-${compact}-${String(receiptRows().length).padStart(2, '0')}`;
  }

  function receiptMarkup() {
    const rows = receiptRows();
    const subjectCount = new Set(rows.map((row) => row.subject)).size;
    return `
      <div class="receipt-logo"><h2>课程超市</h2><p>选课流水单 / ${receiptNumber()}</p></div>
      <div class="receipt-rule">------------------------------------------</div>
      ${rows.map((row) => `
        <div class="receipt-line">
          <span>${row.id}</span>
          <div>
            <strong>${escapeHtml(row.theme)}</strong>
            <small>${escapeHtml(row.subject)} / ${escapeHtml(row.title)}</small>
            <div class="receipt-blurb">${escapeHtml(row.summary)}</div>
            ${row.note ? `<div class="receipt-note">想法：${escapeHtml(row.note)}</div>` : ''}
          </div>
          <span class="qty">×1</span>
        </div>
      `).join('')}
      <div class="receipt-total"><span>${subjectCount} 个学科书架</span><strong>共 ${rows.length} 门</strong></div>
      <div class="receipt-rule">------------------------------------------</div>
      <div class="receipt-footer"><div class="receipt-barcode" aria-hidden="true"></div><p>请保留课程编号，便于后续沟通与定制。<br>选中的方向将结合学校实际继续加工。</p></div>
    `;
  }

  function receiptText() {
    const rows = receiptRows();
    const lines = ['课程超市｜选课流水单', `流水号：${receiptNumber()}`, '--------------------------------'];
    rows.forEach((row) => {
      lines.push(`${row.id}  ${row.subject}｜${row.theme}  ×1`);
      lines.push(`    ${row.title}`);
      lines.push(`    ${row.summary}`);
      if (row.note) lines.push(`    学校想法：${row.note}`);
      lines.push('');
    });
    lines.push('--------------------------------');
    lines.push(`合计：${rows.length} 门课程｜${new Set(rows.map((row) => row.subject)).size} 个学科`);
    lines.push('请保留课程编号，便于后续沟通与定制。');
    return lines.join('\n');
  }

  function openReceipt() {
    els.receiptContent.innerHTML = receiptMarkup();
    closeSelection();
    setTimeout(() => els.receiptDialog.showModal(), 240);
  }

  function downloadReceipt() {
    const blob = new Blob([`\ufeff${receiptText()}`], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `课程超市选课流水单_${new Date().toISOString().slice(0, 10)}.txt`;
    link.click();
    URL.revokeObjectURL(url);
    showToast('流水单已下载');
  }

  async function copyReceipt() {
    try {
      await navigator.clipboard.writeText(receiptText());
      showToast('流水单已复制');
    } catch {
      showToast('复制失败，请使用下载流水单');
    }
  }

  function printReceipt() {
    const rows = receiptRows();
    els.printSheet.innerHTML = `
      <h1>课程超市</h1><p class="print-meta">选课流水单 / ${receiptNumber()}</p>
      ${rows.map((row) => `<div class="print-item"><strong>${row.id}｜${escapeHtml(row.subject)}｜${escapeHtml(row.theme)} ×1</strong>${escapeHtml(row.title)}<br>${escapeHtml(row.summary)}${row.note ? `<br>学校想法：${escapeHtml(row.note)}` : ''}</div>`).join('')}
      <div class="print-total">合计 ${rows.length} 门</div><div class="print-footer">请保留课程编号，便于后续沟通与定制。</div>
    `;
    window.print();
  }

  let toastTimer;
  function showToast(message) {
    clearTimeout(toastTimer);
    els.toast.textContent = message;
    els.toast.classList.add('show');
    toastTimer = setTimeout(() => els.toast.classList.remove('show'), 1800);
  }

  function initRevealObserver() {
    const items = [...document.querySelectorAll('.reveal')];
    if (!items.length || !('IntersectionObserver' in window)) {
      items.forEach((item) => item.classList.add('is-visible'));
      return;
    }
    document.body.classList.add('motion-ready');
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.12 });
    items.forEach((item) => observer.observe(item));
  }

  document.addEventListener('click', (event) => {
    const modeButton = event.target.closest('[data-mode]');
    if (modeButton && !modeButton.closest('.selection-drawer')) {
      setMode(modeButton.dataset.mode);
    }
  });
  els.problemGrid.addEventListener('click', (event) => {
    const card = event.target.closest('[data-problem]');
    if (card) chooseProblem(card.dataset.problem);
  });
  els.subjectGrid.addEventListener('click', (event) => {
    const button = event.target.closest('[data-subject]');
    if (!button || button.disabled) return;
    chooseSubject(button.dataset.subject);
  });
  els.themeGrid.addEventListener('click', (event) => {
    const card = event.target.closest('[data-theme-name]');
    if (card) chooseTheme(card.dataset.themeName);
  });
  els.themeSearch.addEventListener('input', () => {
    state.themeQuery = els.themeSearch.value.trim();
    renderThemes();
  });
  els.stageFilter.addEventListener('click', (event) => {
    const button = event.target.closest('[data-stage]');
    if (!button) return;
    state.stage = button.dataset.stage;
    if (state.mode === 'subject') state.theme = '';
    renderFilters();
    renderDepartment();
  });
  els.themeFilter.addEventListener('change', () => { state.theme = els.themeFilter.value; renderDepartment(); });
  els.searchInput.addEventListener('input', () => { state.query = els.searchInput.value.trim(); renderFilters(); renderDepartment(); });
  els.clearFilter.addEventListener('click', clearFilters);
  els.shelfUnit.addEventListener('click', (event) => {
    const jump = event.target.closest('[data-jump]');
    if (jump) {
      const group = [...els.shelfUnit.querySelectorAll('[data-aisle-name]')].find((node) => node.dataset.aisleName === jump.dataset.jump);
      group?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    const expand = event.target.closest('[data-expand]');
    if (expand) {
      state.expandedAisles.add(expand.dataset.expand);
      renderDepartment();
      return;
    }
    const course = courseFromEvent(event);
    if (!course) return;
    if (event.target.closest('[data-action="select"]')) toggleSelection(course);
    else openDialog(course);
  });
  els.shelfUnit.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    if (event.target.closest('button')) return;
    const course = courseFromEvent(event);
    if (course) { event.preventDefault(); openDialog(course); }
  });
  [els.openSelection, els.openSelectionBottom, els.cartDock].forEach((button) => button.addEventListener('click', openSelection));
  els.closeSelection.addEventListener('click', closeSelection);
  els.continueShopping.addEventListener('click', closeSelection);
  els.drawerBackdrop.addEventListener('click', closeSelection);
  els.selectionList.addEventListener('click', (event) => {
    if (event.target.dataset.action !== 'remove') return;
    const course = courseFromEvent(event);
    if (course) toggleSelection(course);
  });
  els.selectionList.addEventListener('input', (event) => {
    if (!event.target.matches('[data-note]')) return;
    const courseId = event.target.closest('[data-course-id]')?.dataset.courseId;
    if (!courseId || !state.selection[courseId]) return;
    state.selection[courseId].note = event.target.value;
    saveSelection();
  });
  els.makeReceipt.addEventListener('click', openReceipt);
  els.closeDialog.addEventListener('click', () => els.courseDialog.close());
  els.closeReceipt.addEventListener('click', () => els.receiptDialog.close());
  els.downloadReceipt.addEventListener('click', downloadReceipt);
  els.copyReceipt.addEventListener('click', copyReceipt);
  els.printReceipt.addEventListener('click', printReceipt);
  [els.courseDialog, els.receiptDialog].forEach((dialog) => dialog.addEventListener('click', (event) => {
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
  }));
  document.addEventListener('keydown', (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); els.searchInput.focus(); }
    if (event.key === 'Escape' && els.selectionDrawer.classList.contains('open')) closeSelection();
  });

  initMeta();
  render();
  initRevealObserver();
})();
