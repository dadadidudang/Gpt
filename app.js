
(() => {
  const el = sel => document.querySelector(sel);
  const storageKey = 'gppn.recipes.v1';

  let state = {
    recipes: load(),
    search: '',
    tagFilter: '',
    sort: 'updatedDesc',
  };

  // Elements
  const list = el('#recipeList');
  const searchInput = el('#searchInput');
  const sortSelect = el('#sortSelect');
  const tagChips = el('#tagChips');
  const dialog = el('#recipeDialog');
  const form = el('#recipeForm');
  const newBtn = el('#newRecipeBtn');
  const exportBtn = el('#exportBtn');
  const importInput = el('#importInput');
  const dialogTitle = el('#dialogTitle');

  const aiDialog = el('#aiDialog');
  const aiFab = el('#aiFab');
  const aiInput = document.getElementById('aiInput');
  const aiResult = document.getElementById('aiResult');
  const aiAskBtn = document.getElementById('aiAskBtn');
  const apiKeyInput = document.getElementById('apiKeyInput');
  const saveKeyBtn = document.getElementById('saveKeyBtn');

  // Event bindings
  newBtn.addEventListener('click', () => openForm());
  exportBtn.addEventListener('click', exportJSON);
  importInput.addEventListener('change', importJSON);
  searchInput.addEventListener('input', e => { state.search = e.target.value.trim(); render(); });
  sortSelect.addEventListener('change', e => { state.sort = e.target.value; render(); });

  el('#cancelBtn').addEventListener('click', () => {
    if (typeof dialog.close === 'function') { dialog.close(); }
    else { dialog.removeAttribute('open'); document.body.style.overflow=''; }
  });

  aiFab.addEventListener('click', () => {
    if (typeof aiDialog.showModal === 'function') aiDialog.showModal();
    else aiDialog.setAttribute('open','');
    const saved = localStorage.getItem('gppn.apiKey') || '';
    if (saved) apiKeyInput.value = saved;
  });

  aiAskBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    const q = (aiInput?.value || '').trim();
    if (!q) return;
    const key = localStorage.getItem('gppn.apiKey');
    const header = key ? "🔐 API 키가 설정되어 있어요. 실제 연결만 하면 됩니다.\n\n"
                       : "🧪 데모 응답(키 미설정). 설정에서 API 키를 넣으면 실제 호출로 바꿀 수 있어요.\n\n";
    const demo = [
      "• 재료 분석: '말차, 우유, 달걀' → 말차 푸딩/말차 크림브륄레 추천",
      "• 단위 변환: 설탕 3 Tbsp ≈ 37~40 g",
      "• 시간 스케줄: 굽기 20분 + 휴지 10분 → 총 30분",
      "• 대체 재료: 버터→식물성 마가린(풍미↓), 우유→두유(수분 조절 필요)"
    ].join("\n");
    aiResult.textContent = header + demo;
  });

  saveKeyBtn?.addEventListener('click', () => {
    const v = apiKeyInput?.value?.trim();
    if (!v) { alert('키를 입력해주세요'); return; }
    localStorage.setItem('gppn.apiKey', v);
    alert('API 키 저장 완료! 이제 실제 AI 호출을 붙일 수 있어요.');
  });

  form.addEventListener('submit', e => {
    e.preventDefault();
    const data = formToRecipe(new FormData(form));
    if (!data.title) return;
    if (form.dataset.editId) {
      const idx = state.recipes.findIndex(r => r.id === form.dataset.editId);
      if (idx !== -1) {
        data.id = state.recipes[idx].id;
        data.createdAt = state.recipes[idx].createdAt;
        data.updatedAt = Date.now();
        state.recipes[idx] = data;
      }
    } else {
      data.id = crypto.randomUUID();
      data.createdAt = Date.now();
      data.updatedAt = Date.now();
      state.recipes.unshift(data);
    }
    save();
    if (typeof dialog.close === 'function') dialog.close(); else dialog.removeAttribute('open');
    render();
  });

  function openForm(recipe=null) {
    form.reset();
    delete form.dataset.editId;
    dialogTitle.textContent = '새 레시피';
    if (recipe) {
      dialogTitle.textContent = '레시피 수정';
      form.title.value = recipe.title || '';
      form.difficulty.value = recipe.difficulty || '';
      form.time.value = recipe.time || '';
      form.yield.value = recipe.yield || '';
      form.tags.value = (recipe.tags||[]).join(', ');
      form.image.value = recipe.image || '';
      form.summary.value = recipe.summary || '';
      form.ingredients.value = (recipe.ingredients||[]).join('\n');
      form.steps.value = (recipe.steps||[]).map((s,i)=> `${i+1}) ${s}`).join('\n');
      form.notes.value = recipe.notes || '';
      form.dataset.editId = recipe.id;
    }
    if (typeof dialog.showModal === 'function') { dialog.showModal(); }
    else { dialog.setAttribute('open',''); document.body.style.overflow='hidden'; }
  }

  function formToRecipe(fd) {
    const get = name => (fd.get(name) || '').toString().trim();
    const parseLines = (v) => get(v)
      .split(/\r?\n/).map(s => s.replace(/^\d+\)\s*/, '').trim()).filter(Boolean);
    const parseTags = (v) => get(v)
      .split(',').map(s=>s.trim()).filter(Boolean);

    return {
      title: get('title'),
      difficulty: get('difficulty'),
      time: get('time') ? Number(get('time')) : null,
      yield: get('yield'),
      tags: parseTags('tags'),
      image: get('image'),
      summary: get('summary'),
      ingredients: parseLines('ingredients'),
      steps: parseLines('steps'),
      notes: get('notes'),
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return demoData();
      const data = JSON.parse(raw);
      return Array.isArray(data) ? data : demoData();
    } catch {
      return demoData();
    }
  }

  function save() {
    localStorage.setItem(storageKey, JSON.stringify(state.recipes));
    updateTags();
  }

  function exportJSON() {
    const blob = new Blob([JSON.stringify(state.recipes, null, 2)], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'dessert-recipes.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  function importJSON(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const arr = JSON.parse(reader.result);
        if (!Array.isArray(arr)) throw new Error('Invalid JSON');
        const map = new Map(state.recipes.map(r => [r.id, r]));
        for (const r of arr) {
          if (r.id && map.has(r.id)) continue;
          r.id = r.id || crypto.randomUUID();
          r.createdAt = r.createdAt || Date.now();
          r.updatedAt = Date.now();
          state.recipes.push(r);
        }
        save();
        render();
      } catch (err) {
        alert('불러오기에 실패했어요. JSON 형식을 확인해주세요.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  function render() {
    const q = state.search.toLowerCase();
    const filtered = state.recipes.filter(r => {
      const hay = [
        r.title,
        r.summary,
        (r.ingredients||[]).join(' '),
        (r.tags||[]).join(' '),
      ].join(' ').toLowerCase();
      const matchQ = !q || hay.includes(q);
      const matchTag = !state.tagFilter || (r.tags||[]).includes(state.tagFilter);
      return matchQ && matchTag;
    });

    filtered.sort((a,b) => {
      switch (state.sort) {
        case 'titleAsc': return (a.title||'').localeCompare(b.title||'');
        case 'timeAsc': return (a.time||1e12) - (b.time||1e12);
        case 'timeDesc': return (b.time||-1) - (a.time||-1);
        default: return (b.updatedAt||0) - (a.updatedAt||0);
      }
    });

    const main = document.querySelector('main');
    const old = document.getElementById('recipeList');
    if (old) old.remove();
    const ul = document.createElement('ul');
    ul.id = 'recipeList';
    ul.className = 'cards';
    main.insertBefore(ul, document.getElementById('aiFab'));

    if (!filtered.length) {
      const div = document.createElement('div');
      div.className = 'empty';
      div.textContent = '레시피가 없어요. 위에서 새 레시피를 추가해보세요!';
      main.insertBefore(div, document.getElementById('aiFab'));
      return;
    }

    for (const r of filtered) ul.appendChild(renderCard(r));
  }

  function renderCard(r) {
    const tpl = document.querySelector('#recipeCardTmpl').content.cloneNode(true);
    const li = tpl.querySelector('.card');
    const thumb = tpl.querySelector('.thumb');
    const title = tpl.querySelector('.title');
    const summary = tpl.querySelector('.summary');
    const time = tpl.querySelector('.time');
    const diff = tpl.querySelector('.diff');
    const yieldEl = tpl.querySelector('.yield');
    const tags = tpl.querySelector('.tags');
    const ing = tpl.querySelector('.ing');
    const steps = tpl.querySelector('.steps');
    const notes = tpl.querySelector('.notes');
    const editBtn = tpl.querySelector('.edit');
    const delBtn = tpl.querySelector('.delete');
    const dupBtn = tpl.querySelector('.dup');

    title.textContent = r.title || '(제목 없음)';
    summary.textContent = r.summary || '';
    time.textContent = r.time ? `⏱ ${r.time}분` : '⏱ 시간 미입력';
    diff.textContent = r.difficulty ? `🧁 ${r.difficulty}` : '🧁 난이도 미입력';
    yieldEl.textContent = r.yield ? `🍽 ${r.yield}` : '';
    if (r.image) thumb.style.backgroundImage = `url('${r.image}')`;

    (r.tags||[]).forEach(t => {
      const s = document.createElement('span');
      s.className = 'tag';
      s.textContent = `#${t}`;
      s.addEventListener('click', () => { state.tagFilter = t; updateTags(); render(); });
      tags.appendChild(s);
    });

    (r.ingredients||[]).forEach(i => {
      const li = document.createElement('li');
      li.textContent = i;
      ing.appendChild(li);
    });
    (r.steps||[]).forEach(s => {
      const li = document.createElement('li');
      li.textContent = s;
      steps.appendChild(li);
    });
    notes.textContent = r.notes || '';

    editBtn.addEventListener('click', () => openForm(r));
    delBtn.addEventListener('click', () => {
      if (confirm('이 레시피를 삭제할까요?')) {
        state.recipes = state.recipes.filter(x => x.id !== r.id);
        save();
        render();
      }
    });
    dupBtn.addEventListener('click', () => {
      const copy = JSON.parse(JSON.stringify(r));
      copy.id = crypto.randomUUID();
      copy.title = r.title + ' (복제)';
      copy.createdAt = Date.now();
      copy.updatedAt = Date.now();
      state.recipes.unshift(copy);
      save();
      render();
    });

    return li;
  }

  function updateTags() {
    const all = new Set();
    for (const r of state.recipes) (r.tags||[]).forEach(t => all.add(t));
    tagChips.innerHTML = '';
    if (state.tagFilter) {
      const clear = document.createElement('button');
      clear.textContent = `태그 해제: #${state.tagFilter}`;
      clear.addEventListener('click', () => { state.tagFilter=''; render(); updateTags(); });
      tagChips.appendChild(clear);
    }
    if (!all.size) return;
    for (const t of Array.from(all).sort((a,b)=>a.localeCompare(b))) {
      const b = document.createElement('button');
      b.textContent = `#${t}`;
      b.addEventListener('click', () => { state.tagFilter = t; render(); updateTags(); });
      tagChips.appendChild(b);
    }
  }

  function demoData() {
    return [{
      id: crypto.randomUUID(),
      title: '바닐라 빈 푸딩',
      summary: '심플하지만 품격 있는 기본 푸딩. 마다가스카르 바닐라의 향이 포인트.',
      difficulty: '초급',
      time: 35,
      yield: '4인분',
      tags: ['기본', '푸딩', '프랑스'],
      image: '',
      ingredients: ['우유 500ml', '생크림 200ml', '설탕 70g', '달걀 3개', '바닐라 빈 1/2개', '소금 한 꼬집'],
      steps: ['오븐 150°C 예열', '우유+크림+바닐라를 데워 향을 우려내기', '달걀+설탕+소금 섞기', '따뜻한 우유 혼합물을 조금씩 넣어 섞기', '체에 걸러 램킨에 붓고 중탕으로 30분 굽기', '식혀서 냉장'],
      notes: '설탕 일부를 흑설탕으로 바꾸면 풍미 업.',
      createdAt: Date.now(),
      updatedAt: Date.now()
    }];
  }

  // Init
  updateTags();
  render();
})();
