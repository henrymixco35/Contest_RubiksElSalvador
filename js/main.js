/**
 * main.js
 * ──────────────────────────────────────────────────────
 * Fix clave para móvil: diferenciar scroll de tap intencional.
 * Un toque que se mueve más de 10px se considera scroll → ignorar.
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

  // ── Touch en la zona del timer — con detección de scroll ──
  //
  // Problema en móvil: el usuario hace scroll para ver el timer
  // y eso dispara touchstart → handlePress() → inicia inspección.
  // Solución: registrar posición inicial y comparar en touchend.
  // Si se movió más de SCROLL_THRESHOLD px → era scroll, ignorar.

  const contestMain       = document.getElementById('contest-main');
  const SCROLL_THRESHOLD  = 10; // px de movimiento para considerar scroll
  let touchStartY = 0;
  let touchStartX = 0;
  let touchMoved  = false;

  contestMain.addEventListener('touchstart', (e) => {
    if (e.target.closest('button, a, input, select, textarea, .solve-item')) return;
    touchStartY = e.touches[0].clientY;
    touchStartX = e.touches[0].clientX;
    touchMoved  = false;
  }, { passive: true }); // passive: no bloqueamos scroll

  contestMain.addEventListener('touchmove', (e) => {
    const dy = Math.abs(e.touches[0].clientY - touchStartY);
    const dx = Math.abs(e.touches[0].clientX - touchStartX);
    if (dy > SCROLL_THRESHOLD || dx > SCROLL_THRESHOLD) {
      touchMoved = true;
    }
  }, { passive: true });

  contestMain.addEventListener('touchend', (e) => {
    if (e.target.closest('button, a, input, select, textarea, .solve-item')) return;
    if (touchMoved) return; // fue scroll → ignorar

    // Toque real → manejar press/release
    e.preventDefault();
    Timer.handlePress();
  }, { passive: false });

  // Para el hold-to-start en touch necesitamos un touchcancel también
  contestMain.addEventListener('touchcancel', () => {
    touchMoved = true; // considerar cancelado como movimiento
    Timer.handleRelease();
  }, { passive: true });

  // El handleRelease en touch se simuló en touchend para tap simple.
  // Para hold-to-start: el usuario mantiene presionado y suelta.
  // Necesitamos rastrear si el toque sigue siendo hold.
  // Implementamos: si el estado es 'inspection' al soltar → release.
  const origTouchEnd = contestMain.ontouchend;
  contestMain.addEventListener('touchend', (e) => {
    if (e.target.closest('button, a, input, select, textarea, .solve-item')) return;
    if (touchMoved) return;
    // Si estamos en inspection con hold activo → release
    if (AppState.timerState === 'inspection') {
      Timer.handleRelease();
    }
  }, { passive: false });

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