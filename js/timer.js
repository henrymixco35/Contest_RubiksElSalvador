/**
 * timer.js
 */

const Timer = (() => {

  function msToDisplay(ms) {
    const totalSec = ms / 1000;
    const min  = Math.floor(totalSec / 60);
    const sec  = Math.floor(totalSec % 60);
    const cent = Math.floor((ms % 1000) / 10);
    if (min > 0) {
      return `${min}:${String(sec).padStart(2, '0')}.${String(cent).padStart(2, '0')}`;
    }
    return `${sec}.${String(cent).padStart(2, '0')}`;
  }

  function getSolveMs(solve) {
    if (solve.penalty === 'dnf') return Infinity;
    return solve.ms + (solve.penalty === 'plus2' ? 2000 : 0);
  }

  function formatSolve(solve) {
    if (!solve) return '—';
    if (solve.penalty === 'dnf') return 'DNF';
    const ms = getSolveMs(solve);
    return msToDisplay(ms) + (solve.penalty === 'plus2' ? ' +2' : '');
  }

  const HOLD_MS       = 600;
  const INSPECTION_MS = 15000;
  const PLUS2_END_MS  = 17000;
  const MO3_CATS      = new Set(['6x6', '7x7']);

  function _totalSolves() { return MO3_CATS.has(AppState.contestant?.category) ? 3 : 5; }
  function _isMo3()       { return MO3_CATS.has(AppState.contestant?.category); }

  let inspectionInterval = null;
  let inspectionStart    = 0;
  let inspectionPenalty  = null;
  let holdTimeout = null;
  let holdReady   = false;
  let isHolding   = false;

  let reviewMode  = false;
  let reviewIndex = null;

  /* ── Init ───────────────────────────────────────────── */

  function init() {
    if (!AppState.solves)       AppState.solves       = [];
    if (!AppState.currentSolve) AppState.currentSolve = 0;

    AppState.scrambleRevealed = false;
    AppState.currentPenalty   = null;
    AppState.timerState       = 'idle';
    reviewMode                = false;
    reviewIndex               = null;

    _clearInspection();
    _clearHold();

    Results.resetSubmitFlag();

    document.body.classList.add('in-contest');

    document.getElementById('sb-name').textContent = AppState.contestant.name;
    const catData = AppState.contest.categories[AppState.contestant.category];
    document.getElementById('sb-cat').textContent = catData ? catData.name : AppState.contestant.category;

    /* Resetear sidebar al estado correcto según viewport */
    UI.resetSidebar();

    _renderSolveList();
    _resetDisplay();
    _updateScrambleDisplay();

    document.getElementById('submit-section').classList.remove('visible');
    document.getElementById('scramble-display').style.display   = '';
    document.getElementById('next-scramble-wrap').style.display = '';
    document.getElementById('timer-controls').style.display     = 'none';
    _hideReviewPanel();

    const ao5LabelEl = document.getElementById('ao-label');
    if (ao5LabelEl) ao5LabelEl.textContent = getStatLabel();
    const totalEl = document.getElementById('total-solve-num');
    if (totalEl) totalEl.textContent = _totalSolves();

    if (AppState.currentSolve >= _totalSolves()) {
      _showFinalSummary();
    } else {
      document.getElementById('solve-badge').textContent = `SOLVE ${AppState.currentSolve + 1}`;
      document.getElementById('current-solve-num').textContent = AppState.currentSolve + 1;
    }
  }

  /* ── Handlers principales ───────────────────────────── */

  function handlePress() {
    if (reviewMode) return;
    const state = AppState.timerState;
    if (state === 'running')    { _stop();            return; }
    if (state === 'stopped')    { _next();            return; }
    if (state === 'inspection') { _beginHold();       return; }
    if (state === 'idle') {
      if (!AppState.scrambleRevealed) {
        UI.toast('⚠ Primero revelá el scramble');
        return;
      }
      _startInspection();
    }
  }

  function handleRelease() {
    if (reviewMode) return;
    if (AppState.timerState === 'inspection' && isHolding) {
      if (holdReady) {
        _clearHold();
        _startTimer();
      } else {
        _clearHold();
        _restoreInspectionDisplay();
      }
    }
  }

  function handleAction() {}

  /* ── Revelar scramble ───────────────────────────────── */

  function revealScramble() {
    AppState.scrambleRevealed = true;
    _updateScrambleDisplay();
    document.getElementById('timer-hint').textContent =
      'Presioná Espacio o tocá la pantalla para iniciar inspección';
  }

  function startInspection() { _startInspection(); }

  /* ── Penalización solve actual ──────────────────────── */

  function togglePenalty(type) {
    if (AppState.timerState !== 'stopped') return;
    AppState.currentPenalty = (AppState.currentPenalty === type) ? null : type;
    _applyPenaltyUI();
  }

  /* ── Revisión de solve ANTERIOR ─────────────────────── */

  function openReview(idx) {
    if (idx < 0 || idx >= AppState.solves.length) return;
    if (AppState.timerState === 'running' || AppState.timerState === 'inspection') return;

    reviewMode  = true;
    reviewIndex = idx;

    const solve   = AppState.solves[idx];
    const catData = AppState.contest.categories[AppState.contestant.category];
    const scr     = catData?.scrambles?.[idx] || '— Sin scramble —';

    const panel = document.getElementById('review-panel');
    if (!panel) return;

    document.getElementById('review-solve-num').textContent     = idx + 1;
    document.getElementById('review-scramble-text').textContent = scr;
    document.getElementById('review-time-display').textContent  = formatSolve(solve);

    _updateReviewBtns(solve);
    panel.style.display = 'flex';

    const cubeWrap = document.getElementById('cube-preview-wrap');
    if (cubeWrap) {
      cubeWrap.style.display = '';
      _renderCubePreview(AppState.contestant.category, scr);
    }

    document.getElementById('next-scramble-wrap').style.display = 'none';
    const timerInner = document.getElementById('timer-area-inner');
    if (timerInner) timerInner.style.opacity = '0.3';
    document.getElementById('timer-controls').style.display = 'none';
  }

  function reviewTogglePenalty(type) {
    if (!reviewMode || reviewIndex === null) return;
    const solve = AppState.solves[reviewIndex];
    solve.penalty = (solve.penalty === type) ? null : type;
    document.getElementById('review-time-display').textContent = formatSolve(solve);
    _updateReviewBtns(solve);
    _renderSolveList();
    SessionStore.save();
  }

  function _updateReviewBtns(solve) {
    const p2Btn  = document.getElementById('review-btn-plus2');
    const dnfBtn = document.getElementById('review-btn-dnf');
    if (p2Btn)  p2Btn.className  = 'btn-penalize' + (solve.penalty === 'plus2' ? ' active'     : '');
    if (dnfBtn) dnfBtn.className = 'btn-penalize' + (solve.penalty === 'dnf'   ? ' dnf-active' : '');
  }

  function closeReview() {
    reviewMode  = false;
    reviewIndex = null;
    _hideReviewPanel();

    const timerInner = document.getElementById('timer-area-inner');
    if (timerInner) timerInner.style.opacity = '';

    const cubeWrap = document.getElementById('cube-preview-wrap');
    if (cubeWrap) cubeWrap.style.display = 'none';

    if (AppState.timerState === 'idle' && AppState.currentSolve < _totalSolves()) {
      document.getElementById('next-scramble-wrap').style.display = '';
      _updateScrambleDisplay();
    } else if (AppState.timerState === 'stopped') {
      document.getElementById('timer-controls').style.display = 'flex';
    }

    _renderSolveList();
  }

  function _hideReviewPanel() {
    const panel = document.getElementById('review-panel');
    if (panel) panel.style.display = 'none';
  }

  /* ── Abandonar ──────────────────────────────────────── */

  function abandon() {
    _clearInspection();
    _clearHold();
    clearInterval(AppState.timerInterval);
    AppState.timerState = 'idle';
    reviewMode  = false;
    reviewIndex = null;

    SessionStore.clear();
    AppState.solves       = [];
    AppState.currentSolve = 0;
    AppState.contestant   = null;

    document.body.classList.remove('in-contest');

    UI.closeModal('modal-abandon');
    UI.showView('view-landing');
  }

  /* ── Stats públicas ─────────────────────────────────── */

  function getBestDisplay() {
    if (!AppState.solves.length) return '—';
    const best = Math.min(...AppState.solves.map(getSolveMs));
    return best === Infinity ? 'DNF' : msToDisplay(best);
  }

  function getAo5Display() {
    const total = _totalSolves();
    if (AppState.solves.length < total) return '—';
    return _isMo3() ? _calcMo3Display(AppState.solves) : _calcAo5Display(AppState.solves);
  }

  function getAo5Ms() {
    const total = _totalSolves();
    if (AppState.solves.length < total) return Infinity;
    return _isMo3() ? _calcMo3Ms(AppState.solves) : _calcAo5Ms(AppState.solves);
  }

  function getStatLabel() { return _isMo3() ? 'Mo3' : 'Ao5'; }

  /* ── Inspección ─────────────────────────────────────── */

  function _startInspection() {
    AppState.timerState = 'inspection';
    inspectionStart     = performance.now();
    inspectionPenalty   = null;

    const disp = document.getElementById('timer-display');
    disp.className   = 'timer-display inspection';
    disp.textContent = '15';
    document.getElementById('timer-hint').textContent =
      'Mantené presionado Espacio / pantalla para iniciar';
    document.getElementById('timer-controls').style.display = 'none';

    inspectionInterval = setInterval(() => {
      const elapsed = performance.now() - inspectionStart;

      if (elapsed >= PLUS2_END_MS) {
        _clearInspection();
        _clearHold();
        AppState.solves.push({ ms: 0, penalty: 'dnf' });
        AppState.currentSolve++;
        AppState.scrambleRevealed = false;
        AppState.timerState       = 'idle';
        _renderSolveList();
        SessionStore.save();
        if (AppState.currentSolve >= _totalSolves()) {
          _showFinalSummary();
        } else {
          _resetDisplay();
          _updateScrambleDisplay();
          document.getElementById('scramble-display').style.display   = '';
          document.getElementById('next-scramble-wrap').style.display = '';
        }
        return;
      }

      if (elapsed >= INSPECTION_MS) {
        inspectionPenalty = 'plus2';
        disp.textContent  = '+2';
        disp.className    = 'timer-display inspection plus2-warn';
        return;
      }

      const secs = Math.ceil((INSPECTION_MS - elapsed) / 1000);
      disp.textContent = secs.toString();
      disp.className   = 'timer-display inspection' + (secs <= 8 ? ' warn' : '');
    }, 50);
  }

  function _clearInspection() {
    clearInterval(inspectionInterval);
    inspectionInterval = null;
  }

  function _restoreInspectionDisplay() {
    if (AppState.timerState !== 'inspection') return;
    const elapsed = performance.now() - inspectionStart;
    const disp    = document.getElementById('timer-display');
    if (elapsed >= INSPECTION_MS) {
      disp.textContent = '+2';
      disp.className   = 'timer-display inspection plus2-warn';
    } else {
      const secs = Math.ceil((INSPECTION_MS - elapsed) / 1000);
      disp.textContent = secs.toString();
      disp.className   = 'timer-display inspection' + (secs <= 8 ? ' warn' : '');
    }
    document.getElementById('timer-hint').textContent =
      'Mantené presionado Espacio / pantalla para iniciar';
  }

  /* ── Hold-to-start ──────────────────────────────────── */

  function _beginHold() {
    if (isHolding) return;
    isHolding = true;
    holdReady = false;

    const disp = document.getElementById('timer-display');
    disp.className = 'timer-display inspection hold-yellow';
    document.getElementById('timer-hint').textContent = 'Seguí manteniendo…';

    holdTimeout = setTimeout(() => {
      if (!isHolding) return;
      holdReady = true;
      disp.className = 'timer-display inspection hold-green';
      document.getElementById('timer-hint').textContent = '¡Soltá para empezar!';
    }, HOLD_MS);
  }

  function _clearHold() {
    clearTimeout(holdTimeout);
    holdTimeout = null;
    holdReady   = false;
    isHolding   = false;
  }

  /* ── Timer real ─────────────────────────────────────── */

  function _startTimer() {
    _clearInspection();
    const prepenalty  = inspectionPenalty;
    inspectionPenalty = null;

    AppState.timerState     = 'running';
    AppState.timerStart     = performance.now();
    AppState.currentPenalty = prepenalty;

    const disp = document.getElementById('timer-display');
    disp.className   = 'timer-display running';
    disp.textContent = '0.00';
    document.getElementById('timer-hint').textContent = 'Tocá para detener · Cualquier tecla detiene';

    const cubeWrap = document.getElementById('cube-preview-wrap');
    if (cubeWrap) cubeWrap.style.display = 'none';

    AppState.timerInterval = setInterval(() => {
      const elapsed = performance.now() - AppState.timerStart;
      AppState.timerValue = elapsed;
      document.getElementById('timer-display').textContent = msToDisplay(elapsed);
    }, 10);
  }

  function _stop() {
    clearInterval(AppState.timerInterval);
    const elapsed = performance.now() - AppState.timerStart;
    AppState.timerValue = elapsed;
    AppState.timerState = 'stopped';

    const disp = document.getElementById('timer-display');
    disp.className = 'timer-display stopped';

    if (AppState.currentPenalty === 'plus2') {
      disp.textContent = msToDisplay(elapsed + 2000) + ' +2';
      document.getElementById('btn-plus2').className = 'btn-penalize active';
    } else {
      disp.textContent = msToDisplay(elapsed);
      document.getElementById('btn-plus2').className = 'btn-penalize';
    }
    document.getElementById('btn-dnf').className = 'btn-penalize';

    document.getElementById('timer-hint').textContent =
      'Tocá para continuar · Aplicá +2 o DNF si corresponde';
    document.getElementById('timer-controls').style.display = 'flex';
  }

  function _next() {
    AppState.solves.push({ ms: AppState.timerValue, penalty: AppState.currentPenalty });
    AppState.currentSolve++;
    AppState.scrambleRevealed = false;
    AppState.timerState       = 'idle';
    AppState.currentPenalty   = null;
    inspectionPenalty         = null;

    _renderSolveList();
    SessionStore.save();

    if (AppState.currentSolve >= _totalSolves()) { _showFinalSummary(); return; }

    _resetDisplay();
    _updateScrambleDisplay();
    document.getElementById('timer-controls').style.display     = 'none';
    document.getElementById('scramble-display').style.display   = '';
    document.getElementById('next-scramble-wrap').style.display = '';
    _hideReviewPanel();
  }

  /* ── Scramble + cubo 2D ─────────────────────────────── */

  const PUZZLE_MAP = {
    '2x2':   '2x2x2',  '3x3':  '3x3x3',  '4x4':  '4x4x4',
    '5x5':   '5x5x5',  '6x6':  '6x6x6',  '7x7':  '7x7x7',
    'clock': 'clock',  'mega': 'megaminx','pyra': 'pyraminx',
    'skewb': 'skewb',  'sq1':  'square1', '3oh':  '3x3x3',
    '3bld':  '3x3x3',
  };

  function _updateScrambleDisplay() {
    const text     = document.getElementById('scramble-text');
    const btn      = document.getElementById('btn-reveal');
    const cubeWrap = document.getElementById('cube-preview-wrap');

    if (!AppState.scrambleRevealed) {
      text.innerHTML    = '<span class="scramble-locked">Presioná "Ver Scramble" para continuar</span>';
      btn.style.display = '';
      if (cubeWrap) cubeWrap.style.display = 'none';
    } else {
      const catData = AppState.contest.categories[AppState.contestant.category];
      const scr     = catData?.scrambles?.[AppState.currentSolve] || '— Sin scramble —';
      text.textContent  = scr;
      btn.style.display = 'none';
      if (cubeWrap) {
        cubeWrap.style.display = '';
        _renderCubePreview(AppState.contestant.category, scr);
      }
    }
  }

  function _renderCubePreview(catId, scramble) {
    const container = document.getElementById('cube-preview');
    if (!container) return;
    container.innerHTML = '';
    const bg = '#0a0a0f';
    const srcdoc = `<!DOCTYPE html>
<html><head>
<style>
  *{margin:0;padding:0;box-sizing:border-box;}
  html,body{background:${bg};width:100%;height:100%;display:flex;align-items:center;justify-content:center;overflow:hidden;}
  twisty-player{width:100%;height:100%;--background:${bg};--panel-background:${bg};background:${bg};}
</style>
<script src="https://cdn.cubing.net/v0/js/cubing/twisty" type="module"><\/script>
</head><body>
<twisty-player
  puzzle="${PUZZLE_MAP[catId] || '3x3x3'}"
  visualization="2D" control-panel="none" hint-facelets="none" back-view="none"
  experimental-setup-alg="${scramble.replace(/"/g, '&quot;').replace(/'/g, '&#39;')}"
  experimental-setup-anchor="end" alg="" tempo-scale="0"
></twisty-player>
</body></html>`;
    const iframe = document.createElement('iframe');
    iframe.srcdoc        = srcdoc;
    iframe.style.cssText = `width:100%;height:200px;border:none;background:${bg};display:block;border-radius:8px;`;
    iframe.scrolling     = 'no';
    iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin');
    container.appendChild(iframe);
  }

  /* ── Display helpers ────────────────────────────────── */

  function _resetDisplay() {
    const disp = document.getElementById('timer-display');
    disp.className   = 'timer-display';
    disp.textContent = '0:00.00';
    document.getElementById('timer-hint').textContent  = 'Presioná "Ver Scramble" para continuar';
    document.getElementById('solve-badge').textContent = `SOLVE ${AppState.currentSolve + 1}`;
    document.getElementById('current-solve-num').textContent = AppState.currentSolve + 1;
    const totalEl = document.getElementById('total-solve-num');
    if (totalEl) totalEl.textContent = _totalSolves();
  }

  function _applyPenaltyUI() {
    const p2   = document.getElementById('btn-plus2');
    const dn   = document.getElementById('btn-dnf');
    const disp = document.getElementById('timer-display');
    p2.className = 'btn-penalize' + (AppState.currentPenalty === 'plus2' ? ' active'     : '');
    dn.className = 'btn-penalize' + (AppState.currentPenalty === 'dnf'   ? ' dnf-active' : '');
    if (AppState.currentPenalty === 'dnf') {
      disp.className   = 'timer-display dnf';
      disp.textContent = 'DNF';
    } else if (AppState.currentPenalty === 'plus2') {
      disp.className   = 'timer-display stopped';
      disp.textContent = msToDisplay(AppState.timerValue + 2000) + ' +2';
    } else {
      disp.className   = 'timer-display stopped';
      disp.textContent = msToDisplay(AppState.timerValue);
    }
  }

  function _renderSolveList() {
    const list = document.getElementById('solve-list');
    list.innerHTML = '';
    for (let i = 0; i < _totalSolves(); i++) {
      const done    = i < AppState.solves.length;
      const current = i === AppState.currentSolve && !done;
      const solve   = AppState.solves[i];

      const div = document.createElement('div');
      div.className = 'solve-item' + (current ? ' current' : '') + (done ? ' done' : '');
      if (done) {
        div.title        = 'Tocá para revisar/corregir';
        div.style.cursor = 'pointer';
        div.addEventListener('click', () => openReview(i));
      }

      const num = document.createElement('span');
      num.className   = 'si-num';
      num.textContent = `S${i + 1}`;

      const time = document.createElement('span');
      if (done) {
        time.className   = 'si-time' + (solve.penalty === 'dnf' ? ' dnf' : '');
        time.textContent = formatSolve(solve);
        const editIcon = document.createElement('span');
        editIcon.textContent  = ' ✎';
        editIcon.style.cssText = 'font-size:.55rem;color:var(--muted);opacity:.5;';
        time.appendChild(editIcon);
      } else {
        time.className   = 'si-time';
        time.style.color = 'var(--muted)';
        time.textContent = current ? '...' : '—';
      }

      div.appendChild(num);
      div.appendChild(time);
      list.appendChild(div);
    }
    document.getElementById('ao-best').textContent = getBestDisplay();
    document.getElementById('ao-ao5').textContent  = getAo5Display();
    const ao5LabelEl = document.getElementById('ao-label');
    if (ao5LabelEl) ao5LabelEl.textContent = getStatLabel();
  }

  function _showFinalSummary() {
    document.getElementById('scramble-display').style.display   = 'none';
    document.getElementById('next-scramble-wrap').style.display = 'none';
    document.getElementById('timer-controls').style.display     = 'none';
    _hideReviewPanel();
    const cubeWrap = document.getElementById('cube-preview-wrap');
    if (cubeWrap) cubeWrap.style.display = 'none';

    const disp = document.getElementById('timer-display');
    disp.className   = 'timer-display';
    disp.textContent = '✓';
    document.getElementById('solve-badge').textContent = '¡COMPLETADO!';
    document.getElementById('timer-hint').textContent  = '';

    document.body.classList.remove('in-contest');
    document.getElementById('view-contest').style.height   = '';
    document.getElementById('view-contest').style.overflow = '';

    const summary = document.getElementById('final-summary');
    summary.innerHTML = `
      <h3 style="font-size:.75rem;letter-spacing:.15em;text-transform:uppercase;
                 color:var(--accent);font-family:'Space Mono',monospace;margin-bottom:1rem;">
        Resumen Final
      </h3>`;
    AppState.solves.forEach((s, i) => {
      const row = document.createElement('div');
      row.className = 'final-stat';
      row.innerHTML = `<span class="label">Solve ${i + 1}</span><span class="value">${formatSolve(s)}</span>`;
      summary.appendChild(row);
    });
    const bestRow = document.createElement('div');
    bestRow.className = 'final-stat';
    bestRow.innerHTML = `<span class="label">Mejor</span><span class="value" style="color:var(--accent)">${getBestDisplay()}</span>`;
    summary.appendChild(bestRow);
    const ao5Row = document.createElement('div');
    ao5Row.className = 'final-stat';
    ao5Row.innerHTML = `<span class="label">${getStatLabel()}</span><span class="value" style="color:var(--accent3)">${getAo5Display()}</span>`;
    summary.appendChild(ao5Row);
    document.getElementById('submit-section').classList.add('visible');
  }

  function _calcAo5Ms(solves) {
    const times   = solves.map(getSolveMs).sort((a, b) => a - b);
    const trimmed = times.slice(1, 4);
    if (trimmed.some(t => t === Infinity)) return Infinity;
    return trimmed.reduce((a, b) => a + b, 0) / 3;
  }
  function _calcAo5Display(solves) {
    const ms = _calcAo5Ms(solves);
    return ms === Infinity ? 'DNF' : msToDisplay(ms);
  }
  function _calcMo3Ms(solves) {
    const times = solves.map(getSolveMs);
    if (times.some(t => t === Infinity)) return Infinity;
    return times.reduce((a, b) => a + b, 0) / 3;
  }
  function _calcMo3Display(solves) {
    const ms = _calcMo3Ms(solves);
    return ms === Infinity ? 'DNF' : msToDisplay(ms);
  }

  return {
    init, handlePress, handleRelease, handleAction,
    revealScramble, startInspection,
    togglePenalty,
    openReview, reviewTogglePenalty, closeReview,
    abandon,
    getBestDisplay, getAo5Display, getAo5Ms, getStatLabel,
    formatSolve:  s  => formatSolve(s),
    getSolveMs:   s  => getSolveMs(s),
    msToDisplay:  ms => msToDisplay(ms),
  };
})();