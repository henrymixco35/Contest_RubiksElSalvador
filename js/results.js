/**
 * results.js
 */

const Results = (() => {

  let currentCat    = null;
  let _isSubmitting = false;

  const MO3_CATS = new Set(['6x6', '7x7']);
  const isMo3 = (cat) => MO3_CATS.has(cat);

  /* ── Envío de resultados ────────────────────────────── */
  async function submit() {
    if (_isSubmitting) return;

    // Verificar duplicado antes de bloquear UI
    const dupCheck = AppState.results.some(
      r => r.email    === AppState.contestant.email &&
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
      result.id   = newId;

      // ── Envío exitoso ──────────────────────────────────
      Logger.info('results_submitted', {
        resultId: newId,
        ao5:      result.ao5,
        ao5ms:    result.ao5ms,
        best:     result.best,
        solves:   result.solves.map(s => ({
          ms:      s.ms,
          penalty: s.penalty || null,
          display: Timer.formatSolve(s),
        })),
      });

      AppState.results.push(result);
      AppState.lastOwnResult = result;

      // Limpiar la sesión guardada
      SessionStore.clear();
      const submittedName     = AppState.contestant.name;
      const submittedCatName  = AppState.contest.categories[AppState.contestant.category]?.name || '';
      AppState.contestant     = null;
      AppState.solves         = [];
      AppState.currentSolve   = 0;
      AppState.currentPenalty = null;

      document.getElementById('success-msg').textContent =
        `${submittedName} — ${submittedCatName} — ${Timer.getStatLabel()}: ${result.ao5}`;

      document.getElementById('modal-success').classList.add('open');

    } catch (err) {
      // ── Error al guardar ───────────────────────────────
      Logger.error('submit_failed', {
        errorCode:    err?.code    || null,
        errorMessage: err?.message || String(err),
        solves:       AppState.solves.map(s => ({
          ms:      s.ms,
          penalty: s.penalty || null,
          display: Timer.formatSolve(s),
        })),
        ao5:  Timer.getAo5Display(),
        best: Timer.getBestDisplay(),
      });

      console.error('[Results] saveResult:', err);
      UI.toast('⚠ Error al guardar resultados. Intentá de nuevo.');

    } finally {
      _isSubmitting = false;
      if (submitBtn) {
        submitBtn.disabled    = false;
        submitBtn.textContent = '✓ Enviar Resultados';
      }
    }
  }

  /* ── Render de tabla ────────────────────────────────── */
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
      const btn     = document.createElement('button');
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

    filtered.forEach(r => {
      const tr     = document.createElement('tr');
      const isOwn  = myEmail && r.email === myEmail;
      const status = r.status || 'pending';

      let posCell = '—';
      if (status === 'approved') {
        approvedRank++;
        posCell     = approvedRank;
        tr.className = ['', 'rank-1', 'rank-2', 'rank-3'][approvedRank] || '';
      }

      const solveCells = (r.solves || []).map(s => {
        const t   = Timer.formatSolve(s);
        const cls = s.penalty === 'dnf'   ? 'time-dnf'  :
                    s.penalty === 'plus2' ? 'time-plus'  : '';
        return `<td class="${cls}">${t}</td>`;
      }).join('');
      const padding     = Array(totalSolves - (r.solves || []).length)
                            .fill('<td>—</td>').join('');
      const statusBadge = _statusBadge(status);

      let actionCell = `<td>${statusBadge}</td>`;
      if (isOrg) {
        actionCell = `
          <td style="white-space:nowrap;">
            ${statusBadge}
            <div style="display:flex;gap:.3rem;margin-top:.35rem;flex-wrap:wrap;">
              ${status !== 'approved'
                ? `<button class="approval-btn approve"
                           onclick="Results.setStatus('${r.id}','approved')">✓ Aprobar</button>`
                : ''}
              ${status !== 'rejected'
                ? `<button class="approval-btn reject"
                           onclick="Results.setStatus('${r.id}','rejected')">✕ Rechazar</button>`
                : ''}
              ${status !== 'pending'
                ? `<button class="approval-btn pending"
                           onclick="Results.setStatus('${r.id}','pending')">↺ Pendiente</button>`
                : ''}
            </div>
          </td>`;
      }

      tr.innerHTML = `
        <td>${posCell}</td>
        <td>${r.name}${isOwn ? ' <span class="own-badge">tú</span>' : ''}</td>
        <td style="color:var(--muted2);font-size:.75rem;">${r.country || '—'}</td>
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

  /* ── Cambio de estado (organizador) ─────────────────── */
  async function setStatus(resultId, newStatus) {
    if (!AppState.isOrganizer) return;
    try {
      await Storage.updateResultStatus(resultId, newStatus);
      UI.toast(
        newStatus === 'approved' ? '✓ Resultado aprobado'  :
        newStatus === 'rejected' ? '✕ Resultado rechazado' :
        '↺ Marcado como pendiente'
      );
    } catch (err) {
      console.error('[Results] setStatus:', err);
      UI.toast('⚠ Error al actualizar: ' + err.message);
    }
  }

  /* ── Exportar HTML ──────────────────────────────────── */
  function exportCSV() {
    if (!currentCat) return;

    const catName     = AppState.contest.categories[currentCat]?.name || currentCat;
    const contestName = AppState.contest.name || 'Rubik\'s El Salvador';
    const mo3exp      = isMo3(currentCat);
    const totalExp    = mo3exp ? 3 : 5;
    const statExp     = mo3exp ? 'Mo3' : 'Ao5';
    const exportDate  = new Date().toLocaleDateString('es-SV', {
      year: 'numeric', month: 'long', day: 'numeric',
    });

    const sorted = AppState.results
      .filter(r => r.category === currentCat && (r.status || 'pending') === 'approved')
      .sort((a, b) => (a.ao5ms ?? Infinity) - (b.ao5ms ?? Infinity));

    const solveHeaders = Array.from(
      { length: totalExp }, (_, i) => `<th>${i + 1}</th>`
    ).join('');

    const C_DNF   = '#e84560';  // rojo  — DNF / peor tiempo
    const C_BEST  = '#4ec9b0';  // verde — mejor tiempo
    const C_PLUS2 = '#f0c040';  // amarillo — +2
    const C_AVG   = '#f0c040';  // amarillo — Ao5/Mo3
    const C_MUTED = '#7a8099';  // gris  — país

    const tableRows = sorted.map((r, idx) => {
      const pos    = idx + 1;
      const medal  = pos === 1 ? '🥇' : pos === 2 ? '🥈' : pos === 3 ? '🥉' : pos;

      // Fondo de fila según posición
      const rowBg  = pos === 1 ? 'background:rgba(255,215,0,.05)'
                   : pos === 2 ? 'background:rgba(184,196,216,.03)'
                   : pos === 3 ? 'background:rgba(205,139,74,.035)'
                   : idx % 2 === 0 ? 'background:rgba(255,255,255,.009)' : '';

      // Color del número/medalla de posición
      const posCl  = pos === 1 ? '#ffd700' : pos === 2 ? '#b8c4d8' : pos === 3 ? '#cd8b4a' : '#5a5f7a';

      const times   = (r.solves || []).map(s => Timer.getSolveMs(s));
      const srtd    = [...times].sort((a, b) => a - b);
      const worstMs = srtd[srtd.length - 1];
      const bestMs  = srtd[0];

      const solveCols = Array.from({ length: totalExp }, (_, i) => {
        const s = (r.solves || [])[i];
        if (!s) return `<td style="text-align:center;padding:7px 10px;">—</td>`;
        const ms = Timer.getSolveMs(s);

        let color = '';
        if      (s.penalty === 'dnf')                           color = C_DNF;
        else if (!mo3exp && ms === worstMs)                     color = C_DNF;
        else if (!mo3exp && ms === bestMs && ms !== worstMs)    color = C_BEST;
        else if (s.penalty === 'plus2')                         color = C_PLUS2;

        let txt;
        if (s.penalty === 'dnf') {
          txt = 'DNF';
        } else {
          const baseMs = s.ms + (s.penalty === 'plus2' ? 2000 : 0);
          txt = Timer.msToDisplay(baseMs);
          if (s.penalty === 'plus2') txt += ' +2';
        }

        const st = color ? `color:${color};font-weight:700;` : '';
        return `<td style="text-align:center;padding:5px 8px;white-space:nowrap;${st}">${txt}</td>`;
      }).join('');

      // Best y Ao5 también inline
      const bestTxt = (r.best || '—');
      const avgTxt  = (r.ao5  || '—');

      return `<tr style="${rowBg}">
        <td style="text-align:center;padding:5px 6px;font-weight:700;color:${posCl};font-size:.82rem;">${medal}</td>
        <td style="text-align:left;padding:5px 10px;font-family:'Plus Jakarta Sans',sans-serif;font-weight:600;font-size:.74rem;white-space:nowrap;">${_escHtml(r.name)}</td>
        <td style="text-align:left;padding:5px 8px;color:${C_MUTED};font-size:.62rem;">${_escHtml(r.country || '—')}</td>
        ${solveCols}
        <td style="text-align:center;padding:5px 8px;color:${C_BEST};font-weight:700;white-space:nowrap;">${bestTxt}</td>
        <td style="text-align:center;padding:5px 8px;color:${C_AVG};font-weight:700;white-space:nowrap;">${avgTxt}</td>
      </tr>`;
    }).join('');

    const podiumCards = sorted.slice(0, 3).map((r, i) => {
      const medals  = ['🥇', '🥈', '🥉'];
      const topClrs = ['#ffd700', '#b8c4d8', '#cd8b4a'];
      return `<div style="background:#0f1120;border:1px solid rgba(255,255,255,.09);border-radius:5px;padding:6px 8px;position:relative;overflow:hidden;">
        <div style="position:absolute;top:0;left:0;right:0;height:2px;background:${topClrs[i]};"></div>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:2px;">
          <span style="font-size:.78rem;">${medals[i]}</span>
          <span style="font-family:'Space Mono',monospace;font-size:.82rem;font-weight:700;color:#f0c040;">${r.ao5 || '—'}</span>
        </div>
        <div style="font-size:.72rem;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${_escHtml(r.name)}</div>
        <div style="font-size:.58rem;color:#7a8099;font-family:'Space Mono',monospace;">${_escHtml(r.country || '—')}</div>
      </div>`;
    }).join('');

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8"/>
<title>${_escHtml(catName)} — ${_escHtml(contestName)}</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Plus+Jakarta+Sans:wght@500;600;700&display=swap');
*{box-sizing:border-box;margin:0;padding:0;}
body{background:#07080f;color:#eef0f8;font-family:'Space Mono',monospace;width:820px;margin:0 auto;padding:12px 14px 18px;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
.hdr{display:flex;align-items:flex-start;justify-content:space-between;padding-bottom:8px;border-bottom:1px solid rgba(255,255,255,.09);margin-bottom:8px;}
.tag{font-family:'Space Mono',monospace;font-size:.5rem;letter-spacing:.11em;text-transform:uppercase;color:#3a7bd5;background:rgba(58,123,213,.12);border:1px solid rgba(58,123,213,.28);border-radius:3px;padding:.15rem .45rem;margin-right:5px;display:inline-block;margin-bottom:4px;}
.ci{font-family:'Space Mono',monospace;font-size:.55rem;color:#7a8099;}
.tc{font-size:.95rem;font-weight:700;}
.tf{font-family:'Space Mono',monospace;font-size:.55rem;color:#f0c040;margin-left:6px;}
.hr{font-family:'Space Mono',monospace;font-size:.5rem;color:#5a5f7a;text-align:right;line-height:1.75;}
.hr strong{color:#eef0f8;font-size:.58rem;}
.pod{display:grid;grid-template-columns:repeat(3,1fr);gap:5px;margin-bottom:8px;}
.tbl-wrap{background:#0f1120;border:1px solid rgba(255,255,255,.09);border-radius:5px;overflow:hidden;}
table{width:100%;border-collapse:collapse;font-family:'Space Mono',monospace;font-size:.68rem;}
thead tr{background:#141727;}
thead th{padding:4px 8px;text-align:center;font-size:.48rem;letter-spacing:.11em;text-transform:uppercase;color:#5a5f7a;border-bottom:1px solid rgba(255,255,255,.09);white-space:nowrap;font-weight:400;}
thead th:nth-child(2){text-align:left;}
thead th:nth-child(3){text-align:left;}
tbody tr:last-child td{border-bottom:none;}
tbody td{border-bottom:1px solid rgba(255,255,255,.03);vertical-align:middle;}
.ft{display:flex;justify-content:space-between;margin-top:7px;font-family:'Space Mono',monospace;font-size:.48rem;color:#5a5f7a;}
@media print{
  body{background:#fff!important;color:#111!important;width:100%!important;}
  .tbl-wrap{background:#f5f6fa!important;border-color:rgba(0,0,0,.1)!important;}
  thead tr{background:#eaecf4!important;}
}
</style>
</head>
<body>
<div class="hdr">
  <div>
    <div><span class="tag">Comunidad Rubik's SV</span><span class="ci">${_escHtml(contestName)}</span></div>
    <div style="display:flex;align-items:baseline;margin-top:3px;">
      <span class="tc">${_escHtml(catName)}</span>
      <span class="tf">Formato: ${statExp} · Clasificación por ${statExp === 'Mo3' ? 'Media' : 'Average'}</span>
    </div>
  </div>
  <div class="hr">
    <div><strong>${sorted.length}</strong> participante${sorted.length !== 1 ? 's' : ''}</div>
    <div>${exportDate}</div>
  </div>
</div>
${sorted.length >= 1 ? `<div class="pod">${podiumCards}</div>` : ''}
<div class="tbl-wrap">
  <table>
    <thead>
      <tr>
        <th style="width:36px;">#</th>
        <th>Nombre</th>
        <th>País</th>
        ${solveHeaders}
        <th>Best</th>
        <th>${statExp}</th>
      </tr>
    </thead>
    <tbody>${tableRows}</tbody>
  </table>
</div>
<div class="ft">
  <span>Comunidad Rubik's El Salvador</span>
  <span>${exportDate}</span>
</div>
</body>
</html>`;

    const blob = new Blob([html], { type: 'text/html;charset=utf-8;' });
    const link = document.createElement('a');
    link.href     = URL.createObjectURL(blob);
    link.download = `resultados_${catName}_${new Date().toISOString().slice(0,10)}.html`;
    link.click();
  }

  function _escHtml(str) {
    return String(str)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function resetSubmitFlag() { _isSubmitting = false; }

  return { submit, render, exportCSV, setStatus, resetSubmitFlag };
})();