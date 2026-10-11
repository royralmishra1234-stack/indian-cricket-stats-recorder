const STORAGE_KEY = 'indian-cricket-stats-recorder-v1';
const FORMATS = ['t20i', 'odi', 'test'];
const FORMAT_LABELS = {
  t20i: 'T20I',
  odi: 'ODI',
  test: 'Test',
  all: 'All Formats'
};

const defaultState = { players: {} };

const battingTableBody = document.getElementById('batting-table-body');
const bowlingTableBody = document.getElementById('bowling-table-body');
const playerNameInput = document.getElementById('player-name');
const formatSelect = document.getElementById('format-select');

const battingForm = document.getElementById('batting-form');
const bowlingForm = document.getElementById('bowling-form');

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return structuredClone(defaultState);
    const parsed = JSON.parse(saved);
    return parsed && parsed.players ? parsed : structuredClone(defaultState);
  } catch (error) {
    return structuredClone(defaultState);
  }
}

let state = loadState();

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatNumber(value, digits = 2) {
  const numeric = Number(value) || 0;
  return Number.isFinite(numeric) ? numeric.toFixed(digits) : '0.00';
}

function formatOvers(overs) {
  const numeric = Number(overs) || 0;
  if (!Number.isFinite(numeric)) return '0';
  return numeric.toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
}

function roundStats(value) {
  return Number(value || 0).toFixed(2);
}

function normalizeFigure(bestFigure) {
  const text = String(bestFigure || '').trim();
  if (!text || text === '0/0') return { wickets: 0, runs: 0, raw: '0/0' };
  const match = text.match(/(\d+)\s*\/\s*(\d+)/i);
  if (!match) return { wickets: 0, runs: 0, raw: text };
  return {
    wickets: Number(match[1]),
    runs: Number(match[2]),
    raw: `${Number(match[1])}/${Number(match[2])}`
  };
}

function bestFigureComparator(a, b) {
  const aInfo = normalizeFigure(a);
  const bInfo = normalizeFigure(b);
  if (aInfo.wickets !== bInfo.wickets) return bInfo.wickets - aInfo.wickets;
  return bInfo.runs - aInfo.runs;
}

function convertOversToBalls(overs) {
  const value = Number(overs);
  if (!Number.isFinite(value) || value < 0) return 0;

  const wholeOvers = Math.floor(value);
  const fraction = value - wholeOvers;
  const fractionMap = {
    0.16: 1,
    0.33: 2,
    0.5: 3,
    0.66: 4,
    0.83: 5
  };

  let extraBalls = 0;
  const closestKey = Object.keys(fractionMap).find((key) => Math.abs(Number(key) - fraction) < 0.03);
  if (closestKey) {
    extraBalls = fractionMap[closestKey];
  }

  return wholeOvers * 6 + extraBalls;
}

function serializeBattingStats(formValues) {
  return {
    matches: toNumber(formValues.matches),
    innings: toNumber(formValues.innings),
    notOuts: toNumber(formValues.notOuts),
    runs: toNumber(formValues.runs),
    ballsFaced: toNumber(formValues.ballsFaced),
    zeros: toNumber(formValues.zeros),
    thirties: toNumber(formValues.thirties),
    fifties: toNumber(formValues.fifties),
    hundreds: toNumber(formValues.hundreds),
    fours: toNumber(formValues.fours),
    sixes: toNumber(formValues.sixes),
    bestScore: toNumber(formValues.bestScore)
  };
}

function serializeBowlingStats(formValues) {
  return {
    innings: toNumber(formValues.innings),
    wickets: toNumber(formValues.wickets),
    runs: toNumber(formValues.runs),
    overs: toNumber(formValues.overs),
    threeWicketHauls: toNumber(formValues.threeWicketHauls),
    fiveWicketHauls: toNumber(formValues.fiveWicketHauls),
    bestFigure: String(formValues.bestFigure || '0/0')
  };
}

function ensurePlayer(playerName) {
  const cleanedName = playerName.trim();
  if (!cleanedName) return null;
  if (!state.players[cleanedName]) {
    state.players[cleanedName] = {
      batting: {},
      bowling: {}
    };
  }
  return state.players[cleanedName];
}

function getBattingEntriesForPlayer(playerName) {
  const player = state.players[playerName];
  if (!player) return [];
  return FORMATS.map((format) => player.batting[format]).filter(Boolean);
}

