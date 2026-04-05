/**
 * storage.js
 * ──────────────────────────────────────────────────────
 * Capa de persistencia usando Firestore en lugar de
 * localStorage. Expone la misma interfaz que antes para
 * no tener que cambiar el resto del código.
 *
 * Estructura en Firestore:
 *
 *   /contest/config          → { name, deadline, categories }
 *   /results/{autoId}        → { name, email, category, solves, ao5, ... }
 *   /participants/{autoId}   → { name, email, category, suggestions, timestamp }
 *
 * Reglas de seguridad (ver firestore.rules):
 *   - contest/config  → solo el organizador autenticado escribe
 *   - results         → cualquiera escribe UNA VEZ por email+categoría;
 *                       todos pueden leer
 *   - participants    → cualquiera escribe; solo org lee emails
 */

const Storage = (() => {

  // ── Helpers internos ──────────────────────────────────

  function _contestRef()      { return FB.doc(db, 'contest', 'config'); }
  function _resultsCol()      { return FB.collection(db, 'results'); }
  function _participantsCol() { return FB.collection(db, 'participants'); }

  // ── Cargar configuración del contest ──────────────────

  async function loadContest() {
    try {
      const snap = await FB.getDoc(_contestRef());
      if (snap.exists()) return snap.data();
    } catch (e) {
      console.error('[Storage] loadContest:', e);
    }
    return { name: '', deadline: '', categories: {} };
  }

  // ── Guardar configuración del contest (solo org) ──────

  async function saveContest(data) {
    await FB.setDoc(_contestRef(), data);
  }

  // ── Cargar todos los resultados ───────────────────────

  async function loadResults() {
    try {
      const snap = await FB.getDocs(_resultsCol());
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (e) {
      console.error('[Storage] loadResults:', e);
      return [];
    }
  }

  // ── Guardar un resultado (competidor) ─────────────────

  async function saveResult(result) {
    const ref = await FB.addDoc(_resultsCol(), {
      ...result,
      createdAt: FB.serverTimestamp(),
    });
    return ref.id;
  }

  // ── Cargar participantes ──────────────────────────────

  async function loadParticipants() {
    try {
      const snap = await FB.getDocs(_participantsCol());
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (e) {
      console.error('[Storage] loadParticipants:', e);
      return [];
    }
  }

  // ── Guardar participante ──────────────────────────────

  async function saveParticipant(participant) {
    const ref = await FB.addDoc(_participantsCol(), {
      ...participant,
      createdAt: FB.serverTimestamp(),
    });
    return ref.id;
  }

  // ── Suscripción en tiempo real a resultados ───────────
  // Llama a callback(results[]) cada vez que Firestore cambia.

  function subscribeResults(callback) {
    return FB.onSnapshot(
      FB.collection(db, 'results'),
      (snap) => {
        const results = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        callback(results);
      },
      (err) => console.error('[Storage] subscribeResults:', err)
    );
  }

  // ── Borrar resultados y participantes (solo org) ──────
  // Firestore no tiene "borrar colección" en cliente directamente;
  // lo hacemos doc a doc. Para pocos registros está bien.

  async function resetContest() {
    const { deleteDoc } = await import(
      "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js"
    );
    const [rSnap, pSnap] = await Promise.all([
      FB.getDocs(_resultsCol()),
      FB.getDocs(_participantsCol()),
    ]);
    const deletes = [
      ...rSnap.docs.map(d => deleteDoc(d.ref)),
      ...pSnap.docs.map(d => deleteDoc(d.ref)),
    ];
    await Promise.all(deletes);
  }

  return {
    loadContest,
    saveContest,
    loadResults,
    saveResult,
    loadParticipants,
    saveParticipant,
    subscribeResults,
    resetContest,
  };
})();
