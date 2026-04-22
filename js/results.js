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

    const tableRows = sorted.map((r, idx) => {
      const pos    = idx + 1;
      const medal  = pos === 1 ? '🥇' : pos === 2 ? '🥈' : pos === 3 ? '🥉' : pos;
      const rowCls = pos === 1 ? 'r1' : pos === 2 ? 'r2' : pos === 3 ? 'r3'
                   : idx % 2 === 0 ? 're' : 'ro';

      const times   = (r.solves || []).map(s => Timer.getSolveMs(s));
      const srtd    = [...times].sort((a, b) => a - b);
      const worstMs = srtd[srtd.length - 1];
      const bestMs  = srtd[0];

      const solveCols = Array.from({ length: totalExp }, (_, i) => {
        const s = (r.solves || [])[i];
        if (!s) return `<td>—</td>`;
        const t   = Timer.formatSolve(s);
        const ms  = Timer.getSolveMs(s);
        let cls   = '';
        if (s.penalty === 'dnf')                             cls = 'td';
        else if (!mo3exp && ms === worstMs)                  cls = 'tw';
        else if (!mo3exp && ms === bestMs && ms !== worstMs) cls = 'tb';
        else if (s.penalty === 'plus2')                      cls = 'tp';
        return `<td class="${cls}">${t}</td>`;
      }).join('');

      return `<tr class="${rowCls}">
        <td class="pos">${medal}</td>
        <td class="name">${_escHtml(r.name)}</td>
        <td class="country">${_escHtml(r.country || '—')}</td>
        ${solveCols}
        <td class="best">${r.best || '—'}</td>
        <td class="avg">${r.ao5 || '—'}</td>
      </tr>`;
    }).join('');

    const podiumCards = sorted.slice(0, 3).map((r, i) => {
      const medals = ['🥇', '🥈', '🥉'];
      const cls    = ['p1', 'p2', 'p3'];
      return `<div class="pc ${cls[i]}">
        <div class="pc-row">
          <span class="pc-medal">${medals[i]}</span>
          <span class="pc-avg">${r.ao5 || '—'}</span>
        </div>
        <div class="pc-name">${_escHtml(r.name)}</div>
        <div class="pc-ctry">${_escHtml(r.country || '—')}</div>
      </div>`;
    }).join('');

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8"/>
<title>${_escHtml(catName)} — ${_escHtml(contestName)}</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Plus+Jakarta+Sans:wght@500;600;700&display=swap');
:root{
  --bg:#07080f;--sf:#0f1120;--sf2:#141727;--bd:rgba(255,255,255,.09);
  --tx:#eef0f8;--mu:#5a5f7a;--m2:#7a8099;
  --ac:#3a7bd5;--a2:#e84560;--a3:#f0c040;--a4:#4ec9b0;
  --gd:#ffd700;--sv:#b8c4d8;--bz:#cd8b4a;
  --mo:'Space Mono',monospace;--sa:'Plus Jakarta Sans',sans-serif;
}
*{box-sizing:border-box;margin:0;padding:0;}
body{background:var(--bg);color:var(--tx);font-family:var(--sa);width:820px;margin:0 auto;padding:14px 16px 20px;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
.hdr{display:flex;align-items:flex-start;justify-content:space-between;padding-bottom:9px;border-bottom:1px solid var(--bd);margin-bottom:9px;}
.tag{font-family:var(--mo);font-size:.54rem;letter-spacing:.11em;text-transform:uppercase;color:var(--ac);background:rgba(58,123,213,.12);border:1px solid rgba(58,123,213,.28);border-radius:3px;padding:.18rem .5rem;margin-right:6px;}
.ci{font-family:var(--mo);font-size:.58rem;color:var(--m2);}
.tb{display:flex;align-items:baseline;gap:7px;margin-top:3px;}
.tc{font-size:1.05rem;font-weight:700;letter-spacing:-.01em;}
.tf{font-family:var(--mo);font-size:.6rem;color:var(--a3);}
.hr{font-family:var(--mo);font-size:.54rem;color:var(--mu);text-align:right;line-height:1.85;}
.hr strong{color:var(--tx);font-size:.63rem;}
.pod{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:9px;}
.pc{background:var(--sf);border:1px solid var(--bd);border-radius:5px;padding:7px 9px;position:relative;overflow:hidden;}
.pc::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;}
.p1::before{background:var(--gd);}.p2::before{background:var(--sv);}.p3::before{background:var(--bz);}
.pc-row{display:flex;align-items:center;justify-content:space-between;margin-bottom:2px;}
.pc-medal{font-size:.85rem;}
.pc-avg{font-family:var(--mo);font-size:.88rem;font-weight:700;color:var(--a3);}
.pc-name{font-size:.77rem;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.pc-ctry{font-size:.6rem;color:var(--m2);font-family:var(--mo);}
.tw{background:var(--sf);border:1px solid var(--bd);border-radius:5px;overflow:hidden;}
.th{display:flex;align-items:center;justify-content:space-between;padding:5px 9px;background:var(--sf2);border-bottom:1px solid var(--bd);}
.tl{font-family:var(--mo);font-size:.52rem;letter-spacing:.12em;text-transform:uppercase;color:var(--mu);}
.tc2{font-family:var(--mo);font-size:.52rem;color:var(--m2);}
table{width:100%;border-collapse:collapse;font-family:var(--mo);font-size:.68rem;}
thead th{padding:5px 8px;text-align:center;font-size:.5rem;letter-spacing:.11em;text-transform:uppercase;color:var(--mu);border-bottom:1px solid var(--bd);background:var(--sf2);white-space:nowrap;}
thead th.thn,thead th.thc{text-align:left;}
tbody td{padding:4px 8px;border-bottom:1px solid rgba(255,255,255,.03);vertical-align:middle;text-align:center;white-space:nowrap;}
tbody tr:last-child td{border-bottom:none;}
td.pos{text-align:center;font-weight:700;color:var(--m2);}
td.name{text-align:left;font-family:var(--sa);font-weight:600;font-size:.74rem;padding-left:9px;}
td.country{text-align:left;color:var(--m2);font-size:.61rem;}
td.best{color:var(--a4);font-weight:700;}
td.avg{color:var(--a3);font-weight:700;}
td.td{color:var(--a2);}
td.tw{color:var(--a2);text-decoration:underline dotted;}
td.tb{color:var(--a4);}
td.tp{color:var(--a3);}
tr.r1 td{background:rgba(255,215,0,.05);}tr.r2 td{background:rgba(184,196,216,.03);}
tr.r3 td{background:rgba(205,139,74,.035);}tr.re td{background:rgba(255,255,255,.009);}
tr.r1 td.pos{color:var(--gd);font-size:.88rem;}tr.r2 td.pos{color:var(--sv);font-size:.88rem;}tr.r3 td.pos{color:var(--bz);font-size:.88rem;}
.ft{display:flex;justify-content:space-between;margin-top:8px;font-family:var(--mo);font-size:.5rem;color:var(--mu);}
@media print{body{background:#fff;color:#111;width:100%;}:root{--bg:#fff;--sf:#f5f6fa;--sf2:#eaecf4;--tx:#111;--mu:#888;--m2:#666;--bd:rgba(0,0,0,.1);--ac:#1a5cb8;--a2:#c0103a;--a3:#8a6000;--a4:#0f7a5f;--gd:#b8860b;--sv:#666;--bz:#8b5e00;}}
</style>
</head>
<body>
<div class="hdr">
  <div>
    <div><span class="tag">Rubik's SV</span><span class="ci">${_escHtml(contestName)}</span></div>
    <div class="tb">
      <span class="tc">${_escHtml(catName)}</span>
      <span class="tf">Formato: ${statExp} · Clasificación por ${statExp === 'Mo3' ? 'Media' : 'Average'}</span>
    </div>
  </div>
  <div class="hr">
    <div><strong>${sorted.length}</strong> participante${sorted.length !== 1 ? 's' : ''} aprobados</div>
    <div>${exportDate}</div>
  </div>
</div>
${sorted.length >= 1 ? `<div class="pod">${podiumCards}</div>` : ''}
<div class="tw">
  <div class="th">
    <span class="tl">Tabla completa — aprobados</span>
    <span class="tc2">${sorted.length} resultado${sorted.length !== 1 ? 's' : ''}</span>
  </div>
  <table>
    <thead>
      <tr>
        <th style="width:28px;">#</th>
        <th class="thn">Nombre</th>
        <th class="thc">País</th>
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