const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());

const API_KEY = process.env.API_KEY;

/* =======================
   HOME
======================= */
app.get("/", (req, res) => {
  res.send("KING PREDICTIONS V4 CLEAN ⚽🔥");
});

/* =======================
   MATCHES (REAL API)
======================= */
app.get("/matches", async (req, res) => {
  try {
    const fetch = require("node-fetch");

    const response = await fetch(
      "https://api.football-data.org/v4/matches",
      {
        headers: {
          "X-Auth-Token": API_KEY
        }
      }
    );

    const data = await response.json();

    if (!data.matches) {
      return res.json([
        {
          home: "Aucune donnée",
          away: "API indisponible",
          time: new Date().toISOString()
        }
      ]);
    }

    const matches = data.matches.slice(0, 10).map(m => ({
      home: m.homeTeam.name,
      away: m.awayTeam.name,
      time: m.utcDate
    }));

    res.json(matches);

  } catch (err) {
    console.log("MATCH ERROR:", err.message);

    res.json([
      {
        home: "API Error",
        away: "Try later",
        time: new Date().toISOString()
      }
    ]);
  }
});

/* =======================
   TEAM STATS SIMPLE AI
======================= */
function stats(name) {
  const seed = (name || "").charCodeAt(0);
  return {
    attack: 60 + (seed % 30),
    defense: 55 + (seed % 25)
  };
}

/* =======================
   FREE (1 MATCH)
======================= */
app.get("/free", async (req, res) => {
  try {
    const fetch = require("node-fetch");

    const response = await fetch(
      "https://api.football-data.org/v4/matches",
      {
        headers: { "X-Auth-Token": API_KEY }
      }
    );

    const data = await response.json();
    const match = data.matches?.[0];

    if (!match) {
      return res.json({
        error: "No match available"
      });
    }

    const home = match.homeTeam.name;
    const away = match.awayTeam.name;

    const t1 = stats(home);
    const t2 = stats(away);

    const p1 = t1.attack + (100 - t2.defense);
    const p2 = t2.attack + (100 - t1.defense);

    const total = p1 + p2 || 1;

    const score1 = Math.round(p1 / 60);
    const score2 = Math.round(p2 / 60);

    res.json({
      match: `${home} vs ${away}`,
      prediction: `${score1}-${score2}`,
      winner: score1 > score2 ? home : away,
      confidence: Math.round((Math.max(p1, p2) / total) * 100)
    });

  } catch (err) {
    res.json({ error: "FREE endpoint error" });
  }
});

/* =======================
   VIP (MULTI MATCHES)
======================= */
app.get("/vip", async (req, res) => {
  try {
    const fetch = require("node-fetch");

    const response = await fetch(
      "https://api.football-data.org/v4/matches",
      {
        headers: { "X-Auth-Token": API_KEY }
      }
    );

    const data = await response.json();

    if (!data.matches) {
      return res.json([]);
    }

    const results = data.matches.slice(0, 5).map(m => {
      const home = m.homeTeam.name;
      const away = m.awayTeam.name;

      const t1 = stats(home);
      const t2 = stats(away);

      const score1 = Math.round((t1.attack + (100 - t2.defense)) / 65);
      const score2 = Math.round((t2.attack + (100 - t1.defense)) / 65);

      return {
        match: `${home} vs ${away}`,
        score: `${score1}-${score2}`,
        winner: score1 > score2 ? home : away,
        btts: Math.random() > 0.5 ? "YES" : "NO",
        over25: Math.random() > 0.5 ? "YES" : "NO"
      };
    });

    res.json(results);

  } catch (err) {
    res.json([]);
  }
});

/* =======================
   LIVE
======================= */
app.get("/live", (req, res) => {
  res.json([
    {
      match: "Live system",
      score: "0-0",
      minute: 0
    }
  ]);
});

/* =======================
   UI (STABLE VERSION)
======================= */
app.get("/ui", (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
<title>V4 CLEAN</title>

<style>
body{
  font-family: Arial;
  background:#0f0f0f;
  color:white;
  text-align:center;
}

.header{
  background:#111;
  padding:20px;
  font-size:22px;
  color:#00ff88;
}

.card{
  background:#1f1f1f;
  margin:10px auto;
  padding:15px;
  width:85%;
  border-radius:10px;
}

button{
  padding:12px;
  margin:8px;
  border:none;
  border-radius:8px;
  cursor:pointer;
}

.free{color:#22c55e}
.vip{color:#facc15}
</style>
</head>

<body>

<div class="header">
KING PREDICTIONS V4 CLEAN ⚽🔥
</div>

<div class="card">
<h3 class="free">FREE</h3>
<p>1 match conseillé</p>
</div>

<div class="card">
<h3 class="vip">VIP</h3>
<p>Scores exacts + BTTS + Over 2.5</p>
</div>

<button onclick="loadMatches()">Matchs</button>
<button onclick="loadFree()">FREE</button>
<button onclick="loadVip()">VIP</button>
<button onclick="loadLive()">LIVE</button>

<div id="data"></div>

<script>

async function loadMatches(){
  const r = await fetch('/matches');
  const d = await r.json();

  document.getElementById('data').innerHTML =
    d.map(m => \`<div class='card'>\${m.home} vs \${m.away}<br>\${m.time}</div>\`).join('');
}

async function loadFree(){
  const r = await fetch('/free');
  const d = await r.json();

  document.getElementById('data').innerHTML =
    \`<div class='card'>
      <h3>\${d.match}</h3>
      <p>\${d.prediction}</p>
      <p>\${d.winner}</p>
      <p>\${d.confidence}%</p>
    </div>\`;
}

async function loadVip(){
  const r = await fetch('/vip');
  const d = await r.json();

  document.getElementById('data').innerHTML =
    d.map(m => \`
      <div class='card'>
        <b>\${m.match}</b><br>
        \${m.score}<br>
        Winner: \${m.winner}<br>
        BTTS: \${m.btts}<br>
        Over2.5: \${m.over25}
      </div>
    \`).join('');
}

async function loadLive(){
  const r = await fetch('/live');
  const d = await r.json();

  document.getElementById('data').innerHTML =
    d.map(m => \`<div class='card'>\${m.match}<br>\${m.score}<br>\${m.minute}</div>\`).join('');
}

</script>

</body>
</html>
  `);
});

/* =======================
   START SERVER
======================= */
app.listen(process.env.PORT || 3000, () => {
  console.log("V4 CLEAN RUNNING ⚽🔥");
});
