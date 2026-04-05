/**
 * timer.js
 * ──────────────────────────────────────────────────────
 * Lógica del cronómetro: iniciar, detener, penalizaciones,
 * revelar scramble y avanzar al siguiente solve.
 */

const Timer = (() => {

  // ── Helpers de formato ───────────────────────────────

  /** Convierte milisegundos a string "M:SS.CC" o "S.CC" */
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

  /** Devuelve los ms efectivos de un solve (incluyendo +2 e Infinity para DNF) */
  function getSolveMs(solve) {
    if (solve.penalty === 'dnf') return Infinity;
    return solve.ms + (solve.penalty === 'plus2' ? 2000 : 0);
  }

  /** Formatea un solve para mostrar en tabla/sidebar */
  function formatSolve(solve) {
    if (!solve) return '—';
    if (solve.penalty === 'dnf') return 'DNF';
    const ms = getSolveMs(solve);
    return msToDisplay(ms) + (solve.penalty === 'plus2' ? ' +2' : '');
  }

  // ── Inicialización del contest ───────────────────────

  function init() {
    AppState.solves          = [];
    AppState.currentSolve    = 0;
    AppState.scrambleRevealed = false;
    AppState.currentPenalty  = null;
    AppState.timerState      = 'idle';

    // Sidebar
    document.getElementById('sb-name').textContent = AppState.contestant.name;
    const catData = AppState.contest.categories[AppState.contestant.category];
    document.getElementById('sb-cat').textContent  = catData ? catData.name : AppState.contestant.category;

    _renderSolveList();
    _resetDisplay();
    _updateScrambleDisplay();

    document.getElementById('submit-section').classList.remove('visible');
    document.getElementById('scramble-display').style.display = '';
    document.getElementById('next-scramble-wrap').style.display = '';
    document.getElementById('timer-controls').style.display = 'none';
  }

  // ── Acción principal (espacio / toque) ───────────────

  function handleAction() {
    if (!AppState.scrambleRevealed) {
      UI.toast('⚠ Primero revelá el scramble');
      return;
    }
    if (AppState.currentSolve >= 5) return;

    if      (AppState.timerState === 'idle')    _start();
    else if (AppState.timerState === 'running') _stop();
    else if (AppState.timerState === 'stopped') _next();
  }

  // ── Revelar scramble ─────────────────────────────────

  function revealScramble() {
    AppState.scrambleRevealed = true;
    _updateScrambleDisplay();
    document.getElementById('timer-hint').textContent =
      'Presioná Espacio o tocá la pantalla para iniciar';
  }

  // ── Penalizaciones ───────────────────────────────────

  function togglePenalty(type) {
    if (AppState.timerState !== 'stopped') return;

    // Toggle: si ya estaba activa la misma, la quitamos
    AppState.currentPenalty = (AppState.currentPenalty === type) ? null : type;

    _applyPenaltyUI();
  }

  // ── Abandonar ────────────────────────────────────────

  function abandon() {
    clearInterval(AppState.timerInterval);
    AppState.timerState = 'idle';
    UI.closeModal('modal-abandon');
    UI.showView('view-landing');
  }

  // ── Accesores públicos ───────────────────────────────

  function getSolveMs_public(solve) { return getSolveMs(solve); }
  function formatSolve_public(solve) { return formatSolve(solve); }
  function msToDisplay_public(ms)   { return msToDisplay(ms); }

  // ── Estadísticas ─────────────────────────────────────

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

  // ── Privados ─────────────────────────────────────────

  function _start() {
    AppState.timerState   = 'running';
    AppState.timerStart   = performance.now();
    AppState.currentPenalty = null;

    const disp = document.getElementById('timer-display');
    disp.className = 'timer-display running';

    document.getElementById('timer-hint').textContent = 'Tocá para detener';
    document.getElementById('timer-controls').style.display = 'none';

    AppState.timerInterval = setInterval(() => {
      const elapsed = performance.now() - AppState.timerStart;
      AppState.timerValue = elapsed;
      document.getElementById('timer-display').textContent = msToDisplay(elapsed);
    }, 10);
  }

  function _stop() {
    clearInterval(AppState.timerInterval);
    const elapsed = performance.now() - AppState.timerStart;
    AppState.timerValue   = elapsed;
    AppState.timerState   = 'stopped';

    const disp = document.getElementById('timer-display');
    disp.className   = 'timer-display stopped';
    disp.textContent = msToDisplay(elapsed);

    document.getElementById('timer-hint').textContent =
      'Tocá para continuar · Aplicá +2 o DNF si corresponde';
    document.getElementById('timer-controls').style.display = 'flex';

    // Resetear botones de penalización
    document.getElementById('btn-plus2').className = 'btn-penalize';
    document.getElementById('btn-dnf').className   = 'btn-penalize';
  }

  function _next() {
    // Guardar el solve actual
    AppState.solves.push({
      ms: AppState.timerValue,
      penalty: AppState.currentPenalty,
    });
    AppState.currentSolve++;
    AppState.scrambleRevealed = false;
    AppState.timerState       = 'idle';
    AppState.currentPenalty   = null;

    _renderSolveList();

    if (AppState.currentSolve >= 5) {
      _showFinalSummary();
      return;
    }

    _resetDisplay();
    _updateScrambleDisplay();
    document.getElementById('timer-controls').style.display = 'none';
    document.getElementById('scramble-display').style.display = '';
    document.getElementById('next-scramble-wrap').style.display = '';
  }

  function _resetDisplay() {
    const disp = document.getElementById('timer-display');
    disp.className   = 'timer-display';
    disp.textContent = '0:00.00';
    document.getElementById('timer-hint').textContent  = 'Presioná Espacio o tocá para iniciar';
    document.getElementById('solve-badge').textContent = `SOLVE ${AppState.currentSolve + 1}`;
    document.getElementById('current-solve-num').textContent = AppState.currentSolve + 1;
  }

  function _updateScrambleDisplay() {
    const text = document.getElementById('scramble-text');
    const btn  = document.getElementById('btn-reveal');

    if (!AppState.scrambleRevealed) {
      text.innerHTML = '<span class="scramble-locked">Presioná "Ver Scramble" para continuar</span>';
      btn.style.display = '';
    } else {
      const catData = AppState.contest.categories[AppState.contestant.category];
      const scr = catData?.scrambles?.[AppState.currentSolve] || '— Sin scramble configurado —';
      text.textContent = scr;
      btn.style.display = 'none';
    }
  }

  function _applyPenaltyUI() {
    const p2 = document.getElementById('btn-plus2');
    const dn = document.getElementById('btn-dnf');
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

      const num  = document.createElement('span');
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

    // Actualizar estadísticas del sidebar
    document.getElementById('ao-best').textContent = getBestDisplay();
    document.getElementById('ao-ao5').textContent  = getAo5Display();
  }

  function _showFinalSummary() {
    document.getElementById('scramble-display').style.display   = 'none';
    document.getElementById('next-scramble-wrap').style.display = 'none';
    document.getElementById('timer-controls').style.display     = 'none';

    const disp = document.getElementById('timer-display');
    disp.className   = 'timer-display';
    disp.textContent = '✓';

    document.getElementById('solve-badge').textContent = '¡COMPLETADO!';
    document.getElementById('timer-hint').textContent  = '';

    // Construir resumen
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
    const times = solves.map(getSolveMs).sort((a, b) => a - b);
    const trimmed = times.slice(1, 4); // quita mejor y peor
    if (trimmed.some(t => t === Infinity)) return Infinity;
    return trimmed.reduce((a, b) => a + b, 0) / 3;
  }

  function _calcAo5Display(solves) {
    const ms = _calcAo5Ms(solves);
    return ms === Infinity ? 'DNF' : msToDisplay(ms);
  }

  // ── API pública ──────────────────────────────────────
  return {
    init,
    handleAction,
    revealScramble,
    togglePenalty,
    abandon,
    getBestDisplay,
    getAo5Display,
    getAo5Ms,
    formatSolve:   formatSolve_public,
    getSolveMs:    getSolveMs_public,
    msToDisplay:   msToDisplay_public,
  };
})();