function getBowlingEntriesForPlayer(playerName) {
  const player = state.players[playerName];
  if (!player) return [];
  return FORMATS.map((format) => player.bowling[format]).filter(Boolean);
}

function aggregateBattingForPlayer(playerName) {
  const entries = getBattingEntriesForPlayer(playerName);
  if (!entries.length) {
    return {
      matches: 0,
      innings: 0,
      notOuts: 0,
      runs: 0,
      ballsFaced: 0,
      zeros: 0,
      thirties: 0,
      fifties: 0,
      hundreds: 0,
      fours: 0,
      sixes: 0,
      bestScore: 0,
      average: 0,
      strikeRate: 0
    };
  }

  const total = {
    matches: entries.reduce((sum, item) => sum + toNumber(item.matches), 0),
    innings: entries.reduce((sum, item) => sum + toNumber(item.innings), 0),
    notOuts: entries.reduce((sum, item) => sum + toNumber(item.notOuts), 0),
    runs: entries.reduce((sum, item) => sum + toNumber(item.runs), 0),
    ballsFaced: entries.reduce((sum, item) => sum + toNumber(item.ballsFaced), 0),
    zeros: entries.reduce((sum, item) => sum + toNumber(item.zeros), 0),
    thirties: entries.reduce((sum, item) => sum + toNumber(item.thirties), 0),
    fifties: entries.reduce((sum, item) => sum + toNumber(item.fifties), 0),
    hundreds: entries.reduce((sum, item) => sum + toNumber(item.hundreds), 0),
    fours: entries.reduce((sum, item) => sum + toNumber(item.fours), 0),
    sixes: entries.reduce((sum, item) => sum + toNumber(item.sixes), 0),
    bestScore: Math.max(...entries.map((item) => toNumber(item.bestScore, 0)))
  };

  const denominator = total.innings - total.notOuts;
  total.average = denominator > 0 ? total.runs / denominator : 0;
  total.strikeRate = total.ballsFaced > 0 ? (total.runs * 100) / total.ballsFaced : 0;

  return total;
}

function aggregateBowlingForPlayer(playerName) {
  const entries = getBowlingEntriesForPlayer(playerName);
  if (!entries.length) {
    return {
      innings: 0,
      wickets: 0,
      runs: 0,
      overs: 0,
      ballBowled: 0,
      average: 0,
      economy: 0,
      strikeRate: 0,
      threeWicketHauls: 0,
      fiveWicketHauls: 0,
      bestFigure: '0/0'
    };
  }

  const total = {
    innings: entries.reduce((sum, item) => sum + toNumber(item.innings), 0),
    wickets: entries.reduce((sum, item) => sum + toNumber(item.wickets), 0),
    runs: entries.reduce((sum, item) => sum + toNumber(item.runs), 0),
    overs: entries.reduce((sum, item) => sum + toNumber(item.overs), 0),
    threeWicketHauls: entries.reduce((sum, item) => sum + toNumber(item.threeWicketHauls), 0),
    fiveWicketHauls: entries.reduce((sum, item) => sum + toNumber(item.fiveWicketHauls), 0),
    bestFigure: '0/0'
  };

  total.ballBowled = convertOversToBalls(total.overs);
  total.average = total.wickets > 0 ? total.runs / total.wickets : 0;
  total.economy = total.overs > 0 ? total.runs / total.overs : 0;
  total.strikeRate = total.ballBowled > 0 ? total.wickets / total.ballBowled : 0;

  const figures = entries
    .map((item) => item.bestFigure || '0/0')
    .filter(Boolean)
    .sort(bestFigureComparator);

  if (figures.length) {
    total.bestFigure = figures[0];
  }

  return total;
}

function updatePlayerDerivedStats(playerName) {
  const player = ensurePlayer(playerName);
  if (!player) return;

  if (FORMATS.some((format) => player.batting[format])) {
    player.batting.all = aggregateBattingForPlayer(playerName);
  }

  if (FORMATS.some((format) => player.bowling[format])) {
    player.bowling.all = aggregateBowlingForPlayer(playerName);
  }

  saveState();
  renderTables();
}

function handleBattingSubmit(event) {
  event.preventDefault();
  const playerName = playerNameInput.value.trim();
  const format = formatSelect.value;

  if (!playerName) {
    alert('Please enter a player name.');
    return;
  }

  const player = ensurePlayer(playerName);
  if (!player) return;

  const serialized = serializeBattingStats(Object.fromEntries(new FormData(battingForm).entries()));
  player.batting[format] = serialized;
  player.batting.all = aggregateBattingForPlayer(playerName);

  saveState();
  renderTables();
  battingForm.reset();
}

