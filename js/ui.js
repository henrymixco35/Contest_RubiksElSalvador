/**
 * ui.js
 */

const UI = (() => {

  let toastTimer = null;

  function showView(id) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    if (id !== 'view-results') {
      const li = document.getElementById('live-indicator');
      if (li) li.style.display = 'none';
    }
  }

  /* ── Sidebar móvil ───────────────────────────────────── */

  function toggleSidebar() {
    const toggle = document.getElementById('sidebar-toggle');
    const inner  = document.getElementById('sidebar-inner');
    if (!toggle || !inner) return;
    const isOpen = inner.classList.toggle('open');
    toggle.classList.toggle('open', isOpen);
  }

  /* ── Landing ─────────────────────────────────────────── */

  function showRegistration() {
    const cats = AppState.contest.categories || {};
    if (Object.keys(cats).length === 0) {
      toast('⚠ El organizador aún no ha configurado el contest');
      return;
    }
    if (Registration.isContestClosed()) {
      toast('⚠ El contest ya cerró. No se aceptan más participantes.');
      return;
    }
    Registration.populateCategorySelect();
    showView('view-register');
  }

  /* ── Login por email (competidor que ya participó) ───── */

  function showEmailLogin() {
    document.getElementById('email-login-input').value = '';
    document.getElementById('email-login-error').textContent = '';
    document.getElementById('modal-email-login').classList.add('open');
    setTimeout(() => document.getElementById('email-login-input').focus(), 100);
  }

  function submitEmailLogin() {
    const raw   = document.getElementById('email-login-input').value.trim().toLowerCase();
    const errEl = document.getElementById('email-login-error');

    if (!raw || !raw.includes('@')) {
      errEl.textContent = '⚠ Ingresá un correo válido';
      return;
    }

    const myResults = AppState.results.filter(r => r.email === raw);
    if (!myResults.length) {
      errEl.textContent = '⚠ No encontramos resultados para ese correo';
      return;
    }

    AppState.contestant = {
      name:     myResults[0].name,
      email:    raw,
      category: myResults[0].category,
    };

    closeModal('modal-email-login');
    showResults();
  }

  /* ── Resultados ──────────────────────────────────────── */

  function showResults() {
    let visibleCats = null;

    if (!AppState.isOrganizer) {
      if (!AppState.contestant) {
        showEmailLogin();
        return;
      }
      const email = AppState.contestant.email;
      visibleCats = AppState.results
        .filter(r => r.email === email)
        .map(r => r.category);

      if (!visibleCats.length) {
        toast('⚠ Enviá tus resultados primero para ver la tabla');
        return;
      }
    }

    Results.render(visibleCats);
    showView('view-results');
    const li = document.getElementById('live-indicator');
    if (li) li.style.display = '';
  }

  /* ── Organizador ─────────────────────────────────────── */

  function showOrganizer() {
    if (AppState.isOrganizer) {
      showView('view-organizer');
      Organizer.showPanel();
    } else {
      showView('view-organizer');
    }
  }

  /* ── Modales ─────────────────────────────────────────── */

  function closeModal(id) {
    document.getElementById(id).classList.remove('open');
  }

  function confirmAbandon() {
    document.getElementById('modal-abandon').classList.add('open');
  }

  /* ── Toast ───────────────────────────────────────────── */

  function toast(msg) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 3500);
  }

  /* ── Badge ───────────────────────────────────────────── */

  function updateContestBadge() {
    const hasCats  = Object.keys(AppState.contest.categories || {}).length > 0;
    const badge    = document.getElementById('contest-badge');
    const isClosed = Registration.isContestClosed();

    badge.style.display = hasCats ? '' : 'none';

    if (hasCats && isClosed) {
      badge.textContent       = '● CONTEST CERRADO';
      badge.style.borderColor = 'var(--accent2)';
      badge.style.color       = 'var(--accent2)';
    } else if (hasCats) {
      badge.textContent       = '● CONTEST ACTIVO';
      badge.style.borderColor = '';
      badge.style.color       = '';
    }
  }

  function refreshLandingActions() {
    updateContestBadge();
    const isClosed = Registration.isContestClosed();
    const btn = document.querySelector('#view-landing .btn-primary');
    if (btn && isClosed) {
      btn.textContent   = '🔒 Contest cerrado';
      btn.disabled      = true;
      btn.style.opacity = '0.5';
      btn.style.cursor  = 'not-allowed';
    } else if (btn) {
      btn.textContent   = '▶ Participar en el Contest';
      btn.disabled      = false;
      btn.style.opacity = '';
      btn.style.cursor  = '';
    }
  }

  return {
    showView, toggleSidebar,
    showRegistration,
    showEmailLogin, submitEmailLogin,
    showResults, showOrganizer,
    closeModal, confirmAbandon,
    toast, updateContestBadge, refreshLandingActions,
  };
})();