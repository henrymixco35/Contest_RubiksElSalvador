/**
 * main.js
 * ──────────────────────────────────────────────────────
 * Fix clave para móvil: diferenciar scroll de tap intencional.
 * Un toque que se mueve más de 10px se considera scroll → ignorar.
 *
 * FIXES:
 *  - Eliminado el segundo listener de touchend que cancelaba el hold-to-start.
 *  - Ahora touchend maneja tanto tap simple como release de hold correctamente.
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
  UI.refreshLandingActions();

  // Suscripción en tiempo real a resultados (Firestore onSnapshot)
  AppState._unsubscribeResults = Storage.subscribeResults((freshResults) => {
    AppState.results = freshResults;
    if (document.getElementById('view-results').classList.contains('active')) {
      const visibleCats = AppState.isOrganizer ? null
        : (AppState.contestant
            ? AppState.results.filter(r => r.email === AppState.contestant.email).map(r => r.category)
            : null);
      Results.render(visibleCats);
    }
  });

  // Firebase Auth — detectar sesión del organizador
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

  // ── Listeners de teclado ─────────────────────────────

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

  // ── Touch en la zona del timer ───────────────────────
  //
  // Lógica unificada en UN SOLO conjunto de listeners:
  //
  //  touchstart  → registrar posición inicial
  //  touchmove   → detectar si fue scroll
  //  touchend    → si no fue scroll:
  //                  · estado running/stopped → handlePress()
  //                  · estado inspection (hold activo) → handleRelease()
  //                  · estado idle/inspection (sin hold) → handlePress()
  //  touchcancel → limpiar estado

  const contestMain      = document.getElementById('contest-main');
  const SCROLL_THRESHOLD = 10; // px de movimiento para considerar scroll

  let touchStartY = 0;
  let touchStartX = 0;
  let touchMoved  = false;

  contestMain.addEventListener('touchstart', (e) => {
    if (e.target.closest('button, a, input, select, textarea, .solve-item')) return;
    touchStartY = e.touches[0].clientY;
    touchStartX = e.touches[0].clientX;
    touchMoved  = false;

    // Iniciar hold si estamos en inspección
    if (AppState.timerState === 'inspection') {
      Timer.handlePress();
    }
  }, { passive: true });

  contestMain.addEventListener('touchmove', (e) => {
    const dy = Math.abs(e.touches[0].clientY - touchStartY);
    const dx = Math.abs(e.touches[0].clientX - touchStartX);
    if (dy > SCROLL_THRESHOLD || dx > SCROLL_THRESHOLD) {
      touchMoved = true;
    }
  }, { passive: true });

  contestMain.addEventListener('touchend', (e) => {
    if (e.target.closest('button, a, input, select, textarea, .solve-item')) return;
    if (touchMoved) {
      // Era scroll; si había hold iniciado, cancelarlo
      if (AppState.timerState === 'inspection') {
        Timer.handleRelease();
      }
      return;
    }

    e.preventDefault();

    const state = AppState.timerState;

    if (state === 'inspection') {
      // Soltar durante inspección → release del hold
      Timer.handleRelease();
    } else {
      // idle, running, stopped → press normal
      Timer.handlePress();
    }
  }, { passive: false });

  contestMain.addEventListener('touchcancel', () => {
    touchMoved = true;
    if (AppState.timerState === 'inspection') {
      Timer.handleRelease();
    }
  }, { passive: true });

  // ── Click (fallback desktop) ─────────────────────────

  contestMain.addEventListener('click', (e) => {
    if (e.target.closest('button, a, input, select, textarea, .solve-item')) return;
    const state = AppState.timerState;
    if (state === 'stopped' || state === 'running') {
      Timer.handlePress();
    }
  });

  // ── Cerrar modales al click en fondo ─────────────────

  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.classList.remove('open');
    });
  });

  // Enter en inputs del modal de email
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

/* ── Loader ───────────────────────────────────────────── */

function _showLoader(show) {
  let el = document.getElementById('app-loader');
  if (!el && show) {
    el = document.createElement('div');
    el.id = 'app-loader';
    el.innerHTML = `
      <div style="
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