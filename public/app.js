const API = '/api';
const FORMATS = { t20i: 'T20I', odi: 'ODI', test: 'Test' };

let battingReport = [];
let bowlingReport = [];

const playerNameInput = document.getElementById('player-name');
const formatSelect = document.getElementById('format-select');
const battingForm = document.getElementById('batting-form');
const bowlingForm = document.getElementById('bowling-form');
const toast = document.getElementById('toast');

function showToast(message, isError = false) {
  toast.textContent = message;
  toast.className = 'toast show' + (isError ? ' error' : '');
  setTimeout(() => toast.classList.remove('show'), 3000);
}

function toNumber(val, def = 0) {
  const n = Number(val);
  return Number.isFinite(n) ? n : def;
}

function formatValue(val, digits = 2) {
  const n = Number(val) || 0;
  return Number.isFinite(n) ? n.toFixed(digits) : '0.00';
}

function formatOvers(val) {
  const n = Number(val) || 0;
  return Number.isFinite(n) ? n.toFixed(2).replace(/\.0+$/, '') : '0';
}

function convertOversToBalls(overs) {
  const value = Number(overs) || 0;
  const whole = Math.floor(value);
  const fraction = value - whole;
  const map = { 0.16: 1, 0.33: 2, 0.5: 3, 0.66: 4, 0.83: 5 };
  const key = Object.keys(map).find((k) => Math.abs(Number(k) - fraction) < 0.03);
  return whole * 6 + (key ? map[key] : 0);
}

async function loadReports() {
  try {
    const [batting, bowling] = await Promise.all([
      fetch(`${API}/report/batting`).then((r) => r.json()),
      fetch(`${API}/report/bowling`).then((r) => r.json())
    ]);
    battingReport = batting;
    bowlingReport = bowling;
    renderReports();
  } catch (error) {
    console.error(error);
    showToast('Failed to load reports', true);
  }
}

function renderReports() {
  renderBattingReport();
  renderBowlingReport();
}

function renderBattingReport() {
  const tbody = document.getElementById('batting-report-body');
  const rows = [];

  battingReport.forEach((player) => {
    const allFormats = player.allFormats;
    rows.push({
      playerName: player.playerName,
      format: 'All',
      badge: true,
      data: allFormats
    });

    Object.entries(player.byFormat).forEach(([format, data]) => {
      rows.push({ playerName: player.playerName, format: FORMATS[format], badge: false, data });
    });
  });

  tbody.innerHTML = rows
    .map((row, i) => {
      const d = row.data;
      return `
        <tr>
          <td>${i + 1}</td>
          <td><strong>${row.playerName}</strong>${row.badge ? '<span class="badge">All</span>' : ''}</td>
          <td>${row.format}</td>
          <td>${d.matches ?? 0}</td>
          <td>${d.innings ?? 0}</td>
          <td>${d.notOuts ?? 0}</td>
          <td>${d.runs ?? 0}</td>
          <td>${d.ballsFaced ?? 0}</td>
          <td>${formatValue(d.average || 0, 2)}</td>
          <td>${formatValue(d.strikeRate || 0, 2)}</td>
          <td>${d.zeros ?? 0}</td>
          <td>${d.thirties ?? 0}</td>
          <td>${d.fifties ?? 0}</td>
          <td>${d.hundreds ?? 0}</td>
          <td>${d.fours ?? 0}</td>
          <td>${d.sixes ?? 0}</td>
          <td>${d.bestScore ?? 0}</td>
        </tr>
      `;
    })
    .join('');
}

function renderBowlingReport() {
  const tbody = document.getElementById('bowling-report-body');
  const rows = [];

  bowlingReport.forEach((player) => {
    const allFormats = player.allFormats;
    rows.push({
      playerName: player.playerName,
      format: 'All',
      badge: true,
      data: allFormats
    });

    Object.entries(player.byFormat).forEach(([format, data]) => {
      rows.push({ playerName: player.playerName, format: FORMATS[format], badge: false, data });
    });
  });

  tbody.innerHTML = rows
    .map((row, i) => {
      const d = row.data;
      return `
        <tr>
          <td>${i + 1}</td>
          <td><strong>${row.playerName}</strong>${row.badge ? '<span class="badge">All</span>' : ''}</td>
          <td>${row.format}</td>
          <td>${d.innings ?? 0}</td>
          <td>${d.wickets ?? 0}</td>
          <td>${d.runs ?? 0}</td>
          <td>${formatOvers(d.overs ?? 0)}</td>
          <td>${d.ballBowled ?? 0}</td>
          <td>${formatValue(d.average || 0, 2)}</td>
          <td>${formatValue(d.economy || 0, 2)}</td>
          <td>${formatValue(d.strikeRate || 0, 2)}</td>
          <td>${d.threeWicketHauls ?? 0}</td>
          <td>${d.fiveWicketHauls ?? 0}</td>
          <td>${d.bestFigure ?? '0/0'}</td>
        </tr>
      `;
    })
    .join('');
}

battingForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const playerName = playerNameInput.value.trim();
  const format = formatSelect.value;

  if (!playerName) {
    showToast('Please enter a player name', true);
    return;
  }

  const formData = Object.fromEntries(new FormData(battingForm));
  try {
    await fetch(`${API}/batting`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        playerName,
        format,
        data: {
          matches: toNumber(formData.matches),
          innings: toNumber(formData.innings),
          notOuts: toNumber(formData.notOuts),
          runs: toNumber(formData.runs),
          ballsFaced: toNumber(formData.ballsFaced),
          zeros: toNumber(formData.zeros),
          thirties: toNumber(formData.thirties),
          fifties: toNumber(formData.fifties),
          hundreds: toNumber(formData.hundreds),
          fours: toNumber(formData.fours),
          sixes: toNumber(formData.sixes),
          bestScore: toNumber(formData.bestScore)
        }
      })
    });
    showToast(`✓ ${playerName} batting stats saved (${format.toUpperCase()})`);
    battingForm.reset();
    await loadReports();
  } catch (error) {
    showToast('Error saving batting stats', true);
  }
});

bowlingForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const playerName = playerNameInput.value.trim();
  const format = formatSelect.value;

  if (!playerName) {
    showToast('Please enter a player name', true);
    return;
  }

  const formData = Object.fromEntries(new FormData(bowlingForm));
  try {
    await fetch(`${API}/bowling`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        playerName,
        format,
        data: {
          innings: toNumber(formData.innings),
          wickets: toNumber(formData.wickets),
          runs: toNumber(formData.runs),
          overs: toNumber(formData.overs),
          threeWicketHauls: toNumber(formData.threeWicketHauls),
          fiveWicketHauls: toNumber(formData.fiveWicketHauls),
          bestFigure: String(formData.bestFigure || '0/0')
        }
      })
    });
    showToast(`✓ ${playerName} bowling stats saved (${format.toUpperCase()})`);
    bowlingForm.reset();
    await loadReports();
  } catch (error) {
    showToast('Error saving bowling stats', true);
  }
});

