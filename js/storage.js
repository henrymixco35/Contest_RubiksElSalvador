/**
 * storage.js
 */

const Storage = (() => {

  function _contestRef()      { return FB.doc(db, 'contest', 'config'); }
  function _resultsCol()      { return FB.collection(db, 'results'); }
  function _participantsCol() { return FB.collection(db, 'participants'); }
  function _logsCol()         { return FB.collection(db, 'logs'); }

  /* ── Contest ────────────────────────────────────────── */
  async function loadContest() {
    try {
      const snap = await FB.getDoc(_contestRef());
      if (snap.exists()) return snap.data();
    } catch (e) {
      console.error('[Storage] loadContest:', e);
    }
    return { name: '', deadline: '', categories: {} };
  }

  async function saveContest(data) {
    await FB.setDoc(_contestRef(), data);
  }

  /* ── Results ────────────────────────────────────────── */
  async function loadResults() {
    try {
      const snap = await FB.getDocs(_resultsCol());
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (e) {
      console.error('[Storage] loadResults:', e);
      return [];
    }
  }

  async function saveResult(result) {
    const ref = await FB.addDoc(_resultsCol(), {
      ...result,
      createdAt: FB.serverTimestamp(),
    });
    return ref.id;
  }

  async function updateResultStatus(resultId, status) {
    const ref = FB.doc(db, 'results', resultId);
    await FB.updateDoc(ref, { status });
  }

  /* ── Participants ───────────────────────────────────── */
  async function loadParticipants() {
    try {
      const snap = await FB.getDocs(_participantsCol());
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (e) {
      console.error('[Storage] loadParticipants:', e);
      return [];
    }
  }

  async function saveParticipant(participant) {
    const ref = await FB.addDoc(_participantsCol(), {
      ...participant,
      createdAt: FB.serverTimestamp(),
    });
    return ref.id;
  }
  
  async function updateParticipantSession(email, category, data) {
    try {
      const q    = FB.query(
        _participantsCol(),
        FB.where('email',    '==', email),
        FB.where('category', '==', category),
      );
      const snap = await FB.getDocs(q);
      if (snap.empty) return;
      await FB.updateDoc(snap.docs[0].ref, data);
    } catch (e) {
      console.warn('[Storage] updateParticipantSession:', e?.message || e);
    }
  }

  /* ── Subscriptions ──────────────────────────────────── */
  function subscribeResults(callback) {
    return FB.onSnapshot(
      FB.collection(db, 'results'),
      snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      err  => console.error('[Storage] subscribeResults:', err),
    );
  }

  function subscribeParticipants(callback) {
    return FB.onSnapshot(
      FB.collection(db, 'participants'),
      snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      err  => console.error('[Storage] subscribeParticipants:', err),
    );
  }

  /* ── Logs ───────────────────────────────────────────── */
  async function loadLogs(limitCount = 200) {
    try {
      const snap = await FB.getDocs(
        FB.query(_logsCol(), FB.orderBy('createdAt', 'desc')),
      );
      return snap.docs.map(d => ({ id: d.id, ...d.data() })).slice(0, limitCount);
    } catch (e) {
      console.error('[Storage] loadLogs:', e);
      return [];
    }
  }

  async function clearOldLogs() {
    try {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 30);
      const snap = await FB.getDocs(_logsCol());
      const old  = snap.docs.filter(d => {
        const ts = d.data().timestamp;
        return ts && new Date(ts) < cutoff;
      });
      await Promise.all(old.map(d => FB.deleteDoc(d.ref)));
    } catch (e) {
      console.warn('[Storage] clearOldLogs:', e?.message || e);
    }
  }

  /* ── Reset total ────────────────────────────────────── */
  async function resetContest() {
    const [rSnap, pSnap] = await Promise.all([
      FB.getDocs(_resultsCol()),
      FB.getDocs(_participantsCol()),
    ]);
    await Promise.all([
      ...rSnap.docs.map(d => FB.deleteDoc(d.ref)),
      ...pSnap.docs.map(d => FB.deleteDoc(d.ref)),
      FB.deleteDoc(_contestRef()),
    ]);
  }

  return {
    loadContest, saveContest,
    loadResults, saveResult, updateResultStatus,
    loadParticipants, saveParticipant, updateParticipantSession,
    subscribeResults, subscribeParticipants,
    loadLogs, clearOldLogs,
    resetContest,
  };
})();