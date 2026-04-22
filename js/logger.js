/**
 * logger.js
 */

const Logger = (() => {

  const LEVELS = { info: 'info', warn: 'warn', error: 'error' };

  const _queue = [];
  let _ready    = false;

  /* ── Payload base ───────────────────────────────────── */
  function _basePayload(level, event, data = {}) {
    return {
      level,
      event,
      timestamp:  new Date().toISOString(),
      email:      AppState?.contestant?.email    || null,
      name:       AppState?.contestant?.name     || null,
      category:   AppState?.contestant?.category || null,
      solveNum:   AppState?.currentSolve         ?? null,
      ua:         navigator.userAgent.slice(0, 200), // limitar tamaño
      ...data,
    };
  }

  /* ── Escritura a Firestore ──────────────────────────── */
  async function _write(payload) {
    try {
      await FB.addDoc(FB.collection(db, 'logs'), {
        ...payload,
        createdAt: FB.serverTimestamp(),
      });
    } catch (e) {
      console.warn('[Logger] No se pudo escribir log:', e?.message || e);
    }
  }

  /* ── Dispatch (encolar si aún no está listo) ────────── */
  function _log(level, event, data) {
    const payload = _basePayload(level, event, data);
    if (!_ready) {
      _queue.push(payload);
      return;
    }
    _write(payload);
  }

  /* ── Activar y vaciar cola ──────────────────────────── */
  function ready() {
    _ready = true;
    const pending = _queue.splice(0);
    pending.forEach(p => _write(p));
  }

  /* ── API pública ────────────────────────────────────── */
  return {
    ready,
    info:  (event, data) => _log(LEVELS.info,  event, data),
    warn:  (event, data) => _log(LEVELS.warn,  event, data),
    error: (event, data) => _log(LEVELS.error, event, data),
  };
})();