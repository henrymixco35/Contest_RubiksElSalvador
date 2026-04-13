/**
 * results.js
 *
 */

const Results = (() => {

  let currentCat = null;
  const MO3_CATS = new Set(['6x6', '7x7']);
  const isMo3 = (cat) => MO3_CATS.has(cat);

  async function submit() {
    const result = {
      name:      AppState.contestant.name,
      email:     AppState.contestant.email,
      category:  AppState.contestant.category,
      country:   AppState.contestant.country || 'El Salvador',
      solves:    AppState.solves,
      best:      Timer.getBestDisplay(),
      ao5:       Timer.getAo5Display(),
      ao5ms:     Timer.getAo5Ms(),
      timestamp: new Date().toISOString(),
      status:    'pending',
    };

    try {
      const newId = await Storage.saveResult(result);
      result.id = newId;
    } catch (err) {
      console.error('[Results] saveResult:', err);
      UI.toast('⚠ Error al guardar resultados. Intentá de nuevo.');
      return;
    }

    AppState.results.push(result);
    AppState.lastOwnResult = result;

    const catName = AppState.contest.categories[AppState.contestant.category]?.name || '';
    document.getElementById('success-msg').textContent =
      `${result.name} — ${catName} — ${Timer.getStatLabel()}: ${result.ao5}`;

    document.getElementById('modal-success').classList.add('open');
  }

  function render(visibleCats) {
    const isOrg   = AppState.isOrganizer;
    const myEmail = AppState.contestant?.email || null;

    const relevantResults = AppState.results.filter(r => {
      if (isOrg)                   return true;
      if (r.status === 'approved') return true;
      if (r.email === myEmail)     return true;
      return false;
    });

    const allCatsInResults = {};
    relevantResults.forEach(r => { allCatsInResults[r.category] = true; });

    let catIds = Object.keys(allCatsInResults);
    if (visibleCats) catIds = catIds.filter(id => visibleCats.includes(id));

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

    const filtered = relevantResults
      .filter(r => r.category === currentCat)
      .sort((a, b) => {
        if (a.status === 'approved' && b.status !== 'approved') return -1;
        if (b.status === 'approved' && a.status !== 'approved') return  1;
        return (a.ao5ms ?? Infinity) - (b.ao5ms ?? Infinity);
      });

    const tbody = document.getElementById('results-tbody');
    tbody.innerHTML = '';

    if (!filtered.length) { noEl.style.display = ''; return; }
    noEl.style.display = 'none';

    const mo3         = isMo3(currentCat);
    const totalSolves = mo3 ? 3 : 5;
    const statLabel   = mo3 ? 'Mo3' : 'Ao5';

    const thead = document.querySelector('#results-table thead tr');
    if (thead) {
      thead.innerHTML = `<th>#</th><th>Nombre</th><th>País</th>`;
      for (let i = 1; i <= totalSolves; i++) thead.innerHTML += `<th>S${i}</th>`;
      thead.innerHTML += `<th>Mejor</th><th>${statLabel}</th><th>Estado</th>`;
    }

    let approvedRank = 0;

    filtered.forEach((r) => {
      const tr     = document.createElement('tr');
      const isOwn  = myEmail && r.email === myEmail;
      const status = r.status || 'pending';

      let posCell = '—';
      if (status === 'approved') {
        approvedRank++;
        posCell = approvedRank;
        tr.className = ['', 'rank-1', 'rank-2', 'rank-3'][approvedRank] || '';
      }

      const solveCells = (r.solves || []).map(s => {
        const t   = Timer.formatSolve(s);
        const cls = s.penalty === 'dnf' ? 'time-dnf' : s.penalty === 'plus2' ? 'time-plus' : '';
        return `<td class="${cls}">${t}</td>`;
      }).join('');
      const padding    = Array(totalSolves - (r.solves || []).length).fill('<td>—</td>').join('');
      const statusBadge = _statusBadge(status);
      const countryCell = r.country || '—';

      let actionCell = `<td>${statusBadge}</td>`;
      if (isOrg) {
        actionCell = `
          <td style="white-space:nowrap;">
            ${statusBadge}
            <div style="display:flex;gap:.3rem;margin-top:.35rem;flex-wrap:wrap;">
              ${status !== 'approved'  ? `<button class="approval-btn approve" onclick="Results.setStatus('${r.id}','approved')">✓ Aprobar</button>` : ''}
              ${status !== 'rejected'  ? `<button class="approval-btn reject"  onclick="Results.setStatus('${r.id}','rejected')">✕ Rechazar</button>` : ''}
              ${status !== 'pending'   ? `<button class="approval-btn pending" onclick="Results.setStatus('${r.id}','pending')">↺ Pendiente</button>` : ''}
            </div>
          </td>`;
      }

      tr.innerHTML = `
        <td>${posCell}</td>
        <td>${r.name}${isOwn ? ' <span class="own-badge">tú</span>' : ''}</td>
        <td style="color:var(--muted2);font-size:.75rem;">${countryCell}</td>
        ${solveCells}${padding}
        <td class="time-best">${r.best || '—'}</td>
        <td>${r.ao5 || '—'}</td>
        ${actionCell}
      `;
      if (isOwn) tr.classList.add('own-row');
      tbody.appendChild(tr);
    });
  }

  function _statusBadge(status) {
    const map = {
      pending:  `<span class="status-badge pending">⏳ Pendiente</span>`,
      approved: `<span class="status-badge approved">✓ Aprobado</span>`,
      rejected: `<span class="status-badge rejected">✕ Rechazado</span>`,
    };
    return map[status] || map.pending;
  }

  async function setStatus(resultId, newStatus) {
    if (!AppState.isOrganizer) return;
    try {
      await Storage.updateResultStatus(resultId, newStatus);
      UI.toast(newStatus === 'approved' ? '✓ Resultado aprobado' :
               newStatus === 'rejected' ? '✕ Resultado rechazado' : '↺ Marcado como pendiente');
    } catch (err) {
      console.error('[Results] setStatus:', err);
      UI.toast('⚠ Error al actualizar: ' + err.message);
    }
  }

  function exportCSV() {
    if (!currentCat) return;
    const catName   = AppState.contest.categories[currentCat]?.name || currentCat;
    const mo3csv    = isMo3(currentCat);
    const totalCsv  = mo3csv ? 3 : 5;
    const statCsv   = mo3csv ? 'Mo3' : 'Ao5';
    const solveHdrs = Array.from({length: totalCsv}, (_, i) => `S${i+1}`);
    const rows = [['#', 'Nombre', 'País', 'Email', ...solveHdrs, 'Mejor', statCsv, 'Estado']];

    AppState.results
      .filter(r => r.category === currentCat)
      .sort((a, b) => (a.ao5ms ?? Infinity) - (b.ao5ms ?? Infinity))
      .forEach((r, i) => {
        const solves = (r.solves || []).map(s => Timer.formatSolve(s));
        while (solves.length < totalCsv) solves.push('—');
        rows.push([i + 1, r.name, r.country || '—', r.email, ...solves, r.best || '—', r.ao5 || '—', r.status || 'pending']);
      });

    const csv  = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href     = URL.createObjectURL(blob);
    link.download = `resultados_${catName}_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  }

  return { submit, render, exportCSV, setStatus };
})();