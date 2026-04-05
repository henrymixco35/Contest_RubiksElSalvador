/**
 * organizer.js
 * ──────────────────────────────────────────────────────
 * El organizador se autentica con Firebase Auth (email/password).
 * Todas las escrituras sensibles (contest config, reset) están
 * protegidas por las reglas de Firestore — aunque alguien manipule
 * el JS en el navegador, Firestore rechaza la escritura si no hay
 * un usuario autenticado con el UID correcto.
 */

const Organizer = (() => {

  // ── Login con Firebase Auth ───────────────────────────

  async function login() {
    const emailEl = document.getElementById('org-email');
    const passEl  = document.getElementById('org-pass');
    const errorEl = document.getElementById('org-login-error');

    const email = emailEl.value.trim();
    const pass  = passEl.value;

    errorEl.textContent = '';

    if (!email || !pass) {
      errorEl.textContent = '⚠ Ingresá tu correo y contraseña';
      return;
    }

    try {
      await FB.signInWithEmailAndPassword(auth, email, pass);
      // onAuthStateChanged en main.js maneja el resto
    } catch (err) {
      console.error('[Organizer] login error:', err.code);
      if (err.code === 'auth/invalid-credential' ||
          err.code === 'auth/wrong-password'       ||
          err.code === 'auth/user-not-found') {
        errorEl.textContent = '⚠ Credenciales incorrectas';
      } else if (err.code === 'auth/too-many-requests') {
        errorEl.textContent = '⚠ Demasiados intentos. Esperá unos minutos.';
      } else {
        errorEl.textContent = '⚠ Error al iniciar sesión: ' + err.message;
      }
    }
  }

  // ── Logout ────────────────────────────────────────────

  async function logout() {
    await FB.signOut(auth);
    AppState.isOrganizer = false;
    document.getElementById('org-login').style.display = '';
    document.getElementById('org-panel').style.display = 'none';
    document.getElementById('org-pass').value   = '';
    document.getElementById('org-email').value  = '';
    UI.showView('view-landing');
  }

  // ── Mostrar panel tras autenticación exitosa ──────────

  function showPanel() {
    AppState.isOrganizer = true;
    document.getElementById('org-login').style.display = 'none';
    document.getElementById('org-panel').style.display = 'block';
    _renderPanel();
  }

  // ── Guardar configuración del contest ─────────────────

  async function saveContest() {
    const cats = {};
    CATEGORIES.forEach(cat => {
      const checkbox = document.getElementById('cat-toggle-' + cat.id);
      if (!checkbox || !checkbox.checked) return;
      const scrambles = [];
      for (let i = 1; i <= 5; i++) {
        const input = document.getElementById(`scr-${cat.id}-${i}`);
        scrambles.push(input ? input.value.trim() : '');
      }
      cats[cat.id] = { name: cat.name, scrambles };
    });

    if (Object.keys(cats).length === 0) {
      UI.toast('⚠ Activá al menos una categoría');
      return;
    }

    const name     = document.getElementById('contest-name').value.trim();
    const deadline = document.getElementById('contest-deadline').value;

    const contestData = {
      name:       name || AppState.contest.name,
      deadline:   deadline,
      categories: cats,
    };

    try {
      await Storage.saveContest(contestData);
      AppState.contest = contestData;
      document.title = (contestData.name || 'CubitOS SV') + ' — Contest Online';
      UI.toast('✓ Contest guardado y activado');
      UI.updateContestBadge();
    } catch (err) {
      console.error('[Organizer] saveContest:', err);
      UI.toast('⚠ Error al guardar: ' + err.message);
    }
  }

  // ── Reset ─────────────────────────────────────────────

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
      AppState.participants  = [];
      UI.closeModal('modal-reset');
      _renderParticipants();
      UI.toast('✓ Contest reseteado correctamente');
    } catch (err) {
      console.error('[Organizer] doReset:', err);
      UI.toast('⚠ Error al resetear: ' + err.message);
    }
  }

  // ── Privados ──────────────────────────────────────────

  async function _renderPanel() {
    document.getElementById('contest-name').value     = AppState.contest.name     || '';
    document.getElementById('contest-deadline').value = AppState.contest.deadline || '';
    _renderCategoryList();

    // Cargar participantes frescos
    try {
      AppState.participants = await Storage.loadParticipants();
    } catch (e) { /* ya logueado en Storage */ }
    _renderParticipants();
  }

  function _renderCategoryList() {
    const container = document.getElementById('org-cats');
    container.innerHTML = '';
    CATEGORIES.forEach(cat => {
      const isEnabled = !!(AppState.contest.categories?.[cat.id]);
      const scrambles = AppState.contest.categories?.[cat.id]?.scrambles || ['', '', '', '', ''];

      const section = document.createElement('div');
      section.className = 'cat-section';

      const header = document.createElement('div');
      header.className = 'cat-section-header';
      header.innerHTML = `
        <label class="cat-check-label">
          <input type="checkbox" id="cat-toggle-${cat.id}" ${isEnabled ? 'checked' : ''}
                 style="accent-color:var(--accent);" />
          <span>${cat.name}</span>
        </label>
        <span class="toggle-arrow">▾</span>
      `;

      const body = document.createElement('div');
      body.className = 'cat-section-body' + (isEnabled ? ' open' : '');

      header.addEventListener('click', (e) => {
        if (e.target.type === 'checkbox') return;
        body.classList.toggle('open');
      });

      for (let i = 1; i <= 5; i++) {
        const row = document.createElement('div');
        row.className = 'scramble-row';
        row.innerHTML = `
          <span class="scramble-label">S${i}</span>
          <input class="scramble-input"
                 id="scr-${cat.id}-${i}"
                 value="${(scrambles[i - 1] || '').replace(/"/g, '&quot;')}"
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
      const hasResult = AppState.results.some(r => r.email === p.email && r.category === p.category);
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${p.name}</td>
        <td>${p.email}</td>
        <td>${catName}</td>
        <td class="suggestions-cell">${p.suggestions || '—'}</td>
        <td style="color:${hasResult ? 'var(--accent)' : 'var(--muted)'}">
          ${hasResult ? '✓ Enviado' : 'Pendiente'}
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  return { login, logout, showPanel, saveContest, confirmReset, doReset };
})();
