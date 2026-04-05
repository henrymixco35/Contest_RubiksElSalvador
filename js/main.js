/**
 * main.js
 * ──────────────────────────────────────────────────────
 * Punto de entrada:
 *  1. Muestra un loader mientras Firestore carga
 *  2. Escucha cambios de sesión con onAuthStateChanged
 *  3. Suscribe los resultados en tiempo real (onSnapshot)
 *  4. Registra los listeners de teclado/touch para el timer
 */

(async function init() {

  // ── 1. Loader mientras cargamos datos de Firestore ───
  _showLoader(true);

  try {
    // Cargar contest y resultados en paralelo
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

  // ── 2. Actualizar UI con datos cargados ───────────────
  UI.refreshLandingActions();

  // ── 3. Suscripción en tiempo real a resultados ────────
  // Cada vez que alguien envía tiempos, AppState.results se actualiza.
  AppState._unsubscribeResults = Storage.subscribeResults((freshResults) => {
    AppState.results = freshResults;
    // Si la vista de resultados está activa, re-renderizar
    if (document.getElementById('view-results').classList.contains('active')) {
      const visibleCats = AppState.isOrganizer ? null
        : (AppState.contestant
            ? AppState.results.filter(r => r.email === AppState.contestant.email).map(r => r.category)
            : null);
      Results.render(visibleCats);
    }
  });

  // ── 4. Firebase Auth — detectar si el org ya está logueado ──
  FB.onAuthStateChanged(auth, (user) => {
    if (user) {
      // Usuario autenticado → mostrar panel de organizador
      AppState.isOrganizer = true;
      if (document.getElementById('view-organizer').classList.contains('active')) {
        Organizer.showPanel();
      }
    } else {
      AppState.isOrganizer = false;
    }
  });

  // ── 5. Listeners del timer ────────────────────────────
  const contestMain = document.getElementById('contest-main');

  document.addEventListener('keydown', (e) => {
    if (!document.getElementById('view-contest').classList.contains('active')) return;
    if (e.code !== 'Space' || e.repeat) return;
    e.preventDefault();
    Timer.handlePress();
  });

  document.addEventListener('keyup', (e) => {
    if (!document.getElementById('view-contest').classList.contains('active')) return;
    if (e.code !== 'Space') return;
    e.preventDefault();
    Timer.handleRelease();
  });

  contestMain.addEventListener('touchstart', (e) => {
    if (e.target.closest('button')) return;
    e.preventDefault();
    Timer.handlePress();
  }, { passive: false });

  contestMain.addEventListener('touchend', (e) => {
    if (e.target.closest('button')) return;
    e.preventDefault();
    Timer.handleRelease();
  }, { passive: false });

  contestMain.addEventListener('click', (e) => {
    if (e.target.closest('button')) return;
    const state = AppState.timerState;
    if (state === 'stopped' || state === 'running') Timer.handlePress();
  });

  // ── 6. Cerrar modales al hacer click en el fondo ─────
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.classList.remove('open');
    });
  });

  // Enter en el input de login por email (modal)
  const emailLoginInput = document.getElementById('email-login-input');
  if (emailLoginInput) {
    emailLoginInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') UI.submitEmailLogin();
    });
  }

  // Enter en login del organizador
  const orgPass = document.getElementById('org-pass');
  if (orgPass) {
    orgPass.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') Organizer.login();
    });
  }

})();

// ── Helper: loader ─────────────────────────────────────
function _showLoader(show) {
  let el = document.getElementById('app-loader');
  if (!el && show) {
    el = document.createElement('div');
    el.id = 'app-loader';
    el.innerHTML = `
      <div style="
        position:fixed;inset:0;
        background:var(--bg);
        display:flex;flex-direction:column;
        align-items:center;justify-content:center;
        z-index:9999;gap:1.2rem;
        font-family:'Space Mono',monospace;
        font-size:.8rem;color:var(--muted);
        letter-spacing:.1em;
      ">
        <div style="
          width:36px;height:36px;
          border:2px solid var(--border);
          border-top-color:var(--accent);
          border-radius:50%;
          animation:spin .8s linear infinite;
        "></div>
        CARGANDO CONTEST...
        <style>@keyframes spin{to{transform:rotate(360deg)}}</style>
      </div>`;
    document.body.appendChild(el);
  } else if (el && !show) {
    el.remove();
  }
}
