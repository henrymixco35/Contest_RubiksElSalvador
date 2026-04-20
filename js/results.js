/**
 * results.js
 *
 */

const Results = (() => {

  let currentCat    = null;
  let _isSubmitting = false;

  const MO3_CATS = new Set(['6x6', '7x7']);
  const isMo3 = (cat) => MO3_CATS.has(cat);

  async function submit() {
    if (_isSubmitting) return;

    const dupCheck = AppState.results.some(
      r => r.email === AppState.contestant.email &&
           r.category === AppState.contestant.category
    );
    if (dupCheck) {
      UI.toast('⚠ Ya enviaste resultados en esta categoría');
      return;
    }

    _isSubmitting = true;

    const submitBtn = document.querySelector('#submit-section .btn-primary');
    if (submitBtn) {
      submitBtn.disabled    = true;
      submitBtn.textContent = '⏳ Enviando…';
    }

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
      _isSubmitting = false;
      if (submitBtn) {
        submitBtn.disabled    = false;
        submitBtn.textContent = '✓ Enviar Resultados';
      }
      return;
    }

    AppState.results.push(result);
    AppState.lastOwnResult = result;

    SessionStore.clear();

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

  /* ──────────────────────────────────────────────────────
     EXPORTAR — reporte HTML profesional
     ────────────────────────────────────────────────────── */
  function exportCSV() {
    if (!currentCat) return;

    const catName     = AppState.contest.categories[currentCat]?.name || currentCat;
    const contestName = AppState.contest.name || 'Rubik\'s El Salvador — Contest Online';
    const mo3exp      = isMo3(currentCat);
    const totalExp    = mo3exp ? 3 : 5;
    const statExp     = mo3exp ? 'Mo3' : 'Ao5';
    const exportDate  = new Date().toLocaleDateString('es-SV', {
      year: 'numeric', month: 'long', day: 'numeric',
    });

    const sortedResults = AppState.results
      .filter(r => r.category === currentCat && (r.status || 'pending') === 'approved')
      .sort((a, b) => (a.ao5ms ?? Infinity) - (b.ao5ms ?? Infinity));

    /* Armar filas de la tabla */
    const rowsHtml = sortedResults.map((r, idx) => {
      const pos   = idx + 1;
      const medal = pos === 1 ? '🥇' : pos === 2 ? '🥈' : pos === 3 ? '🥉' : '';

      const solveCols = Array.from({ length: totalExp }, (_, i) => {
        const s = (r.solves || [])[i];
        if (!s) return `<td class="time-cell">—</td>`;
        const t   = Timer.formatSolve(s);
        const cls = s.penalty === 'dnf' ? 'time-dnf' : s.penalty === 'plus2' ? 'time-plus' : '';
        return `<td class="time-cell ${cls}">${t}</td>`;
      }).join('');

      const rowClass = pos <= 3 ? `row-top row-top-${pos}` : (idx % 2 === 0 ? 'row-even' : 'row-odd');

      return `
        <tr class="${rowClass}">
          <td class="pos-cell">${medal || pos}</td>
          <td class="name-cell">${_escHtml(r.name)}</td>
          <td class="country-cell">${_escHtml(r.country || '—')}</td>
          ${solveCols}
          <td class="best-cell">${r.best || '—'}</td>
          <td class="stat-cell">${r.ao5 || '—'}</td>
        </tr>`;
    }).join('');

    /* Cabeceras de solves */
    const solveHeaders = Array.from({ length: totalExp }, (_, i) =>
      `<th>S${i + 1}</th>`).join('');

    /* Resumen de podio */
    const podiumHtml = sortedResults.slice(0, 3).map((r, i) => {
      const medals = ['🥇', '🥈', '🥉'];
      return `
        <div class="podium-card podium-${i + 1}">
          <div class="podium-medal">${medals[i]}</div>
          <div class="podium-name">${_escHtml(r.name)}</div>
          <div class="podium-country">${_escHtml(r.country || '—')}</div>
          <div class="podium-time">${r.ao5 || '—'}</div>
          <div class="podium-label">${statExp}</div>
        </div>`;
    }).join('');

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Resultados — ${_escHtml(catName)} — ${_escHtml(contestName)}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');

  :root {
    --bg:       #07080f;
    --surface:  #0f1120;
    --surface2: #141727;
    --border:   rgba(255,255,255,.10);
    --text:     #eef0f8;
    --muted:    #5a5f7a;
    --muted2:   #8890aa;
    --accent:   #3a7bd5;
    --accent2:  #e84560;
    --accent3:  #f0c040;
    --accent4:  #4ec9b0;
    --gold:     #ffd700;
    --silver:   #c0c8d8;
    --bronze:   #cd8b4a;
    --mono: 'Space Mono', monospace;
    --sans: 'Plus Jakarta Sans', sans-serif;
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    background: var(--bg);
    color: var(--text);
    font-family: var(--sans);
    min-height: 100vh;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  /* Grid background */
  body::before {
    content: '';
    position: fixed; inset: 0;
    background-image:
      linear-gradient(rgba(58,123,213,.025) 1px, transparent 1px),
      linear-gradient(90deg, rgba(58,123,213,.025) 1px, transparent 1px);
    background-size: 48px 48px;
    pointer-events: none;
    z-index: 0;
  }

  .wrap { position: relative; z-index: 1; max-width: 960px; margin: 0 auto; padding: 2.5rem 2rem 4rem; }

  /* ── Header ── */
  .report-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 1rem;
    padding-bottom: 1.5rem;
    border-bottom: 1px solid var(--border);
    margin-bottom: 2rem;
  }

  .report-logo {
    font-family: var(--mono);
    font-size: .75rem;
    font-weight: 700;
    letter-spacing: .08em;
    color: var(--accent);
    text-transform: uppercase;
    margin-bottom: .4rem;
  }

  .report-title {
    font-size: 1.9rem;
    font-weight: 700;
    letter-spacing: -.02em;
    line-height: 1.15;
  }

  .report-title span { color: var(--accent); }

  .report-meta {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: .3rem;
  }

  .report-meta-item {
    font-family: var(--mono);
    font-size: .65rem;
    letter-spacing: .1em;
    color: var(--muted2);
    text-transform: uppercase;
  }

  .cat-pill {
    display: inline-block;
    background: rgba(58,123,213,.18);
    color: var(--accent);
    border: 1px solid rgba(58,123,213,.35);
    border-radius: 3px;
    font-family: var(--mono);
    font-size: .65rem;
    font-weight: 700;
    letter-spacing: .1em;
    text-transform: uppercase;
    padding: .25rem .75rem;
  }

  /* ── Podio ── */
  .podium-section { margin-bottom: 2.5rem; }

  .section-label {
    font-family: var(--mono);
    font-size: .6rem;
    letter-spacing: .18em;
    text-transform: uppercase;
    color: var(--muted);
    margin-bottom: 1rem;
  }

  .podium-grid {
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .podium-card {
    flex: 1 1 200px;
    border-radius: 8px;
    padding: 1.2rem 1.4rem;
    border: 1px solid var(--border);
    background: var(--surface);
    position: relative;
    overflow: hidden;
  }

  .podium-card::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 3px;
  }

  .podium-1::before { background: var(--gold); }
  .podium-2::before { background: var(--silver); }
  .podium-3::before { background: var(--bronze); }

  .podium-medal { font-size: 1.6rem; margin-bottom: .5rem; }
  .podium-name  { font-weight: 700; font-size: 1rem; margin-bottom: .15rem; }
  .podium-country { font-size: .78rem; color: var(--muted2); margin-bottom: .8rem; }
  .podium-time  { font-family: var(--mono); font-size: 1.5rem; font-weight: 700; color: var(--accent3); }
  .podium-label { font-family: var(--mono); font-size: .6rem; color: var(--muted); letter-spacing: .12em; text-transform: uppercase; margin-top: .1rem; }

  /* ── Tabla ── */
  .table-section { margin-bottom: 2rem; }

  .table-wrap {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    overflow: auto;
  }

  table { width: 100%; border-collapse: collapse; font-family: var(--mono); font-size: .78rem; }

  thead th {
    padding: .75rem 1rem;
    text-align: left;
    font-size: .58rem;
    letter-spacing: .15em;
    text-transform: uppercase;
    color: var(--muted);
    border-bottom: 1px solid var(--border);
    white-space: nowrap;
    background: var(--surface2);
  }

  tbody td {
    padding: .65rem 1rem;
    border-bottom: 1px solid rgba(255,255,255,.04);
    vertical-align: middle;
  }

  tbody tr:last-child td { border-bottom: none; }

  .row-even td { background: rgba(255,255,255,.01); }
  .row-odd  td { background: transparent; }

  .row-top-1 td { background: rgba(255,215,0,.05);   }
  .row-top-2 td { background: rgba(192,200,216,.04); }
  .row-top-3 td { background: rgba(205,139,74,.04);  }

  .row-top-1 .pos-cell { color: var(--gold);   font-size: 1rem; }
  .row-top-2 .pos-cell { color: var(--silver); font-size: 1rem; }
  .row-top-3 .pos-cell { color: var(--bronze); font-size: 1rem; }

  .pos-cell     { font-weight: 700; color: var(--muted2); text-align: center; }
  .name-cell    { font-family: var(--sans); font-weight: 600; font-size: .88rem; }
  .country-cell { color: var(--muted2); font-size: .72rem; }
  .time-cell    { text-align: right; }
  .best-cell    { text-align: right; color: var(--accent4); font-weight: 700; }
  .stat-cell    { text-align: right; color: var(--accent3); font-weight: 700; }
  .status-cell  { text-align: center; }

  .time-dnf  { color: var(--accent2) !important; }
  .time-plus { color: var(--accent3) !important; }

  /* ── Badges ── */
  .badge {
    display: inline-block;
    font-family: var(--mono);
    font-size: .58rem;
    font-weight: 700;
    letter-spacing: .07em;
    text-transform: uppercase;
    padding: .18rem .55rem;
    border-radius: 3px;
    border: 1px solid;
    white-space: nowrap;
  }
  .badge-approved { background: rgba(78,201,176,.12);  color: var(--accent4); border-color: rgba(78,201,176,.3); }
  .badge-rejected { background: rgba(232,69,96,.12);   color: var(--accent2); border-color: rgba(232,69,96,.25); }
  .badge-pending  { background: rgba(240,192,64,.1);   color: var(--accent3); border-color: rgba(240,192,64,.25); }

  /* ── Footer ── */
  .report-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: .5rem;
    padding-top: 1.5rem;
    border-top: 1px solid var(--border);
    font-family: var(--mono);
    font-size: .62rem;
    color: var(--muted);
    letter-spacing: .07em;
  }

  /* ── Print ── */
  @media print {
    body::before { display: none; }
    body { background: #fff; color: #111; }
    :root {
      --bg: #fff; --surface: #f8f9fc; --surface2: #f0f2f8;
      --text: #111; --muted: #777; --muted2: #555;
      --border: rgba(0,0,0,.1);
      --accent: #1a5cb8; --accent2: #c0103a;
      --accent3: #b07a00; --accent4: #0f8a6a;
    }
    .wrap { max-width: 100%; padding: 1.5rem; }
    .podium-card { page-break-inside: avoid; }
    table        { page-break-inside: auto; }
    tr           { page-break-inside: avoid; }
  }
</style>
</head>
<body>
<div class="wrap">

  <header class="report-header">
    <div>
      <div class="report-logo">Comunidad Rubik's El Salvador</div>
      <div class="report-title">
        Resultados — <span>${_escHtml(catName)}</span>
      </div>
      <div style="margin-top:.5rem;">${_escHtml(contestName)}</div>
    </div>
    <div class="report-meta">
      <span class="cat-pill">${_escHtml(catName)} · ${statExp}</span>
      <span class="report-meta-item">Exportado: ${exportDate}</span>
      <span class="report-meta-item">${sortedResults.length} participante${sortedResults.length !== 1 ? 's' : ''}</span>
    </div>
  </header>

  ${podiumHtml ? `
  <section class="podium-section">
    <div class="section-label">Podio</div>
    <div class="podium-grid">${podiumHtml}</div>
  </section>` : ''}

  <section class="table-section">
    <div class="section-label">Tabla completa</div>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th style="text-align:center;">#</th>
            <th>Nombre</th>
            <th>País</th>
            ${solveHeaders}
            <th style="text-align:right;">Mejor</th>
            <th style="text-align:right;">${statExp}</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </div>
  </section>

  <footer class="report-footer">
    <span>Comunidad Rubik's El Salvador · contestrubikelsalvador.web.app</span>
    <span>${exportDate}</span>
  </footer>

</div>
</body>
</html>`;

    const blob = new Blob([html], { type: 'text/html;charset=utf-8;' });
    const link = document.createElement('a');
    link.href     = URL.createObjectURL(blob);
    link.download = `resultados_${catName}_${new Date().toISOString().slice(0, 10)}.html`;
    link.click();
  }

  function _escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function resetSubmitFlag() { _isSubmitting = false; }

  return { submit, render, exportCSV, setStatus, resetSubmitFlag };
})();