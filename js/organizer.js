/**
 * organizer.js
 */

const Organizer = (() => {

  const MO3_CATS = new Set(['6x6', '7x7']);

  /* ── Autenticación ──────────────────────────────────── */
  async function login() {
    const emailEl = document.getElementById('org-email');
    const passEl  = document.getElementById('org-pass');
    const errorEl = document.getElementById('org-login-error');
    const email   = emailEl.value.trim();
    const pass    = passEl.value;
    errorEl.textContent = '';
    if (!email || !pass) {
      errorEl.textContent = '⚠ Ingresá tu correo y contraseña';
      return;
    }
    try {
      await FB.signInWithEmailAndPassword(auth, email, pass);
    } catch (err) {
      console.error('[Organizer] login error:', err.code);
      if (['auth/invalid-credential','auth/wrong-password','auth/user-not-found'].includes(err.code)) {
        errorEl.textContent = '⚠ Credenciales incorrectas';
      } else if (err.code === 'auth/too-many-requests') {
        errorEl.textContent = '⚠ Demasiados intentos. Esperá unos minutos.';
      } else {
        errorEl.textContent = '⚠ Error al iniciar sesión: ' + err.message;
      }
    }
  }

  async function logout() {
    await FB.signOut(auth);
    AppState.isOrganizer = false;
    document.getElementById('org-login').style.display = '';
    document.getElementById('org-panel').style.display = 'none';
    document.getElementById('org-pass').value  = '';
    document.getElementById('org-email').value = '';
    UI.showView('view-landing');
  }

  /* ── Panel principal ────────────────────────────────── */
  function showPanel() {
    AppState.isOrganizer = true;
    document.getElementById('org-login').style.display = 'none';
    document.getElementById('org-panel').style.display = 'block';
    _renderPanel();
  }

  function refreshPendingBadge() {
    const count = AppState.results.filter(r => (r.status || 'pending') === 'pending').length;
    const badge = document.getElementById('pending-count-badge');
    if (!badge) return;
    badge.textContent   = count > 0 ? `${count} pendiente${count > 1 ? 's' : ''}` : '';
    badge.style.display = count > 0 ? '' : 'none';
  }

  /* ── Guardar contest ────────────────────────────────── */
  async function saveContest() {
    const cats = {};
    CATEGORIES.forEach(cat => {
      const checkbox = document.getElementById('cat-toggle-' + cat.id);
      if (!checkbox || !checkbox.checked) return;
      const total     = MO3_CATS.has(cat.id) ? 3 : 5;
      const scrambles = [];
      for (let i = 1; i <= total; i++) {
        const input = document.getElementById(`scr-${cat.id}-${i}`);
        scrambles.push(input ? input.value.trim() : '');
      }
      cats[cat.id] = { name: cat.name, scrambles };
    });
    if (!Object.keys(cats).length) {
      UI.toast('⚠ Activá al menos una categoría');
      return;
    }

    const name       = document.getElementById('contest-name').value.trim();
    const deadline   = document.getElementById('contest-deadline').value;
    const contestData = { name: name || AppState.contest.name, deadline, categories: cats };

    try {
      await Storage.saveContest(contestData);
      AppState.contest = contestData;
      document.title   = (contestData.name || 'Rubik SV') + ' — Contest Online';
      UI.toast('✓ Contest guardado y activado');
      UI.updateContestBadge();
    } catch (err) {
      console.error('[Organizer] saveContest:', err);
      UI.toast('⚠ Error al guardar: ' + err.message);
    }
  }

  /* ── Reset ──────────────────────────────────────────── */
  function confirmReset() {
    document.getElementById('reset-confirm').value = '';
    document.getElementById('modal-reset').classList.add('open');
  }

  async function doReset() {
    if (document.getElementById('reset-confirm').value !== 'RESET') {
      UI.toast('⚠ Escribí exactamente RESET para confirmar');
      return;
    }
    try {
      await Storage.resetContest();
      AppState.results      = [];
      AppState.participants = [];
      AppState.contest      = { name: '', deadline: '', categories: {} };
      UI.closeModal('modal-reset');
      _renderPanel();
      refreshPendingBadge();
      UI.updateContestBadge();
      UI.refreshLandingActions();
      UI.toast('✓ Contest reseteado correctamente');
    } catch (err) {
      console.error('[Organizer] doReset:', err);
      UI.toast('⚠ Error al resetear: ' + err.message);
    }
  }

  /* ── Render interno ─────────────────────────────────── */
  async function _renderPanel() {
    document.getElementById('contest-name').value     = AppState.contest.name     || '';
    document.getElementById('contest-deadline').value = AppState.contest.deadline || '';
    _renderCategoryList();
    refreshPendingBadge();
    try { AppState.participants = await Storage.loadParticipants(); } catch (e) {}
    _renderParticipants();
  }

  function _renderCategoryList() {
    const container = document.getElementById('org-cats');
    container.innerHTML = '';
    CATEGORIES.forEach(cat => {
      const isEnabled = !!(AppState.contest.categories?.[cat.id]);
      const total     = MO3_CATS.has(cat.id) ? 3 : 5;
      const saved     = AppState.contest.categories?.[cat.id]?.scrambles || [];
      const scrambles = Array.from({ length: total }, (_, i) => saved[i] || '');
      const fmtLabel  = MO3_CATS.has(cat.id) ? 'Mo3' : 'Ao5';

      const section = document.createElement('div');
      section.className = 'cat-section';

      const header = document.createElement('div');
      header.className = 'cat-section-header';
      header.innerHTML = `
        <label class="cat-check-label">
          <input type="checkbox" id="cat-toggle-${cat.id}" ${isEnabled ? 'checked' : ''}
                 style="accent-color:var(--accent);" />
          <span>${cat.name}</span>
          <span style="font-size:.6rem;color:var(--muted);margin-left:.3rem;">
            (${fmtLabel} · ${total} scrambles)
          </span>
        </label>
        <span class="toggle-arrow">▾</span>
      `;

      const body = document.createElement('div');
      body.className = 'cat-section-body' + (isEnabled ? ' open' : '');

      header.addEventListener('click', e => {
        if (e.target.type === 'checkbox') return;
        body.classList.toggle('open');
      });

      for (let i = 1; i <= total; i++) {
        const row = document.createElement('div');
        row.className = 'scramble-row';
        row.innerHTML = `
          <span class="scramble-label">S${i}</span>
          <input class="scramble-input" id="scr-${cat.id}-${i}"
                 value="${(scrambles[i-1]||'').replace(/"/g,'&quot;')}"
                 placeholder="Pegá el scramble aquí..." />
        `;
        body.appendChild(row);
      }
      section.appendChild(header);
      section.appendChild(body);
      container.appendChild(section);
    });
  }

  function _renderParticipants() {
    const tbody = document.getElementById('participants-tbody');
    tbody.innerHTML = '';
    const noEl = document.getElementById('no-participants');
    if (!AppState.participants.length) { noEl.style.display = ''; return; }
    noEl.style.display = 'none';
    AppState.participants.forEach(p => {
      const catName   = AppState.contest.categories?.[p.category]?.name || p.category;
      const hasResult = AppState.results.some(
        r => r.email === p.email && r.category === p.category
      );
      // Minutos en timer (si se registró)
      const mins = p.timerMinutes != null
        ? `${p.timerMinutes} min`
        : (p.timerEnteredAt ? '—' : '—');
      const reloads = p.pageReloads != null ? p.pageReloads : 0;

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${p.name}</td>
        <td>${p.email}</td>
        <td>${catName}</td>
        <td class="suggestions-cell">${p.suggestions || '—'}</td>
        <td style="color:var(--muted2);font-family:var(--mono);font-size:.72rem;text-align:center;">
          ${mins}
        </td>
        <td style="color:${reloads > 0 ? 'var(--accent3)' : 'var(--muted)'};
                   font-family:var(--mono);font-size:.72rem;text-align:center;">
          ${reloads}
        </td>
        <td style="color:${hasResult ? 'var(--accent4)' : 'var(--muted)'}">
          ${hasResult ? '✓ Enviado' : 'Pendiente'}
        </td>
      `;
      tbody.appendChild(tr);
    });

    // Actualizar header de la tabla de participantes para incluir nuevas columnas
    const thead = document.querySelector('#participants-tbody')
                    ?.closest('table')?.querySelector('thead tr');
    if (thead && !thead.querySelector('.col-timer')) {
      thead.innerHTML = `
        <th>Nombre</th><th>Email</th><th>Categoría</th><th>Sugerencias</th>
        <th class="col-timer" style="text-align:center;">Tiempo timer</th>
        <th style="text-align:center;">Recargas</th>
        <th>Estado</th>
      `;
    }
  }

  /* ── Panel de Logs ──────────────────────────────────── */
  async function showLogs() {
    const section = document.getElementById('org-logs-section');
    if (!section) return;

    section.style.display = '';
    const tbody  = document.getElementById('logs-tbody');
    const loadEl = document.getElementById('logs-loading');
    if (loadEl) loadEl.style.display = '';
    if (tbody)  tbody.innerHTML = '';

    let logs = [];
    try {
      logs = await Storage.loadLogs(300);
    } catch (e) {
      UI.toast('⚠ Error al cargar logs');
    }

    if (loadEl) loadEl.style.display = 'none';
    _renderLogs(logs);
  }

  function _renderLogs(logs) {
    const tbody  = document.getElementById('logs-tbody');
    const noEl   = document.getElementById('no-logs');
    if (!tbody) return;

    // Leer filtros
    const filterLevel = document.getElementById('log-filter-level')?.value || 'all';
    const filterEmail = (document.getElementById('log-filter-email')?.value || '').trim().toLowerCase();
    const filterText  = (document.getElementById('log-filter-text')?.value  || '').trim().toLowerCase();

    const filtered = logs.filter(l => {
      if (filterLevel !== 'all' && l.level !== filterLevel) return false;
      if (filterEmail && !(l.email || '').toLowerCase().includes(filterEmail)) return false;
      if (filterText) {
        const haystack = JSON.stringify(l).toLowerCase();
        if (!haystack.includes(filterText)) return false;
      }
      return true;
    });

    tbody.innerHTML = '';
    if (!filtered.length) {
      if (noEl) { noEl.style.display = ''; noEl.textContent = 'No hay logs con esos filtros.'; }
      return;
    }
    if (noEl) noEl.style.display = 'none';

    const levelColors = {
      info:  'var(--accent4)',
      warn:  'var(--accent3)',
      error: 'var(--accent2)',
    };

    filtered.forEach(l => {
      const tr = document.createElement('tr');
      const ts = l.timestamp ? new Date(l.timestamp).toLocaleString('es-SV') : '—';
      const color = levelColors[l.level] || 'var(--muted2)';

      // Datos extra (todo lo que no sea campos base)
      const baseKeys = new Set(['level','event','timestamp','email','name',
                                'category','solveNum','ua','id','createdAt']);
      const extra = Object.entries(l)
        .filter(([k]) => !baseKeys.has(k))
        .map(([k, v]) => `<span style="color:var(--muted)">${k}:</span> ${
          typeof v === 'object' ? JSON.stringify(v) : v
        }`)
        .join(' &nbsp;·&nbsp; ');

      tr.innerHTML = `
        <td style="white-space:nowrap;font-family:var(--mono);font-size:.65rem;color:var(--muted2);">
          ${ts}
        </td>
        <td>
          <span style="font-family:var(--mono);font-size:.62rem;font-weight:700;
                       color:${color};text-transform:uppercase;
                       border:1px solid ${color};border-radius:2px;
                       padding:.1rem .35rem;">${l.level || '—'}</span>
        </td>
        <td style="font-family:var(--mono);font-size:.7rem;font-weight:700;">
          ${l.event || '—'}
        </td>
        <td style="font-size:.72rem;color:var(--muted2);">${l.name || '—'}</td>
        <td style="font-size:.7rem;font-family:var(--mono);color:var(--muted);">
          ${l.email || '—'}
        </td>
        <td style="font-size:.68rem;color:var(--muted2);">${l.category || '—'}</td>
        <td style="font-size:.68rem;font-family:var(--mono);color:var(--muted2);
                   max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"
            title="${_escHtml(extra)}">
          ${extra || '—'}
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  function _escHtml(str) {
    return String(str)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  return {
    login, logout, showPanel,
    saveContest, confirmReset, doReset,
    refreshPendingBadge,
    refreshParticipantsTable: _renderParticipants,
    showLogs, _renderLogs,
  };
})();