/**
 * registration.js
 * ──────────────────────────────────────────────────────
 * Registro del competidor. Guarda en Firestore.
 */

const Registration = (() => {

  function isContestClosed() {
    const deadline = AppState.contest.deadline;
    if (!deadline) return false;
    return Date.now() > new Date(deadline).getTime();
  }

  function populateCategorySelect() {
    const sel = document.getElementById('reg-category');
    sel.innerHTML = '<option value="">— Seleccioná una categoría —</option>';
    Object.entries(AppState.contest.categories || {}).forEach(([id, cat]) => {
      const opt = document.createElement('option');
      opt.value       = id;
      opt.textContent = cat.name;
      sel.appendChild(opt);
    });
  }

  async function submit() {
    if (isContestClosed()) {
      UI.toast('⚠ El contest ya cerró. No se aceptan más participantes.');
      return;
    }

    const name        = document.getElementById('reg-name').value.trim();
    const email       = document.getElementById('reg-email').value.trim().toLowerCase();
    const category    = document.getElementById('reg-category').value;
    const suggestions = document.getElementById('reg-suggestions').value.trim();

    if (!name)                         { UI.toast('⚠ Ingresá tu nombre completo'); return; }
    if (!email || !email.includes('@')) { UI.toast('⚠ El correo electrónico no es válido'); return; }
    if (!category)                     { UI.toast('⚠ Seleccioná una categoría'); return; }

    // Verificar duplicado en memoria (rápido)
    const alreadySubmitted = AppState.results.some(
      r => r.email === email && r.category === category
    );
    if (alreadySubmitted) {
      UI.toast('⚠ Ya enviaste resultados en esta categoría');
      return;
    }

    AppState.contestant = { name, email, category, suggestions };

    // Guardar participante en Firestore (si no existe ya)
    const alreadyParticipant = AppState.participants.some(
      p => p.email === email && p.category === category
    );
    if (!alreadyParticipant) {
      try {
        const participant = { name, email, category, suggestions, timestamp: new Date().toISOString() };
        await Storage.saveParticipant(participant);
        AppState.participants.push(participant);
      } catch (e) {
        console.error('[Registration] saveParticipant:', e);
        // No bloqueamos al competidor si falla esto
      }
    }

    Timer.init();
    UI.showView('view-contest');
  }

  return { populateCategorySelect, submit, isContestClosed };
})();
