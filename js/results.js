/**
 * results.js
 * ──────────────────────────────────────────────────────
 * Envío y visualización de resultados desde Firestore.
 * Los resultados se actualizan en tiempo real via onSnapshot.
 */

const Results = (() => {

  let currentCat = null;

  // ── Enviar resultados ────────────────────────────────

  async function submit() {
    const result = {
      name:      AppState.contestant.name,
      email:     AppState.contestant.email,
      category:  AppState.contestant.category,
      solves:    AppState.solves,
      best:      Timer.getBestDisplay(),
      ao5:       Timer.getAo5Display(),
      ao5ms:     Timer.getAo5Ms(),
      timestamp: new Date().toISOString(),
    };

    try {
      await Storage.saveResult(result);
      AppState.results.push(result);
      AppState.lastOwnResult = result;

      const catName = AppState.contest.categories[AppState.contestant.category]?.name || '';
      document.getElementById('success-msg').textContent =
        `${result.name} — ${catName} — Ao5: ${result.ao5}`;
      document.getElementById('modal-success').classList.add('open');
    } catch (err) {
      console.error('[Results] submit:', err);
      UI.toast('⚠ Error al enviar resultados. Intentá de nuevo.');
    }
  }

  // ── Renderizar tabla ─────────────────────────────────
  // visibleCats: array de IDs permitidos. null = organizador (ve todo).

  function render(visibleCats) {
    const allCatsInResults = {};
    AppState.results.forEach(r => { allCatsInResults[r.category] = true; });

    let catIds = Object.keys(allCatsInResults);
    if (visibleCats) {
      catIds = catIds.filter(id => visibleCats.includes(id));
    }

    const tabsEl = document.getElementById('result-cat-tabs');
    tabsEl.innerHTML = '';
    const noEl = document.getElementById('no-results');

    if (!catIds.length) {
      document.getElementById('results-tbody').innerHTML = '';
      noEl.style.display = '';
      noEl.textContent   = visibleCats
        ? 'Todavía no hay resultados en las categorías en que participaste.'
        : 'Aún no hay resultados.';
      return;
    }

    if (!currentCat || !catIds.includes(currentCat)) currentCat = catIds[0];

    catIds.forEach(id => {
      const catName = AppState.contest.categories[id]?.name || id;
      const btn = document.createElement('button');
      btn.className   = 'cat-tab' + (id === currentCat ? ' active' : '');
      btn.textContent = catName;
      btn.onclick     = () => { currentCat = id; render(visibleCats); };
      tabsEl.appendChild(btn);
    });

    const filtered = AppState.results
      .filter(r => r.category === currentCat)
      .sort((a, b) => (a.ao5ms ?? Infinity) - (b.ao5ms ?? Infinity));

    const tbody = document.getElementById('results-tbody');
    tbody.innerHTML = '';

    if (!filtered.length) { noEl.style.display = ''; return; }
    noEl.style.display = 'none';

    filtered.forEach((r, idx) => {
      const tr = document.createElement('tr');
      tr.className = ['', 'rank-1', 'rank-2', 'rank-3'][idx + 1] || '';

      const solveCells = (r.solves || []).map(s => {
        const t   = Timer.formatSolve(s);
        const cls = s.penalty === 'dnf' ? 'time-dnf' : s.penalty === 'plus2' ? 'time-plus' : '';
        return `<td class="${cls}">${t}</td>`;
      }).join('');
      const padding = Array(5 - (r.solves || []).length).fill('<td>—</td>').join('');
      const isOwn   = AppState.contestant && r.email === AppState.contestant.email;

      tr.innerHTML = `
        <td>${idx + 1}</td>
        <td>${r.name}${isOwn ? ' <span class="own-badge">tú</span>' : ''}</td>
        ${solveCells}${padding}
        <td class="time-best">${r.best || '—'}</td>
        <td>${r.ao5 || '—'}</td>
      `;
      if (isOwn) tr.classList.add('own-row');
      tbody.appendChild(tr);
    });
  }

  // ── Exportar CSV ─────────────────────────────────────

  function exportCSV() {
    if (!currentCat) return;
    const catName = AppState.contest.categories[currentCat]?.name || currentCat;
    const rows = [['#', 'Nombre', 'Email', 'S1', 'S2', 'S3', 'S4', 'S5', 'Mejor', 'Ao5']];

    AppState.results
      .filter(r => r.category === currentCat)
      .sort((a, b) => (a.ao5ms ?? Infinity) - (b.ao5ms ?? Infinity))
      .forEach((r, i) => {
        const solves = (r.solves || []).map(s => Timer.formatSolve(s));
        while (solves.length < 5) solves.push('—');
        rows.push([i + 1, r.name, r.email, ...solves, r.best || '—', r.ao5 || '—']);
      });

    const csv  = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href     = URL.createObjectURL(blob);
    link.download = `resultados_${catName}_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  }

  return { submit, render, exportCSV };
})();