document.querySelectorAll('.nav-tab').forEach((btn) => {
  btn.addEventListener('click', () => {
    const panelId = btn.dataset.panel;
    document.querySelectorAll('.nav-tab').forEach((b) => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(panelId).classList.add('active');
  });
});

document.querySelectorAll('.inline-tab').forEach((btn) => {
  btn.addEventListener('click', () => {
    const tabId = btn.dataset.inlineTab;
    document.querySelectorAll('.inline-tab').forEach((b) => b.classList.remove('active'));
    document.querySelectorAll('.inline-panel').forEach((p) => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(tabId).classList.add('active');
  });
});

document.getElementById('export-csv').addEventListener('click', () => {
  const battingRows = ['Player Name,Format,Matches,Innings,NOs,Runs,Ball Faced,Average,Strike Rate,0s,30s,50s,100s,4s,6s,Best Score'];
  battingReport.forEach((player) => {
    Object.entries(player.byFormat).forEach(([format, data]) => {
      battingRows.push(
        `${player.playerName},${FORMATS[format]},${data.matches},${data.innings},${data.notOuts},${data.runs},${data.ballsFaced},${formatValue(data.average)},${formatValue(data.strikeRate)},${data.zeros},${data.thirties},${data.fifties},${data.hundreds},${data.fours},${data.sixes},${data.bestScore}`
      );
    });
  });

  const csv = battingRows.join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'cricket-stats-batting.csv';
  a.click();
  URL.revokeObjectURL(url);
  showToast('📥 CSV exported successfully');
});

document.getElementById('seed-data').addEventListener('click', async () => {
  const samples = [
    { playerName: 'Virat Kohli', format: 't20i', batting: { matches: 55, innings: 52, notOuts: 5, runs: 1418, ballsFaced: 1014, zeros: 6, thirties: 10, fifties: 8, hundreds: 2, fours: 122, sixes: 52, bestScore: 122 }, bowling: { innings: 8, wickets: 4, runs: 119, overs: 10.2, threeWicketHauls: 0, fiveWicketHauls: 0, bestFigure: '2/25' } },
    { playerName: 'Virat Kohli', format: 'odi', batting: { matches: 295, innings: 283, notOuts: 40, runs: 13235, ballsFaced: 13848, zeros: 45, thirties: 104, fifties: 77, hundreds: 48, fours: 1191, sixes: 394, bestScore: 183 }, bowling: { innings: 12, wickets: 4, runs: 171, overs: 18.5, threeWicketHauls: 0, fiveWicketHauls: 0, bestFigure: '2/34' } },
    { playerName: 'Virat Kohli', format: 'test', batting: { matches: 113, innings: 191, notOuts: 32, runs: 8848, ballsFaced: 18216, zeros: 31, thirties: 28, fifties: 29, hundreds: 29, fours: 932, sixes: 28, bestScore: 254 }, bowling: { innings: 21, wickets: 0, runs: 0, overs: 0, threeWicketHauls: 0, fiveWicketHauls: 0, bestFigure: '0/0' } },
    { playerName: 'Rohit Sharma', format: 't20i', batting: { matches: 159, innings: 150, notOuts: 15, runs: 4231, ballsFaced: 2801, zeros: 18, thirties: 33, fifties: 32, hundreds: 4, fours: 346, sixes: 224, bestScore: 121 }, bowling: { innings: 0, wickets: 0, runs: 0, overs: 0, threeWicketHauls: 0, fiveWicketHauls: 0, bestFigure: '0/0' } },
    { playerName: 'Rohit Sharma', format: 'odi', batting: { matches: 262, innings: 254, notOuts: 31, runs: 10844, ballsFaced: 11195, zeros: 28, thirties: 62, fifties: 55, hundreds: 31, fours: 1180, sixes: 295, bestScore: 264 }, bowling: { innings: 0, wickets: 0, runs: 0, overs: 0, threeWicketHauls: 0, fiveWicketHauls: 0, bestFigure: '0/0' } },
    { playerName: 'Rohit Sharma', format: 'test', batting: { matches: 45, innings: 81, notOuts: 9, runs: 3037, ballsFaced: 5521, zeros: 16, thirties: 16, fifties: 12, hundreds: 9, fours: 365, sixes: 20, bestScore: 212 }, bowling: { innings: 0, wickets: 0, runs: 0, overs: 0, threeWicketHauls: 0, fiveWicketHauls: 0, bestFigure: '0/0' } },
    { playerName: 'Jasprit Bumrah', format: 't20i', batting: { matches: 80, innings: 27, notOuts: 14, runs: 89, ballsFaced: 58, zeros: 12, thirties: 1, fifties: 0, hundreds: 0, fours: 11, sixes: 0, bestScore: 16 }, bowling: { innings: 80, wickets: 106, runs: 2611, overs: 218.1, threeWicketHauls: 1, fiveWicketHauls: 0, bestFigure: '5/27' } },
    { playerName: 'Jasprit Bumrah', format: 'odi', batting: { matches: 76, innings: 34, notOuts: 21, runs: 153, ballsFaced: 154, zeros: 8, thirties: 0, fifties: 0, hundreds: 0, fours: 19, sixes: 0, bestScore: 26 }, bowling: { innings: 76, wickets: 144, runs: 2978, overs: 287.3, threeWicketHauls: 3, fiveWicketHauls: 0, bestFigure: '4/17' } }
  ];

  for (const item of samples) {
    try {
      await Promise.all([
        fetch(`${API}/batting`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ playerName: item.playerName, format: item.format, data: item.batting })
        }),
        fetch(`${API}/bowling`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ playerName: item.playerName, format: item.format, data: item.bowling })
        })
      ]);
    } catch (e) {
      console.error(e);
    }
  }

  showToast('📊 Sample data loaded successfully');
  await loadReports();
});

loadReports();
