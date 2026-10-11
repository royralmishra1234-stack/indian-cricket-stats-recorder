const path = require('path');
const fs = require('fs');
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const dataDir = path.join(__dirname, 'data');
const dbPath = path.join(dataDir, 'stats.db');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Failed to connect to SQLite database:', err.message);
    process.exit(1);
  }
  console.log('✓ Connected to SQLite database at', dbPath);
});

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

function runSql(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve({ id: this.lastID, changes: this.changes });
    });
  });
}

function getSql(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows || []);
    });
  });
}

function getOneSql(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row || null);
    });
  });
}

async function initDatabase() {
  await runSql(`
    CREATE TABLE IF NOT EXISTS players (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      player_name TEXT NOT NULL UNIQUE,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await runSql(`
    CREATE TABLE IF NOT EXISTS batting_stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      player_id INTEGER NOT NULL,
      format TEXT NOT NULL CHECK(format IN ('t20i', 'odi', 'test')),
      matches INTEGER DEFAULT 0,
      innings INTEGER DEFAULT 0,
      not_outs INTEGER DEFAULT 0,
      runs INTEGER DEFAULT 0,
      balls_faced INTEGER DEFAULT 0,
      zeros INTEGER DEFAULT 0,
      thirties INTEGER DEFAULT 0,
      fifties INTEGER DEFAULT 0,
      hundreds INTEGER DEFAULT 0,
      fours INTEGER DEFAULT 0,
      sixes INTEGER DEFAULT 0,
      best_score INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(player_id, format),
      FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
    )
  `);

  await runSql(`
    CREATE TABLE IF NOT EXISTS bowling_stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      player_id INTEGER NOT NULL,
      format TEXT NOT NULL CHECK(format IN ('t20i', 'odi', 'test')),
      innings INTEGER DEFAULT 0,
      wickets INTEGER DEFAULT 0,
      runs INTEGER DEFAULT 0,
      overs REAL DEFAULT 0,
      three_wicket_hauls INTEGER DEFAULT 0,
      five_wicket_hauls INTEGER DEFAULT 0,
      best_figure TEXT DEFAULT '0/0',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(player_id, format),
      FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
    )
  `);

  console.log('✓ Database schema initialized');
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
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

function convertOversToBalls(overs) {
  const value = Number(overs) || 0;
  if (value < 0) return 0;
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

function calculateBattingStats(battingRecords) {
  const total = battingRecords.reduce(
    (acc, row) => ({
      matches: acc.matches + toNumber(row.matches, 0),
      innings: acc.innings + toNumber(row.innings, 0),
      notOuts: acc.notOuts + toNumber(row.not_outs, 0),
      runs: acc.runs + toNumber(row.runs, 0),
      ballsFaced: acc.ballsFaced + toNumber(row.balls_faced, 0),
      zeros: acc.zeros + toNumber(row.zeros, 0),
      thirties: acc.thirties + toNumber(row.thirties, 0),
      fifties: acc.fifties + toNumber(row.fifties, 0),
      hundreds: acc.hundreds + toNumber(row.hundreds, 0),
      fours: acc.fours + toNumber(row.fours, 0),
      sixes: acc.sixes + toNumber(row.sixes, 0),
      bestScore: Math.max(acc.bestScore, toNumber(row.best_score, 0))
    }),
    {
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
      bestScore: 0
    }
  );

  const denominator = total.innings - total.notOuts;
  total.average = denominator > 0 ? total.runs / denominator : 0;
  total.strikeRate = total.ballsFaced > 0 ? (total.runs * 100) / total.ballsFaced : 0;

  return total;
}

function calculateBowlingStats(bowlingRecords) {
  const total = bowlingRecords.reduce(
    (acc, row) => ({
      innings: acc.innings + toNumber(row.innings, 0),
      wickets: acc.wickets + toNumber(row.wickets, 0),
      runs: acc.runs + toNumber(row.runs, 0),
      overs: acc.overs + toNumber(row.overs, 0),
      threeWicketHauls: acc.threeWicketHauls + toNumber(row.three_wicket_hauls, 0),
      fiveWicketHauls: acc.fiveWicketHauls + toNumber(row.five_wicket_hauls, 0),
      bestFigure: acc.bestFigure
    }),
    {
      innings: 0,
      wickets: 0,
      runs: 0,
      overs: 0,
      threeWicketHauls: 0,
      fiveWicketHauls: 0,
      bestFigure: '0/0'
    }
  );

  let bestWickets = 0;
  let bestRuns = 0;
  for (const row of bowlingRecords) {
    const fig = normalizeFigure(row.best_figure || '0/0');
    if (fig.wickets > bestWickets || (fig.wickets === bestWickets && fig.runs < bestRuns)) {
      bestWickets = fig.wickets;
      bestRuns = fig.runs;
    }
  }
  total.bestFigure = bestWickets > 0 || bestRuns > 0 ? `${bestWickets}/${bestRuns}` : '0/0';

  const ballBowled = convertOversToBalls(total.overs);
  total.ballBowled = ballBowled;
  total.average = total.wickets > 0 ? total.runs / total.wickets : 0;
  total.economy = total.overs > 0 ? total.runs / total.overs : 0;
  total.strikeRate = ballBowled > 0 ? total.wickets / ballBowled : 0;

  return total;
}

const API_PREFIX = '/api';

app.get(`${API_PREFIX}/players`, async (req, res) => {
  try {
    const players = await getSql('SELECT id, player_name FROM players ORDER BY player_name ASC');
    res.json(players);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get(`${API_PREFIX}/player/:playerName`, async (req, res) => {
  try {
    const { playerName } = req.params;
    const player = await getOneSql('SELECT id, player_name FROM players WHERE player_name = ?', [playerName]);
    if (!player) return res.status(404).json({ error: 'Player not found' });

    const battingAll = await getSql('SELECT * FROM batting_stats WHERE player_id = ? ORDER BY format', [player.id]);
    const bowlingAll = await getSql('SELECT * FROM bowling_stats WHERE player_id = ? ORDER BY format', [player.id]);

    res.json({
      player,
      batting: {
        byFormat: battingAll.reduce((acc, row) => {
          acc[row.format] = row;
          return acc;
        }, {}),
        allFormats: calculateBattingStats(battingAll)
      },
      bowling: {
        byFormat: bowlingAll.reduce((acc, row) => {
          acc[row.format] = row;
          return acc;
        }, {}),
        allFormats: calculateBowlingStats(bowlingAll)
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get(`${API_PREFIX}/report/batting`, async (req, res) => {
  try {
    const players = await getSql('SELECT id, player_name FROM players ORDER BY player_name ASC');
    const report = [];

    for (const player of players) {
      const battingRecords = await getSql('SELECT * FROM batting_stats WHERE player_id = ?', [player.id]);
      if (battingRecords.length === 0) continue;

      const allFormats = calculateBattingStats(battingRecords);
      report.push({
        playerName: player.player_name,
        allFormats,
        byFormat: battingRecords.reduce((acc, row) => {
          acc[row.format] = {
            format: row.format,
            matches: row.matches,
            innings: row.innings,
            notOuts: row.not_outs,
            runs: row.runs,
            ballsFaced: row.balls_faced,
            average: row.innings - row.not_outs > 0 ? row.runs / (row.innings - row.not_outs) : 0,
            strikeRate: row.balls_faced > 0 ? (row.runs * 100) / row.balls_faced : 0,
            zeros: row.zeros,
            thirties: row.thirties,
            fifties: row.fifties,
            hundreds: row.hundreds,
            fours: row.fours,
            sixes: row.sixes,
            bestScore: row.best_score
          };
          return acc;
        }, {})
      });
    }

    res.json(report);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get(`${API_PREFIX}/report/bowling`, async (req, res) => {
  try {
    const players = await getSql('SELECT id, player_name FROM players ORDER BY player_name ASC');
    const report = [];

    for (const player of players) {
      const bowlingRecords = await getSql('SELECT * FROM bowling_stats WHERE player_id = ?', [player.id]);
      if (bowlingRecords.length === 0) continue;

      const allFormats = calculateBowlingStats(bowlingRecords);
      report.push({
        playerName: player.player_name,
        allFormats,
        byFormat: bowlingRecords.reduce((acc, row) => {
          const ballBowled = convertOversToBalls(row.overs || 0);
          acc[row.format] = {
            format: row.format,
            innings: row.innings,
            wickets: row.wickets,
            runs: row.runs,
            overs: row.overs,
            ballBowled,
            average: row.wickets > 0 ? row.runs / row.wickets : 0,
            economy: row.overs > 0 ? row.runs / row.overs : 0,
            strikeRate: ballBowled > 0 ? row.wickets / ballBowled : 0,
            threeWicketHauls: row.three_wicket_hauls,
            fiveWicketHauls: row.five_wicket_hauls,
            bestFigure: row.best_figure
          };
          return acc;
        }, {})
      });
    }

    res.json(report);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post(`${API_PREFIX}/batting`, async (req, res) => {
  try {
    const { playerName, format, data } = req.body || {};
    if (!playerName || !format || !data) {
      return res.status(400).json({ error: 'playerName, format, and data are required' });
    }
    if (!['t20i', 'odi', 'test'].includes(format)) {
      return res.status(400).json({ error: 'Invalid format' });
    }

    let player = await getOneSql('SELECT id FROM players WHERE player_name = ?', [playerName]);
    if (!player) {
      await runSql('INSERT INTO players (player_name) VALUES (?)', [playerName]);
      player = await getOneSql('SELECT id FROM players WHERE player_name = ?', [playerName]);
    }

    const sql = `
      INSERT INTO batting_stats (player_id, format, matches, innings, not_outs, runs, balls_faced, zeros, thirties, fifties, hundreds, fours, sixes, best_score, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(player_id, format)
      DO UPDATE SET
        matches = excluded.matches,
        innings = excluded.innings,
        not_outs = excluded.not_outs,
        runs = excluded.runs,
        balls_faced = excluded.balls_faced,
        zeros = excluded.zeros,
        thirties = excluded.thirties,
        fifties = excluded.fifties,
        hundreds = excluded.hundreds,
        fours = excluded.fours,
        sixes = excluded.sixes,
        best_score = excluded.best_score,
        updated_at = CURRENT_TIMESTAMP
    `;

    await runSql(sql, [
      player.id,
      format,
      toNumber(data.matches),
      toNumber(data.innings),
      toNumber(data.notOuts),
      toNumber(data.runs),
      toNumber(data.ballsFaced),
      toNumber(data.zeros),
      toNumber(data.thirties),
      toNumber(data.fifties),
      toNumber(data.hundreds),
      toNumber(data.fours),
      toNumber(data.sixes),
      toNumber(data.bestScore)
    ]);

    res.json({ ok: true, playerId: player.id, format });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post(`${API_PREFIX}/bowling`, async (req, res) => {
  try {
    const { playerName, format, data } = req.body || {};
    if (!playerName || !format || !data) {
      return res.status(400).json({ error: 'playerName, format, and data are required' });
    }
    if (!['t20i', 'odi', 'test'].includes(format)) {
      return res.status(400).json({ error: 'Invalid format' });
    }

    let player = await getOneSql('SELECT id FROM players WHERE player_name = ?', [playerName]);
    if (!player) {
      await runSql('INSERT INTO players (player_name) VALUES (?)', [playerName]);
      player = await getOneSql('SELECT id FROM players WHERE player_name = ?', [playerName]);
    }

    const sql = `
      INSERT INTO bowling_stats (player_id, format, innings, wickets, runs, overs, three_wicket_hauls, five_wicket_hauls, best_figure, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(player_id, format)
      DO UPDATE SET
        innings = excluded.innings,
        wickets = excluded.wickets,
        runs = excluded.runs,
        overs = excluded.overs,
        three_wicket_hauls = excluded.three_wicket_hauls,
        five_wicket_hauls = excluded.five_wicket_hauls,
        best_figure = excluded.best_figure,
        updated_at = CURRENT_TIMESTAMP
    `;

    await runSql(sql, [
      player.id,
      format,
      toNumber(data.innings),
      toNumber(data.wickets),
      toNumber(data.runs),
      toNumber(data.overs),
      toNumber(data.threeWicketHauls),
      toNumber(data.fiveWicketHauls),
      String(data.bestFigure || '0/0')
    ]);

    res.json({ ok: true, playerId: player.id, format });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete(`${API_PREFIX}/player/:playerName`, async (req, res) => {
  try {
    const { playerName } = req.params;
    const player = await getOneSql('SELECT id FROM players WHERE player_name = ?', [playerName]);
    if (!player) return res.status(404).json({ error: 'Player not found' });
    await runSql('DELETE FROM players WHERE id = ?', [player.id]);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

async function startServer() {
  await initDatabase();
  app.listen(PORT, () => {
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`🏏 Indian Cricket Stats Recorder`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`🚀 Server running at http://localhost:${PORT}`);
    console.log(`📊 Database: ${dbPath}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
  });
}

startServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
