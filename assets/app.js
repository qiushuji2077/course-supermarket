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
  const FEATURED_LIMIT = 10;

  const themeIndex = buildThemeIndex();
  const state = {
    mode: 'problem',
    entered: false,
    problem: '',
    subject: data.subjects[0]?.name || '',
    themeCluster: '',
    themeQuery: '',
    stage: '全部',
    theme: '',
    query: '',
    showAllProblemResults: false,
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
    barResultCount: document.querySelector('#barResultCount'),
    barCartCount: document.querySelector('#barCartCount'),
    stageFilter: document.querySelector('#stageFilter'),
    themeFilter: document.querySelector('#themeFilter'),
    shelfTools: document.querySelector('#shelfTools'),
    shelfUnit: document.querySelector('#shelfUnit'),
    selectionCount: document.querySelector('#selectionCount'),
    dockCount: document.querySelector('#dockCount'),
    openSelection: document.querySelector('#openSelection'),
    openSelectionBottom: document.querySelector('#openSelectionBottom'),
    openSelectionBar: document.querySelector('#openSelectionBar'),
    openFilters: document.querySelector('#openFilters'),
    jumpResults: document.querySelector('#jumpResults'),
    cartDock: document.querySelector('#cartDock'),
    actionBar: document.querySelector('#actionBar'),
    selectionDrawer: document.querySelector('#selectionDrawer'),
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
      return Object.fromEntries(Object.entries(saved)
        .filter(([id]) => validIds.has(id))
        .map(([id, value]) => [id, { note: typeof value?.note === 'string' ? value.note : '' }]));
    } catch {
      return {};
    }
  }

  function saveSelection() {
    updateSelectionCount();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.selection));
      return true;
    } catch {
      showToast('浏览器无法保存书篮，当前选择仍可导出；刷新后可能丢失。', 6000);
      return false;
    }
  }

  function selectedCourses() {
    const byId = new Map(data.courses.map((course) => [course.id, course]));
    return Object.keys(state.selection).map((id) => byId.get(id)).filter(Boolean);
  }

  function initMeta() {
    const courseCount = data.courses.length;
    const subjectCount = new Set(data.courses.map((course) => course.subject)).size;
    const directionCount = themeIndex.length;
    els.courseTotal.textContent = courseCount;
    els.directionTotal.textContent = directionCount;
    els.subjectTotal.textContent = subjectCount;
    document.querySelectorAll('[data-meta="courseCount"]').forEach((node) => { node.textContent = courseCount; });
    document.querySelectorAll('[data-meta="subjectCount"]').forEach((node) => { node.textContent = subjectCount; });
    document.querySelectorAll('[data-meta="directionCount"]').forEach((node) => { node.textContent = directionCount; });
    els.updateTime.textContent = `内容更新于 ${data.meta.generatedAt}`;
  }

  function enterBrowse() {
    if (state.entered) return;
    state.entered = true;
    document.body.classList.remove('is-landing');
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
    state.showAllProblemResults = false;
    state.expandedAisles = new Set();
    if (scroll) enterBrowse();
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
        if (active) button.setAttribute('aria-current', 'page');
        else button.removeAttribute('aria-current');
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
        <span class="guide-count">${coursesForProblem(item.id).length} 门相关</span>
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

  function matchingCourses({ ignoreSubject = false, ignoreThemeFilter = false, ignoreStage = false } = {}) {
    return data.courses.filter((course) => {
      if (state.problem && !course.problems.includes(state.problem)) return false;
      if (state.mode === 'subject' && !ignoreSubject && course.subject !== state.subject) return false;
      if (state.mode === 'theme' && state.themeCluster && course.theme !== state.themeCluster) return false;
      if (!ignoreStage && state.stage !== '全部' && course.stage !== state.stage) return false;
      if (state.mode === 'subject' && !ignoreThemeFilter && state.theme && course.theme !== state.theme) return false;
      if (state.query) {
        const haystack = [course.id, course.subject, ...(course.relatedSubjects || []), course.theme, course.title, course.subtitle, course.summary, ...course.practices, ...course.directions].join(' ').toLowerCase();
        if (!haystack.includes(state.query.toLowerCase())) return false;
      }
      return true;
    });
  }

  function availableStages() {
    const order = ['全部', '小学', '小学/初中', '初中', '初高中', '九年一贯', '高中'];
    const pool = matchingCourses({ ignoreThemeFilter: true, ignoreStage: true });
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

  function referenceMatchScore(course) {
    const query = state.query.toLowerCase();
    if (!query) return 0;
    if (course.id.toLowerCase() === query) return 3;
    const matches = (value) => String(value || '').toLowerCase().includes(query);
    if ([course.title, course.theme].some(matches)) return 2;
    if ([course.subject, ...(course.relatedSubjects || []), course.subtitle, ...(course.directions || [])].some(matches)) return 1;
    return 0;
  }

  function pickReferenceCourses(courses, limit = FEATURED_LIMIT) {
    // The candidate pool already matches the active filters. Prefer direct search
    // matches, then cover different themes and subjects without scoring quality.
    const remaining = courses.map((course) => ({ course, match: referenceMatchScore(course) }));
    const picked = [];
    const themes = new Set();
    const subjects = new Set();
    while (picked.length < limit && remaining.length) {
      remaining.sort((a, b) => b.match - a.match
        || Number(themes.has(a.course.theme)) - Number(themes.has(b.course.theme))
        || Number(subjects.has(a.course.subject)) - Number(subjects.has(b.course.subject))
        || a.course.id.localeCompare(b.course.id));
      const { course } = remaining.shift();
      picked.push(course);
      themes.add(course.theme);
      subjects.add(course.subject);
    }
    return picked;
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
          <button class="put-button ${selected ? 'selected' : ''}" type="button" data-action="select" aria-pressed="${selected}">${selected ? '已入篮' : '放入书篮'}</button>
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

  function renderFeaturedPicks(courses) {
    const featured = pickReferenceCourses(courses);
    const rest = courses.length - featured.length;
    els.shelfUnit.innerHTML = `
      <div class="guide-picks">
        <div class="guide-picks-head">
          <h3>方向参考 · ${featured.length} 门</h3>
          <p>从符合当前条件的 ${courses.length} 门课程中，${state.query ? '优先呈现与检索词直接相关的课程，并兼顾不同主题与学科。' : '选取不同主题与学科的课程作为方向参考。'}可展开全部课程继续比较。</p>
        </div>
        <div class="aisle-cards catalog-list">
          ${featured.map((course, index) => productCard(course, index, 'as-open as-catalog')).join('')}
        </div>
        ${rest > 0 ? `<button class="aisle-more" type="button" data-show-all="true">查看全部 ${courses.length} 门</button>` : ''}
      </div>
    `;
  }

  function renderGuidedAisle(courses) {
    const groups = groupBySubject(courses);
    if (!groups.length) {
      els.shelfUnit.innerHTML = '<div class="empty-state"><strong>这批条件里没有课程</strong><p>换一个问题、主题或学段，或者清除已选条件。</p></div>';
      return;
    }
    els.shelfUnit.innerHTML = `
      ${state.mode === 'problem' && state.showAllProblemResults && courses.length > FEATURED_LIMIT ? `<div class="guide-picks-toolbar"><button class="aisle-more" type="button" data-show-all="false">返回方向参考 ${FEATURED_LIMIT} 门</button></div>` : ''}
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

  function setResultCount(count) {
    els.resultCount.textContent = count;
    if (els.barResultCount) els.barResultCount.textContent = count;
  }

  function renderPrompt(title, text) {
    els.shelfTitle.textContent = title;
    els.departmentCode.textContent = '等待取阅';
    els.activeGuide.textContent = text;
    setResultCount(0);
    els.shelfUnit.innerHTML = `<div class="empty-state"><strong>${escapeHtml(title)}</strong><p>${escapeHtml(text)}</p></div>`;
  }

  function renderDepartment() {
    const problem = problemDefinition();
    const theme = themeDefinition();
    const hasLookup = Boolean(state.query) || state.stage !== '全部';

    if (state.mode === 'problem' && !state.problem && !hasLookup) {
      renderPrompt('先选一个问题', '点上面的问题卡片，下面会展示相关课程作为方向参考。也可以改走学科书架或领域主题。');
      return;
    }
    if (state.mode === 'theme' && !state.themeCluster && !hasLookup) {
      renderPrompt('先选一个主题', '点上面的主题进入。主题会穿过学科，适合学校已经有一个想做的方向。');
      return;
    }

    const courses = matchingCourses();
    setResultCount(courses.length);

    if (state.mode === 'subject') {
      els.shelfTitle.textContent = `${state.subject}书架`;
      els.departmentCode.textContent = '学科书架';
      els.activeGuide.textContent = problem ? `当前问题：${problem.short}` : '按学科取阅';
    } else if (state.mode === 'theme') {
      els.shelfTitle.textContent = theme ? theme.name : '检索结果';
      els.departmentCode.textContent = '领域主题';
      els.activeGuide.textContent = theme
        ? `${theme.subjects.join('、')} · ${theme.count} 门在这个主题里`
        : (state.query ? `正在检索「${state.query}」` : `学段：${state.stage}`);
    } else {
      els.shelfTitle.textContent = problem ? problem.short : '检索结果';
      els.departmentCode.textContent = '问题导购';
      els.activeGuide.textContent = problem ? problem.question : (state.query ? `正在检索「${state.query}」` : `学段：${state.stage}`);
    }

    if (!courses.length) {
      els.shelfUnit.innerHTML = '<div class="empty-state"><strong>这批条件里没有课程</strong><p>换一个问题、主题、学段或检索词，或者清除已选条件。</p></div>';
      return;
    }

    if (state.mode === 'subject') {
      renderSubjectShelves(courses);
      return;
    }

    if (state.mode === 'theme') {
      renderGuidedAisle(courses);
      return;
    }

    if (!state.showAllProblemResults && courses.length > FEATURED_LIMIT) {
      renderFeaturedPicks(courses);
    } else {
      renderGuidedAisle(courses);
    }
  }

  function renderFilters() {
    const anyFilter = Boolean(state.problem || state.themeCluster || state.stage !== '全部' || state.theme || state.query);
    els.clearFilter.hidden = !anyFilter;
    renderStageFilter();
    renderThemeFilter();
    renderSubjects();
  }

  function render() {
    syncModeButtons();
    renderProblems();
    renderThemes();
    renderFilters();
    renderDepartment();
    updateSelectionCount();
  }

  function chooseProblem(problemId) {
    state.problem = state.problem === problemId ? '' : problemId;
    state.stage = '全部';
    state.theme = '';
    state.showAllProblemResults = false;
    state.expandedAisles = new Set();
    enterBrowse();
    render();
    document.querySelector('#results').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function chooseSubject(subject) {
    state.subject = subject;
    state.stage = '全部';
    state.theme = '';
    state.expandedAisles = new Set();
    enterBrowse();
    render();
    document.querySelector('#results').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function chooseTheme(name) {
    state.themeCluster = state.themeCluster === name ? '' : name;
    state.stage = '全部';
    state.expandedAisles = new Set();
    enterBrowse();
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
    state.showAllProblemResults = false;
    state.expandedAisles = new Set();
    els.searchInput.value = '';
    if (els.themeSearch) els.themeSearch.value = '';
    render();
  }

  function courseFromEvent(event) {
    const product = event.target.closest('[data-course-id]');
    return product ? data.courses.find((course) => course.id === product.dataset.courseId) : null;
  }

  function flashCart() {
    [els.cartDock, els.openSelectionBar].forEach((node) => {
      if (!node) return;
      node.classList.remove('bump');
      void node.offsetWidth;
      node.classList.add('bump');
    });
  }

  function toggleSelection(course) {
    if (state.selection[course.id]) {
      delete state.selection[course.id];
      showToast(`${course.id} 已放回书架`);
    } else {
      state.selection[course.id] = { note: '' };
      showToast(`${course.id} 已放入书篮`);
      flashCart();
    }
    saveSelection();
    const selected = Boolean(state.selection[course.id]);
    els.shelfUnit.querySelectorAll('.product-card').forEach((card) => {
      if (card.dataset.courseId !== course.id) return;
      card.classList.toggle('selected', selected);
      const button = card.querySelector('[data-action="select"]');
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-pressed', String(selected));
      button.textContent = selected ? '已入篮' : '放入书篮';
    });
    if (els.selectionDrawer.open) {
      const item = [...els.selectionList.children].find((node) => node.dataset.courseId === course.id);
      if (!selected && item) {
        const restoreFocus = item.contains(document.activeElement);
        const nextControl = item.nextElementSibling?.querySelector('[data-action="remove"]')
          || item.previousElementSibling?.querySelector('[data-action="remove"]') || els.closeSelection;
        item.remove();
        if (!selectedCourses().length) renderSelection();
        else renderSelectionSummary();
        if (restoreFocus) nextControl.focus({ preventScroll: true });
      } else {
        renderSelection();
      }
    }
    if (els.courseDialog.open && els.dialogContent.dataset.courseId === course.id) {
      const button = els.dialogContent.querySelector('#dialogSelect');
      button.textContent = selected ? '放回书架' : '放入书篮';
      button.setAttribute('aria-pressed', String(selected));
    }
  }

  function renderDialog(course) {
    const selected = Boolean(state.selection[course.id]);
    els.dialogContent.dataset.courseId = course.id;
    els.dialogContent.innerHTML = `
      <span class="dialog-code">课程编号 ${course.id}</span>
      <h2 id="courseDialogTitle">${escapeHtml(course.title)}</h2>
      <p class="dialog-theme">${escapeHtml(course.subject)} / ${escapeHtml(course.theme)}</p>
      ${course.subtitle ? `<p class="dialog-subtitle">${escapeHtml(course.subtitle)}</p>` : ''}
      <p class="dialog-summary">${escapeHtml(course.summary)}</p>
      ${course.practices.length ? `<h3>主要做法</h3><ul class="practice-list">${course.practices.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` : ''}
      <div class="dialog-meta">
        <span>${escapeHtml(course.stage)}</span>
        ${course.relatedSubjects.length > 1 ? `<span>关联学科：${escapeHtml(course.relatedSubjects.join('、'))}</span>` : ''}
      </div>
      <button class="primary-button" id="dialogSelect" type="button" aria-pressed="${selected}">${selected ? '放回书架' : '放入书篮'}</button>
    `;
    els.dialogContent.querySelector('#dialogSelect').addEventListener('click', () => toggleSelection(course));
  }

  function openDialog(course) {
    renderDialog(course);
    els.courseDialog.showModal();
    syncModalScrollLock();
  }

  function updateSelectionCount() {
    const count = Object.keys(state.selection).length;
    els.selectionCount.textContent = count;
    els.dockCount.textContent = count;
    if (els.barCartCount) els.barCartCount.textContent = count;
  }

  function renderSelectionSummary(courses = selectedCourses()) {
    const subjects = new Set(courses.map((course) => course.subject));
    els.selectionSummary.textContent = courses.length
      ? `书篮里有 ${courses.length} 门课程，来自 ${subjects.size} 个学科。可以写下学校的第一反应，然后导出流水单。`
      : '书篮还是空的。关掉这里，去书架上把有感觉的课程放进来。';
    els.makeReceipt.disabled = courses.length === 0;
  }

  function renderSelection() {
    const courses = selectedCourses();
    renderSelectionSummary(courses);
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
  }

  function syncModalScrollLock() {
    document.body.classList.toggle('has-modal', Boolean(document.querySelector('dialog[open]')));
  }

  function openSelection() {
    if (els.selectionDrawer.open) return;
    renderSelection();
    els.selectionDrawer.showModal();
    els.closeSelection.focus({ preventScroll: true });
    syncModalScrollLock();
  }

  function closeSelection() {
    els.selectionDrawer.close();
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
    els.receiptDialog.showModal();
    syncModalScrollLock();
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
  function showToast(message, duration = 1800) {
    clearTimeout(toastTimer);
    const surface = document.querySelector('dialog[open]') || document.body;
    if (els.toast.parentElement !== surface) surface.append(els.toast);
    els.toast.textContent = message;
    els.toast.classList.add('show');
    toastTimer = setTimeout(() => els.toast.classList.remove('show'), duration);
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

  function initHeaderScroll() {
    let lastY = 0;
    window.addEventListener('scroll', () => {
      const y = window.scrollY;
      if (!state.entered && y > 120) enterBrowse();
      if (!state.entered) {
        lastY = y;
        return;
      }
      const hide = y > 72 && y > lastY + 4;
      const show = y < lastY - 4 || y < 48;
      if (hide) document.body.classList.add('header-away');
      if (show) document.body.classList.remove('header-away');
      lastY = y;
    }, { passive: true });
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
    const showAll = event.target.closest('[data-show-all]');
    if (showAll) {
      state.showAllProblemResults = showAll.dataset.showAll === 'true';
      renderDepartment();
      document.querySelector('#results').scrollIntoView({ behavior: 'smooth', block: 'start' });
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
  [els.openSelection, els.openSelectionBottom, els.cartDock, els.openSelectionBar].forEach((button) => {
    button?.addEventListener('click', openSelection);
  });
  els.openFilters?.addEventListener('click', () => {
    enterBrowse();
    els.shelfTools?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    els.shelfTools?.classList.add('pulse');
    setTimeout(() => els.shelfTools?.classList.remove('pulse'), 900);
  });
  els.jumpResults?.addEventListener('click', () => {
    document.querySelector('#results')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  els.closeSelection.addEventListener('click', closeSelection);
  els.continueShopping.addEventListener('click', closeSelection);
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
  [els.selectionDrawer, els.courseDialog, els.receiptDialog].forEach((dialog) => {
    dialog.addEventListener('close', syncModalScrollLock);
    dialog.addEventListener('click', (event) => {
      if (event.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
    });
  });
  document.addEventListener('keydown', (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k' && !document.querySelector('dialog[open]')) {
      event.preventDefault();
      els.searchInput.focus();
    }
  });

  document.querySelector('.brand')?.addEventListener('click', () => {
    state.entered = false;
    document.body.classList.add('is-landing');
    document.body.classList.remove('header-away');
  });

  initMeta();
  render();
  initRevealObserver();
  initHeaderScroll();
})();
