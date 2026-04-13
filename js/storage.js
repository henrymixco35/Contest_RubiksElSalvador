/**
 * storage.js
 */

const Storage = (() => {

  function _contestRef()      { return FB.doc(db, 'contest', 'config'); }
  function _resultsCol()      { return FB.collection(db, 'results'); }
  function _participantsCol() { return FB.collection(db, 'participants'); }

  async function loadContest() {
    try {
      const snap = await FB.getDoc(_contestRef());
      if (snap.exists()) return snap.data();
    } catch (e) { console.error('[Storage] loadContest:', e); }
    return { name: '', deadline: '', categories: {} };
  }

  async function saveContest(data) {
    await FB.setDoc(_contestRef(), data);
  }

  async function loadResults() {
    try {
      const snap = await FB.getDocs(_resultsCol());
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (e) { console.error('[Storage] loadResults:', e); return []; }
  }

  async function saveResult(result) {
    const ref = await FB.addDoc(_resultsCol(), { ...result, createdAt: FB.serverTimestamp() });
    return ref.id;
  }

  async function updateResultStatus(resultId, status) {
    const ref = FB.doc(db, 'results', resultId);
    await FB.updateDoc(ref, { status });
  }

  async function loadParticipants() {
    try {
      const snap = await FB.getDocs(_participantsCol());
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (e) { console.error('[Storage] loadParticipants:', e); return []; }
  }

  async function saveParticipant(participant) {
    const ref = await FB.addDoc(_participantsCol(), { ...participant, createdAt: FB.serverTimestamp() });
    return ref.id;
  }

  function subscribeResults(callback) {
    return FB.onSnapshot(
      FB.collection(db, 'results'),
      (snap) => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      (err)  => console.error('[Storage] subscribeResults:', err)
    );
  }

  async function resetContest() {
    const [rSnap, pSnap] = await Promise.all([
      FB.getDocs(_resultsCol()),
      FB.getDocs(_participantsCol()),
    ]);
    await Promise.all([
      ...rSnap.docs.map(d => FB.deleteDoc(d.ref)),
      ...pSnap.docs.map(d => FB.deleteDoc(d.ref)),
    ]);
  }

  return {
    loadContest, saveContest,
    loadResults, saveResult, updateResultStatus,
    loadParticipants, saveParticipant,
    subscribeResults, resetContest,
  };
})();