function handleBowlingSubmit(event) {
  event.preventDefault();
  const playerName = playerNameInput.value.trim();
  const format = formatSelect.value;

  if (!playerName) {
    alert('Please enter a player name.');
    return;
  }

  const player = ensurePlayer(playerName);
  if (!player) return;

  const serialized = serializeBowlingStats(Object.fromEntries(new FormData(bowlingForm).entries()));
  player.bowling[format] = serialized;
  player.bowling.all = aggregateBowlingForPlayer(playerName);

  saveState();
  renderTables();
  bowlingForm.reset();
}

function renderBattingRows() {
  const playerNames = Object.keys(state.players).sort();
  const rows = [];

  playerNames.forEach((playerName) => {
    const player = state.players[playerName];
    const summary = aggregateBattingForPlayer(playerName);

    rows.push({
      playerName,
      format: 'all',
      data: summary
    });

    FORMATS.forEach((format) => {
      const entry = player.batting[format];
      if (entry) {
        rows.push({
          playerName,
          format,
          data: {
            ...entry,
            average: entry.innings - entry.notOuts > 0 ? entry.runs / (entry.innings - entry.notOuts) : 0,
            strikeRate: entry.ballsFaced > 0 ? (entry.runs * 100) / entry.ballsFaced : 0
          }
        });
      }
    });
  });

  battingTableBody.innerHTML = rows
    .map((row, index) => {
      const isAll = row.format === 'all';
      const label = isAll ? 'All Formats' : FORMAT_LABELS[row.format];
      return `
        <tr>
          <td>${index + 1}</td>
          <td><strong>${row.playerName}</strong> ${isAll ? '<span class="badge">All</span>' : ''}</td>
          <td>${row.data.matches ?? 0}</td>
          <td>${row.data.innings ?? 0}</td>
          <td>${row.data.notOuts ?? 0}</td>
          <td>${row.data.runs ?? 0}</td>
          <td>${row.data.ballsFaced ?? 0}</td>
          <td>${formatNumber(row.data.average || 0, 2)}</td>
          <td>${formatNumber(row.data.strikeRate || 0, 2)}</td>
          <td>${row.data.zeros ?? 0}</td>
          <td>${row.data.thirties ?? 0}</td>
          <td>${row.data.fifties ?? 0}</td>
          <td>${row.data.hundreds ?? 0}</td>
          <td>${row.data.fours ?? 0}</td>
          <td>${row.data.sixes ?? 0}</td>
          <td>${row.data.bestScore ?? 0}</td>
        </tr>
      `;
    })
    .join('');
}

function renderBowlingRows() {
  const playerNames = Object.keys(state.players).sort();
  const rows = [];

  playerNames.forEach((playerName) => {
    const player = state.players[playerName];
    const summary = aggregateBowlingForPlayer(playerName);

    rows.push({
      playerName,
      format: 'all',
      data: summary
    });

    FORMATS.forEach((format) => {
      const entry = player.bowling[format];
      if (entry) {
        const average = entry.wickets > 0 ? entry.runs / entry.wickets : 0;
        const economy = entry.overs > 0 ? entry.runs / entry.overs : 0;
        const ballBowled = convertOversToBalls(entry.overs);
        const strikeRate = ballBowled > 0 ? entry.wickets / ballBowled : 0;
        rows.push({
          playerName,
          format,
          data: { ...entry, average, economy, ballBowled, strikeRate }
        });
      }
    });
  });

  bowlingTableBody.innerHTML = rows
    .map((row, index) => {
      const isAll = row.format === 'all';
      return `
        <tr>
          <td>${index + 1}</td>
          <td><strong>${row.playerName}</strong> ${isAll ? '<span class="badge">All</span>' : ''}</td>
          <td>${row.data.innings ?? 0}</td>
          <td>${row.data.wickets ?? 0}</td>
          <td>${row.data.runs ?? 0}</td>
          <td>${formatOvers(row.data.overs ?? 0)}</td>
          <td>${row.data.ballBowled ?? 0}</td>
          <td>${formatNumber(row.data.average || 0, 2)}</td>
          <td>${formatNumber(row.data.economy || 0, 2)}</td>
          <td>${formatNumber(row.data.strikeRate || 0, 2)}</td>
          <td>${row.data.threeWicketHauls ?? 0}</td>
          <td>${row.data.fiveWicketHauls ?? 0}</td>
          <td>${row.data.bestFigure ?? '0/0'}</td>
        </tr>
      `;
    })
    .join('');
}

