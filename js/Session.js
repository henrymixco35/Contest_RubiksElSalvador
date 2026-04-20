/**
 * session.js
 */

const SessionStore = (() => {

  const KEY = 'rubik_sv_session';

  function save() {
    if (!AppState.contestant) return;
    const data = {
      contestant: AppState.contestant,
      solves:     AppState.solves,
      currentSolve: AppState.currentSolve,
    };
    try {
      sessionStorage.setItem(KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('[SessionStore] No se pudo guardar sesión:', e);
    }
  }

  function clear() {
    try { sessionStorage.removeItem(KEY); } catch (e) {}
  }

  function tryRestore() {
    let raw;
    try { raw = sessionStorage.getItem(KEY); } catch (e) { return; }
    if (!raw) return;

    let data;
    try { data = JSON.parse(raw); } catch (e) { clear(); return; }

    // Validar que la categoría siga existiendo en el contest activo
    const { contestant, solves, currentSolve } = data;
    if (!contestant || !AppState.contest.categories[contestant.category]) {
      clear();
      return;
    }

    // Si ya envió resultados en esta categoría, ignorar sesión guardada
    const alreadySubmitted = AppState.results.some(
      r => r.email === contestant.email && r.category === contestant.category
    );
    if (alreadySubmitted) { clear(); return; }

    // Hay progreso real: preguntar al usuario si quiere continuar
    if (!solves || solves.length === 0) { clear(); return; }

    AppState.contestant   = contestant;
    AppState.solves       = solves;
    AppState.currentSolve = currentSolve;

    // Mostrar banner de recuperación
    _showRestoreBanner(() => {
      Timer.init();   
      UI.showView('view-contest');
    }, () => {
      clear();
      AppState.contestant   = null;
      AppState.solves       = [];
      AppState.currentSolve = 0;
    });
  }

  function _showRestoreBanner(onContinue, onDiscard) {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position:fixed;inset:0;background:rgba(0,0,0,.8);backdrop-filter:blur(6px);
      z-index:600;display:flex;align-items:center;justify-content:center;padding:1rem;
    `;
    overlay.innerHTML = `
      <div style="background:var(--surface);border:1px solid var(--border2);border-radius:10px;
                  padding:2rem;max-width:400px;width:100%;animation:fadeUp .2s ease;
                  font-family:'Plus Jakarta Sans',sans-serif;">
        <div style="font-family:'DM Serif Display',serif;font-size:1.4rem;margin-bottom:.6rem;">
          Sesión guardada
        </div>
        <p style="color:var(--muted2);font-size:.88rem;line-height:1.65;margin-bottom:1.2rem;">
          Tenés <strong style="color:var(--accent)">${AppState.solves.length} solve(s)</strong>
          guardados en <strong style="color:var(--text)">${AppState.contest.categories[AppState.contestant.category]?.name}</strong>
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