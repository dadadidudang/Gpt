
(() => {
  const el = sel => document.querySelector(sel);
  const els = sel => Array.from(document.querySelectorAll(sel));
  const storageKey = 'dessertRecipes.v1';

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

  // Event bindings
  newBtn.addEventListener('click', () => openForm());
  exportBtn.addEventListener('click', exportJSON);
  importInput.addEventListener('change', importJSON);
  searchInput.addEventListener('input', e => { state.search = e.target.value.trim(); render(); });
  sortSelect.addEventListener('change', e => { state.sort = e.target.value; render(); });

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
    dialog.close();
    render();
  });

  el('#cancelBtn').addEventListener('click', () => { if (typeof dialog.close === 'function') { dialog.close(); } else { dialog.removeAttribute('open'); document.body.style.overflow=''; } });

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
    if (typeof dialog.showModal === 'function') { dialog.showModal(); } else { dialog.setAttribute('open',''); document.body.style.overflow='hidden'; }
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
        if (!Array.isArray(arr)) throw new Error('Invalid JSON format');
        // merge by title if id missing
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
    // reset input to allow re-importing same file
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
        default: // updatedDesc
          return (b.updatedAt||0) - (a.updatedAt||0);
      }
    });

    list.innerHTML = '';
    if (!filtered.length) {
      const div = document.createElement('div');
      div.className = 'empty';
      div.textContent = '레시피가 없어요. 오른쪽 위에서 새 레시피를 추가해보세요!';
      list.replaceWith(list.cloneNode(true));
      el('main').innerHTML = '';
      el('main').appendChild(div);
      return;
    }
    el('main').innerHTML = '';
    const ul = document.createElement('ul'); ul.id='recipeList'; ul.className='cards';
    el('main').appendChild(ul);

    for (const r of filtered) {
      ul.appendChild(renderCard(r));
    }
  }

  function renderCard(r) {
    const tmpl = el('#recipeCardTmpl').content.cloneNode(true);
    const li = tmpl.querySelector('.card');
    const thumb = tmpl.querySelector('.thumb');
    const title = tmpl.querySelector('.title');
    const summary = tmpl.querySelector('.summary');
    const time = tmpl.querySelector('.time');
    const diff = tmpl.querySelector('.diff');
    const yieldEl = tmpl.querySelector('.yield');
    const tags = tmpl.querySelector('.tags');
    const ing = tmpl.querySelector('.ing');
    const steps = tmpl.querySelector('.steps');
    const notes = tmpl.querySelector('.notes');
    const editBtn = tmpl.querySelector('.edit');
    const delBtn = tmpl.querySelector('.delete');
    const dupBtn = tmpl.querySelector('.dup');

    title.textContent = r.title || '(제목 없음)';
    summary.textContent = r.summary || '';
    time.textContent = r.time ? `⏱ ${r.time}분` : '⏱ 시간 미입력';
    diff.textContent = r.difficulty ? `🧁 ${r.difficulty}` : '🧁 난이도 미입력';
    yieldEl.textContent = r.yield ? `🍽 ${r.yield}` : '';
    if (r.image) thumb.style.backgroundImage = `url('${r.image}')`;

    (r.tags||[]).forEach(t => {
      const s = document.createElement('span');
      s.className = 'tag'; s.textContent = `#${t}`;
      s.addEventListener('click', () => { state.tagFilter = t; updateTags(); render(); });
      tags.appendChild(s);
    });

    (r.ingredients||[]).forEach(i => {
      const li = document.createElement('li'); li.textContent = i; ing.appendChild(li);
    });
    (r.steps||[]).forEach(s => {
      const li = document.createElement('li'); li.textContent = s; steps.appendChild(li);
    });
    notes.textContent = r.notes || '';

    editBtn.addEventListener('click', () => openForm(r));
    delBtn.addEventListener('click', () => {
      if (confirm('이 레시피를 삭제할까요?')) {
        state.recipes = state.recipes.filter(x => x.id !== r.id);
        save(); render();
      }
    });
    dupBtn.addEventListener('click', () => {
      const copy = JSON.parse(JSON.stringify(r));
      copy.id = crypto.randomUUID();
      copy.title = r.title + ' (복제)';
      copy.createdAt = Date.now();
      copy.updatedAt = Date.now();
      state.recipes.unshift(copy);
      save(); render();
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
      image: 'https://images.unsplash.com/photo-1517677208171-0bc6725a3e60?q=80&w=1200&auto=format&fit=crop',
      ingredients: ['우유 500ml', '생크림 200ml', '설탕 70g', '달걀 3개', '바닐라 빈 1/2개', '소금 한 꼬집'],
      steps: ['오븐 150°C 예열', '우유+크림+바닐라를 데워 향을 우려낸다', '달걀+설탕+소금 섞기', '따뜻한 우유 혼합물을 조금씩 넣어 섞기', '체에 걸러 램킨에 붓고 중탕으로 30분 굽기', '식혀서 냉장'],
      notes: '설탕 일부를 흑설탕으로 바꾸면 풍미 업.' ,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }];
  }

  // Init
  updateTags();
  render();
})();
