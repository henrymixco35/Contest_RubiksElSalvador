/**
 * timer.js
 * ──────────────────────────────────────────────────────
 * Cronómetro con inspección WCA estilo cstimer:
 *   • Revelás scramble → inspección inicia automáticamente
 *   • Presionás y mantenés → amarillo → verde (0.6s) → soltás → corre
 *   • +2 si pasás 15s, DNF automático si pasás 17s
 *   • Muestra el estado del cubo en 2D con cubing.js
 */

const Timer = (() => {

  // ── Formato ──────────────────────────────────────────

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

  // ── Constantes ───────────────────────────────────────

  const HOLD_MS       = 600;
  const INSPECTION_MS = 15000;
  const PLUS2_END_MS  = 17000;

  // ── Estado interno ───────────────────────────────────

  let inspectionInterval = null;
  let inspectionStart    = 0;
  let inspectionPenalty  = null;

  let holdTimeout = null;
  let holdReady   = false;
  let isHolding   = false;

  // ── Init ─────────────────────────────────────────────

  function init() {
    AppState.solves           = [];
    AppState.currentSolve     = 0;
    AppState.scrambleRevealed = false;
    AppState.currentPenalty   = null;
    AppState.timerState       = 'idle';

    _clearInspection();
    _clearHold();

    document.getElementById('sb-name').textContent = AppState.contestant.name;
    const catData = AppState.contest.categories[AppState.contestant.category];
    document.getElementById('sb-cat').textContent  = catData ? catData.name : AppState.contestant.category;

    _renderSolveList();
    _resetDisplay();
    _updateScrambleDisplay();

    document.getElementById('submit-section').classList.remove('visible');
    document.getElementById('scramble-display').style.display        = '';
    document.getElementById('next-scramble-wrap').style.display      = '';
    document.getElementById('timer-controls').style.display          = 'none';
  }

  // ── Handlers principales (llamados desde main.js) ────

  function handlePress() {
    const state = AppState.timerState;
    if (state === 'running')    { _stop();      return; }
    if (state === 'stopped')    { _next();      return; }
    if (state === 'inspection') { _beginHold(); return; }
    if (state === 'idle') {
      if (!AppState.scrambleRevealed) {
        UI.toast('\u26a0 Primero revel\u00e1 el scramble');
        return;
      }
      _startInspection();
    }
  }

  function handleRelease() {
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

  // Compatibilidad con onclick en botones del HTML
  function handleAction() {}

  // ── Revelar scramble (solo muestra, NO arranca inspección) ──

  function revealScramble() {
    AppState.scrambleRevealed = true;
    _updateScrambleDisplay();
    document.getElementById('timer-hint').textContent =
      'Presion\u00e1 Espacio o toc\u00e1 la pantalla para iniciar inspecci\u00f3n';
  }

  // Mantenido por compatibilidad por si alg\u00fan bot\u00f3n lo llama
  function startInspection() { _startInspection(); }

  // ── Penalizaciones post-solve ────────────────────────

  function togglePenalty(type) {
    if (AppState.timerState !== 'stopped') return;
    AppState.currentPenalty = (AppState.currentPenalty === type) ? null : type;
    _applyPenaltyUI();
  }

  // ── Abandonar ────────────────────────────────────────

  function abandon() {
    _clearInspection();
    _clearHold();
    clearInterval(AppState.timerInterval);
    AppState.timerState = 'idle';
    UI.closeModal('modal-abandon');
    UI.showView('view-landing');
  }

  // ── Stats públicas ───────────────────────────────────

  function getBestDisplay() {
    if (!AppState.solves.length) return '—';
    const best = Math.min(...AppState.solves.map(getSolveMs));
    return best === Infinity ? 'DNF' : msToDisplay(best);
  }

  function getAo5Display() {
    if (AppState.solves.length < 5) return '—';
    return _calcAo5Display(AppState.solves);
  }

  function getAo5Ms() {
    if (AppState.solves.length < 5) return Infinity;
    return _calcAo5Ms(AppState.solves);
  }

  // ── Inspección ───────────────────────────────────────

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
        if (AppState.currentSolve >= 5) {
          _showFinalSummary();
        } else {
          _resetDisplay();
          _updateScrambleDisplay();
          document.getElementById('scramble-display').style.display        = '';
          document.getElementById('next-scramble-wrap').style.display      = '';
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

  // ── Hold-to-start estilo cstimer ─────────────────────

  function _beginHold() {
    if (isHolding) return;
    isHolding = true;
    holdReady = false;

    const disp = document.getElementById('timer-display');
    disp.className = 'timer-display inspection hold-yellow';
    document.getElementById('timer-hint').textContent = 'Seguí manteniendo…';

    holdTimeout = setTimeout(() => {
      if (!isHolding) return;
      holdReady      = true;
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

  // ── Timer real ───────────────────────────────────────

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
    document.getElementById('timer-hint').textContent = 'Tocá para detener';

    const cubeWrap = document.getElementById('cube-preview-wrap');
    if (cubeWrap) cubeWrap.style.display = 'none';

    AppState.timerInterval = setInterval(() => {
      const elapsed = performance.now() - AppState.timerStart;
      AppState.timerValue   = elapsed;
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

    if (AppState.currentSolve >= 5) { _showFinalSummary(); return; }

    _resetDisplay();
    _updateScrambleDisplay();
    document.getElementById('timer-controls').style.display          = 'none';
    document.getElementById('scramble-display').style.display        = '';
    document.getElementById('next-scramble-wrap').style.display      = '';
  }

  // ── Scramble display + cubo 2D ───────────────────────

  const PUZZLE_MAP = {
    '2x2':   '2x2x2',   '3x3':  '3x3x3',  '4x4':  '4x4x4',
    '5x5':   '5x5x5',   '6x6':  '6x6x6',  '7x7':  '7x7x7',
    'clock': 'clock',   'mega': 'megaminx','pyra': 'pyraminx',
    'skewb': 'skewb',   'sq1':  'square1', '3oh':  '3x3x3',
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

    const player = document.createElement('twisty-player');
    player.setAttribute('puzzle',                    PUZZLE_MAP[catId] || '3x3x3');
    player.setAttribute('visualization',             '2D');
    player.setAttribute('control-panel',             'none');
    player.setAttribute('hint-facelets',             'none');
    player.setAttribute('back-view',                 'none');
    player.setAttribute('experimental-setup-alg',    scramble);
    player.setAttribute('experimental-setup-anchor', 'end');
    player.setAttribute('alg',                       '');
    player.setAttribute('tempo-scale',               '0');
    player.setAttribute('style',
      'width:100%;height:200px;--background:transparent;--panel-background:transparent;background:transparent;');

    container.appendChild(player);
  }

  // ── Helpers display ──────────────────────────────────

  function _resetDisplay() {
    const disp = document.getElementById('timer-display');
    disp.className   = 'timer-display';
    disp.textContent = '0:00.00';
    document.getElementById('timer-hint').textContent  = 'Presioná "Ver Scramble" para continuar';
    document.getElementById('solve-badge').textContent = `SOLVE ${AppState.currentSolve + 1}`;
    document.getElementById('current-solve-num').textContent = AppState.currentSolve + 1;
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

    for (let i = 0; i < 5; i++) {
      const done    = i < AppState.solves.length;
      const current = i === AppState.currentSolve;
      const solve   = AppState.solves[i];

      const div = document.createElement('div');
      div.className = 'solve-item'
        + (current ? ' current' : '')
        + (done    ? ' done'    : '');

      const num = document.createElement('span');
      num.className   = 'si-num';
      num.textContent = `S${i + 1}`;

      const time = document.createElement('span');
      if (done) {
        time.className   = 'si-time' + (solve.penalty === 'dnf' ? ' dnf' : '');
        time.textContent = formatSolve(solve);
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
  }

  function _showFinalSummary() {
    document.getElementById('scramble-display').style.display   = 'none';
    document.getElementById('next-scramble-wrap').style.display = 'none';
    document.getElementById('timer-controls').style.display     = 'none';
    const cubeWrap = document.getElementById('cube-preview-wrap');
    if (cubeWrap) cubeWrap.style.display = 'none';

    const disp = document.getElementById('timer-display');
    disp.className   = 'timer-display';
    disp.textContent = '✓';
    document.getElementById('solve-badge').textContent = '¡COMPLETADO!';
    document.getElementById('timer-hint').textContent  = '';

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
    ao5Row.innerHTML = `<span class="label">Ao5</span><span class="value" style="color:var(--accent3)">${getAo5Display()}</span>`;
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

  return {
    init,
    handlePress,
    handleRelease,
    handleAction,
    revealScramble,
    startInspection,
    togglePenalty,
    abandon,
    getBestDisplay,
    getAo5Display,
    getAo5Ms,
    formatSolve:  (s)  => formatSolve(s),
    getSolveMs:   (s)  => getSolveMs(s),
    msToDisplay:  (ms) => msToDisplay(ms),
  };
})();