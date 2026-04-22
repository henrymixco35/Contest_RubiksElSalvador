/**
 * main.js
 */

(async function init() {

  _showLoader(true);

  try {
    const [contest, results] = await Promise.all([
      Storage.loadContest(),
      Storage.loadResults(),
    ]);
    AppState.contest = contest;
    AppState.results = results;
  } catch (err) {
    console.error('[main] Error cargando datos iniciales:', err);
    UI.toast('⚠ Error de conexión. Recargá la página.');
  }

  _showLoader(false);

  Logger.ready();

  UI.refreshLandingActions();

  // Intentar restaurar sesión guardada
  SessionStore.tryRestore();

  // Suscripción en tiempo real a resultados
  AppState._unsubscribeResults = Storage.subscribeResults((freshResults) => {
    AppState.results = freshResults;
    if (AppState.isOrganizer) Organizer.refreshPendingBadge();
    if (document.getElementById('view-results').classList.contains('active')) {
      const visibleCats = AppState.isOrganizer ? null
        : (AppState.contestant
            ? AppState.results
                .filter(r => r.email === AppState.contestant.email)
                .map(r => r.category)
            : null);
      Results.render(visibleCats);
    }
  });

  // Auth state
  FB.onAuthStateChanged(auth, (user) => {
    if (user) {
      AppState.isOrganizer = true;
      if (document.getElementById('view-organizer').classList.contains('active')) {
        Organizer.showPanel();
      }
    } else {
      AppState.isOrganizer = false;
    }
  });

  // ── Teclado ────────────────────────────────────────────
  document.addEventListener('keydown', (e) => {
    if (!document.getElementById('view-contest').classList.contains('active')) return;
    if (e.repeat) return;

    if (e.code === 'Space') {
      e.preventDefault();
      Timer.handlePress();
      return;
    }

    if (AppState.timerState === 'running') {
      const ignored = ['ShiftLeft','ShiftRight','ControlLeft','ControlRight',
                       'AltLeft','AltRight','MetaLeft','MetaRight','CapsLock','Tab'];
      if (!ignored.includes(e.code)) {
        e.preventDefault();
        Timer.handlePress();
      }
    }
  });

  document.addEventListener('keyup', (e) => {
    if (!document.getElementById('view-contest').classList.contains('active')) return;
    if (e.code !== 'Space') return;
    e.preventDefault();
    Timer.handleRelease();
  });

  // ── Touch ──────────────────────────────────────────────
  const contestMain      = document.getElementById('contest-main');
  const SCROLL_THRESHOLD = 10;
  let touchStartY = 0, touchStartX = 0, touchMoved = false;

  contestMain.addEventListener('touchstart', (e) => {
    if (e.target.closest('button, a, input, select, textarea, .solve-item')) return;
    touchStartY = e.touches[0].clientY;
    touchStartX = e.touches[0].clientX;
    touchMoved  = false;
    if (AppState.timerState === 'inspection') Timer.handlePress();
  }, { passive: true });

  contestMain.addEventListener('touchmove', (e) => {
    if (Math.abs(e.touches[0].clientY - touchStartY) > SCROLL_THRESHOLD ||
        Math.abs(e.touches[0].clientX - touchStartX) > SCROLL_THRESHOLD) {
      touchMoved = true;
    }
  }, { passive: true });

  contestMain.addEventListener('touchend', (e) => {
    if (e.target.closest('button, a, input, select, textarea, .solve-item')) return;
    if (touchMoved) {
      if (AppState.timerState === 'inspection') Timer.handleRelease();
      return;
    }
    e.preventDefault();
    if (AppState.timerState === 'inspection') Timer.handleRelease();
    else Timer.handlePress();
  }, { passive: false });

  contestMain.addEventListener('touchcancel', () => {
    touchMoved = true;
    if (AppState.timerState === 'inspection') Timer.handleRelease();
  }, { passive: true });

  contestMain.addEventListener('click', (e) => {
    if (e.target.closest('button, a, input, select, textarea, .solve-item')) return;
    const state = AppState.timerState;
    if (state === 'stopped' || state === 'running') Timer.handlePress();
  });

  // ── Modales: cerrar al hacer click fuera ───────────────
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => {
      if (e.target === overlay) overlay.classList.remove('open');
    });
  });

  // ── Atajos de teclado en modales ───────────────────────
  const emailLoginInput = document.getElementById('email-login-input');
  if (emailLoginInput) {
    emailLoginInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') UI.submitEmailLogin();
    });
  }

  const orgPass = document.getElementById('org-pass');
  if (orgPass) {
    orgPass.addEventListener('keydown', e => {
      if (e.key === 'Enter') Organizer.login();
    });
  }

})();

function _showLoader(show) {
  let el = document.getElementById('app-loader');
  if (!el && show) {
    el = document.createElement('div');
    el.id = 'app-loader';
    el.innerHTML = `<div style="
      position:fixed;inset:0;background:var(--bg);
      display:flex;flex-direction:column;align-items:center;justify-content:center;
      z-index:9999;gap:1.2rem;font-family:'Space Mono',monospace;
      font-size:.8rem;color:var(--muted);letter-spacing:.1em;">
      <div style="width:36px;height:36px;border:2px solid var(--border);
                  border-top-color:var(--accent);border-radius:50%;
                  animation:spin .8s linear infinite;"></div>
      CARGANDO CONTEST...
      <style>@keyframes spin{to{transform:rotate(360deg)}}</style>
    </div>`;
    document.body.appendChild(el);
  } else if (el && !show) {
    el.remove();
  }
}