function renderTables() {
  renderBattingRows();
  renderBowlingRows();
}

function seedSampleData() {
  const sample = {
    players: {
      'Virat Kohli': {
        batting: {
          t20i: {
            matches: 55,
            innings: 52,
            notOuts: 5,
            runs: 1418,
            ballsFaced: 1014,
            zeros: 6,
            thirties: 10,
            fifties: 8,
            hundreds: 2,
            fours: 122,
            sixes: 52,
            bestScore: 122
          },
          odi: {
            matches: 295,
            innings: 283,
            notOuts: 40,
            runs: 13235,
            ballsFaced: 13848,
            zeros: 45,
            thirties: 104,
            fifties: 77,
            hundreds: 48,
            fours: 1191,
            sixes: 394,
            bestScore: 183
          },
          test: {
            matches: 113,
            innings: 191,
            notOuts: 32,
            runs: 8848,
            ballsFaced: 18216,
            zeros: 31,
            thirties: 28,
            fifties: 29,
            hundreds: 29,
            fours: 932,
            sixes: 28,
            bestScore: 254
          }
        },
        bowling: {
          t20i: {
            innings: 8,
            wickets: 4,
            runs: 119,
            overs: 10.2,
            threeWicketHauls: 0,
            fiveWicketHauls: 0,
            bestFigure: '2/25'
          },
          odi: {
            innings: 12,
            wickets: 4,
            runs: 171,
            overs: 18.5,
            threeWicketHauls: 0,
            fiveWicketHauls: 0,
            bestFigure: '2/34'
          },
          test: {
            innings: 21,
            wickets: 0,
            runs: 0,
            overs: 0,
            threeWicketHauls: 0,
            fiveWicketHauls: 0,
            bestFigure: '0/0'
          }
        }
      },
      'Rohit Sharma': {
        batting: {
          t20i: {
            matches: 159,
            innings: 150,
            notOuts: 15,
            runs: 4231,
            ballsFaced: 2801,
            zeros: 18,
            thirties: 33,
            fifties: 32,
            hundreds: 4,
            fours: 346,
            sixes: 224,
            bestScore: 121
          },
          odi: {
            matches: 262,
            innings: 254,
            notOuts: 31,
            runs: 10844,
            ballsFaced: 11195,
            zeros: 28,
            thirties: 62,
            fifties: 55,
            hundreds: 31,
            fours: 1180,
            sixes: 295,
            bestScore: 264
          },
          test: {
            matches: 45,
            innings: 81,
            notOuts: 9,
            runs: 3037,
            ballsFaced: 5521,
            zeros: 16,
            thirties: 16,
            fifties: 12,
            hundreds: 9,
            fours: 365,
            sixes: 20,
            bestScore: 212
          }
        },
        bowling: {
          t20i: {
            innings: 0,
            wickets: 0,
            runs: 0,
            overs: 0,
            threeWicketHauls: 0,
            fiveWicketHauls: 0,
            bestFigure: '0/0'
          },
          odi: {
            innings: 0,
            wickets: 0,
            runs: 0,
            overs: 0,
            threeWicketHauls: 0,
            fiveWicketHauls: 0,
            bestFigure: '0/0'
          },
          test: {
            innings: 0,
            wickets: 0,
            runs: 0,
            overs: 0,
            threeWicketHauls: 0,
            fiveWicketHauls: 0,
            bestFigure: '0/0'
          }
        }
      }
    }
  };

  state = sample;
  saveState();
  renderTables();
}

battingForm.addEventListener('submit', handleBattingSubmit);
bowlingForm.addEventListener('submit', handleBowlingSubmit);
document.getElementById('seed-data').addEventListener('click', seedSampleData);

document.querySelectorAll('.tab-button').forEach((button) => {
  button.addEventListener('click', () => {
    document.querySelectorAll('.tab-button').forEach((btn) => btn.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach((panel) => panel.classList.remove('active'));
    button.classList.add('active');
    document.getElementById(button.dataset.tab).classList.add('active');
  });
});

renderTables();
