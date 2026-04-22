/**
 * config.js
 */

// ── Lista de categorías WCA soportadas ────────────────
const CATEGORIES = [
  { id: '2x2',   name: '2x2'      },
  { id: '3x3',   name: '3x3'      },
  { id: '4x4',   name: '4x4'      },
  { id: '5x5',   name: '5x5'      },
  { id: '6x6',   name: '6x6'      },
  { id: '7x7',   name: '7x7'      },
  { id: 'clock', name: 'Clock'    },
  { id: 'mega',  name: 'Megaminx' },
  { id: 'pyra',  name: 'Pyraminx' },
  { id: 'skewb', name: 'Skewb'    },
  { id: 'sq1',   name: 'Sq-1'     },
  { id: '3oh',   name: '3x3 OH'   },
  { id: '3bld',  name: '3x3 BLD'  },
];

const AppState = {
  contestant:    null,
  isOrganizer:   false,
  lastOwnResult: null,

  contest: {
    name:       '',
    deadline:   '',
    categories: {},
  },

  results:      [],
  participants: [],

  solves:           [],
  currentSolve:     0,
  timerState:       'idle',
  timerStart:       0,
  timerInterval:    null,
  timerValue:       0,
  scrambleRevealed: false,
  currentPenalty:   null,

  _unsubscribeResults: null,
};