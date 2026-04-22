/**
 * Session.js
 */

const SessionStore = (() => {

  const KEY = 'rubik_sv_session';

  /* ── Guardar ────────────────────────────────────────── */
  function save() {
    if (!AppState.contestant) return;
    const data = {
      contestant:   AppState.contestant,
      solves:       AppState.solves,
      currentSolve: AppState.currentSolve,
    };
    try {
      sessionStorage.setItem(KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('[SessionStore] No se pudo guardar sesión:', e);
    }
  }

  /* ── Limpiar ────────────────────────────────────────── */
  function clear() {
    try { sessionStorage.removeItem(KEY); } catch (e) {}
  }

  /* ── Restaurar ──────────────────────────────────────── */
  function tryRestore() {
    let raw;
    try { raw = sessionStorage.getItem(KEY); } catch (e) { return; }
    if (!raw) return;

    let data;
    try { data = JSON.parse(raw); } catch (e) { clear(); return; }

    const { contestant, solves, currentSolve } = data;

    if (!contestant || !AppState.contest.categories[contestant.category]) {
      clear();
      return;
    }

    const alreadySubmitted = AppState.results.some(
      r => r.email === contestant.email && r.category === contestant.category
    );
    if (alreadySubmitted) {
      clear();
      return;
    }

    if (!solves || solves.length === 0) {
      clear();
      return;
    }

    // Cargar en AppState ANTES de mostrar el banner
    AppState.contestant   = contestant;
    AppState.solves       = solves;
    AppState.currentSolve = currentSolve;

    _showRestoreBanner(
      () => {
        Logger.warn('session_restored_after_reload', {
          solvesRecovered: AppState.solves.length,
          totalSolves:     AppState.solves.length,
          category:        contestant.category,
          note:            'Competidor recargó la página y eligió continuar',
        });

        Storage.updateParticipantSession(
          contestant.email,
          contestant.category,
          {
            pageReloads:    FB.increment(1),
            timerLastSeen:  new Date().toISOString(),
          },
        );

        Timer.init(true);
        UI.showView('view-contest');
      },
      () => {
        // ── Descartar ─────────────────────────────────────────
        Logger.info('session_discarded_after_reload', {
          solvesLost: AppState.solves.length,
          category:   contestant.category,
        });

        clear();
        AppState.contestant   = null;
        AppState.solves       = [];
        AppState.currentSolve = 0;
      },
    );
  }

  /* ── Banner de recuperación ─────────────────────────── */
  function _showRestoreBanner(onContinue, onDiscard) {
    const catName = AppState.contest.categories[AppState.contestant.category]?.name
                  || AppState.contestant.category;

    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position:fixed;inset:0;background:rgba(0,0,0,.82);
      backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);
      z-index:600;display:flex;align-items:center;
      justify-content:center;padding:1rem;
    `;
    overlay.innerHTML = `
      <div style="
        background:var(--surface);border:1px solid var(--border2);
        border-radius:10px;padding:2rem;max-width:400px;width:100%;
        animation:fadeUp .2s ease;font-family:var(--sans);
      ">
        <div style="font-family:var(--serif);font-size:1.4rem;margin-bottom:.6rem;">
          Sesión guardada
        </div>
        <p style="color:var(--muted2);font-size:.88rem;line-height:1.65;margin-bottom:1.2rem;">
          Tenés <strong style="color:var(--accent)">${AppState.solves.length} solve(s)</strong>
          guardados en <strong style="color:var(--text)">${catName}</strong>
          para <strong style="color:var(--text)">${AppState.contestant.name}</strong>.
          ¿Querés continuar donde lo dejaste?
        </p>
        <div style="display:flex;gap:.6rem;flex-wrap:wrap;">
          <button id="sr-continue" class="btn btn-primary" style="flex:1;">
            ▶ Continuar
          </button>
          <button id="sr-discard" class="btn btn-outline" style="flex:1;">
            ✕ Descartar
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.querySelector('#sr-continue').addEventListener('click', () => {
      overlay.remove();
      onContinue();
    });
    overlay.querySelector('#sr-discard').addEventListener('click', () => {
      overlay.remove();
      onDiscard();
    });
  }

  return { save, clear, tryRestore };
})();