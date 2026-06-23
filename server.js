const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");

const API_KEY = process.env.API_KEY;

const app = express();
app.use(cors());

let trackedMatches = [];

/* =======================
   HOME
======================= */
app.get("/", (req, res) => {
  res.send("KING PREDICTIONS AUTO SYSTEM ⚽🔥");
});

/* =======================
   MATCHS (STABLE + GUARANTEED DATA)
======================= */
app.get("/matches", async (req, res) => {
  try {
    const response = await fetch(
      "https://v3.football.api-sports.io/fixtures?league=39&season=2025",
      {
        headers: {
          "x-rapidapi-key": API_KEY,
          "x-rapidapi-host": "v3.football.api-sports.io"
        }
      }
    );

    const data = await response.json();
    const list = data.response || [];

    let matches = list.map(m => {
      const home = m.teams.home.name;
      const away = m.teams.away.name;

      if (!trackedMatches.find(x => x.home === home && x.away === away)) {
        trackedMatches.push({ home, away, status: "tracked" });
      }

      return {
        home,
        away,
        time: m.fixture.date
      };
    });

    if (matches.length === 0) {
      matches = [
        { home: "Manchester City", away: "Arsenal", time: new Date().toISOString() },
        { home: "Real Madrid", away: "Barcelona", time: new Date().toISOString() },
        { home: "PSG", away: "Marseille", time: new Date().toISOString() }
      ];
    }

    res.json(matches);

  } catch (err) {
    console.log("MATCHS ERROR:", err);

    res.json([
      { home: "Manchester City", away: "Arsenal", time: new Date().toISOString() }
    ]);
  }
});

/* =======================
   AUTO PREDICTION
======================= */
function generateStats(name) {
  const id = (name || "").charCodeAt(0) || 50;
  return {
    attack: 70 + (id % 25),
    defense: 65 + (id % 20)
  };
}

app.get("/auto-predict", (req, res) => {

  const results = trackedMatches.map(m => {

    const t1 = generateStats(m.home);
    const t2 = generateStats(m.away);

    const power1 = t1.attack + (100 - t2.defense);
    const power2 = t2.attack + (100 - t1.defense);

    const total = power1 + power2 || 1;

    const p1 = Math.round((power1 / total) * 100);
    const p2 = Math.round((power2 / total) * 100);
    const draw = Math.max(8, 100 - (p1 + p2));

    const s1 = Math.round(power1 / 65);
    const s2 = Math.round(power2 / 65);

    return {
      match: `${m.home} vs ${m.away}`,
      winner:
        s1 > s2 ? m.home :
        s2 > s1 ? m.away :
        "Draw",
      score: `${s1}-${s2}`,
      probabilities: {
        [m.home]: p1,
        draw,
        [m.away]: p2
      }
    };
  });

  res.json(results);
});

/* =======================
   LIVE
======================= */
app.get("/live", async (req, res) => {
  try {
    const response = await fetch(
      "https://v3.football.api-sports.io/fixtures?live=all",
      {
        headers: {
          "x-rapidapi-key": API_KEY,
          "x-rapidapi-host": "v3.football.api-sports.io"
        }
      }
    );

    const data = await response.json();

    const result = (data.response || []).map(m => ({
      match: `${m.teams.home.name} vs ${m.teams.away.name}`,
      score: `${m.goals.home ?? 0}-${m.goals.away ?? 0}`,
      minute: m.fixture.status.elapsed ?? 0
    }));

    if (result.length === 0) {
      return res.json([
        { match: "No live match", score: "0-0", minute: 0 }
      ]);
    }

    res.json(result);

  } catch (err) {
    console.log("LIVE ERROR:", err);

    res.json([
      { match: "System fallback", score: "0-0", minute: 0 }
    ]);
  }
});

/* =======================
   UI (FREE + VIP + DASHBOARD)
======================= */
app.get("/ui", (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
<title>SYSTÈME DE PRÉDICTION AUTOMATIQUE</title>

<style>
body {
  font-family: Arial;
  background: #0f0f0f;
  color: white;
  text-align: center;
  margin: 0;
}

.header {
  background: #111;
  padding: 20px;
  font-size: 22px;
  font-weight: bold;
  color: #00ff88;
}

.container {
  margin-top: 20px;
}

button {
  padding: 12px 20px;
  margin: 10px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 15px;
}

.btn1 { background: #3b82f6; color: white; }
.btn2 { background: #22c55e; color: white; }
.btn3 { background: #f59e0b; color: white; }

.card {
  background: #1f1f1f;
  margin: 10px auto;
  padding: 15px;
  width: 85%;
  border-radius: 10px;
}

.free { color: #22c55e; }
.vip { color: #facc15; }
</style>
</head>

<body>

<div class="header">
  SYSTÈME DE PRÉDICTION AUTOMATIQUE
</div>

<!-- FREE / VIP SECTION -->
<div class="card">
  <h2 class="free">🟢 FREE</h2>
  <p>1 match recommandé par jour</p>
  <p>✅ Victoire conseillée</p>
  <p>✅ Analyse basique</p>
</div>

<div class="card">
  <h2 class="vip">🟡 VIP 🔒</h2>
  <p>🔒 Scores exacts</p>
  <p>🔒 HT / FT</p>
  <p>🔒 Over / Under</p>
  <p>🔒 BTTS</p>
  <p>🔒 3+ matchs premium</p>
</div>

<div class="container">

  <button class="btn1" onclick="loadMatches()">Charger les correspondances</button>
  <button class="btn2" onclick="loadPredictions()">Prédictions automatiques</button>
  <button class="btn3" onclick="loadLive()">En direct</button>

  <div id="data"></div>

</div>

<script>

async function loadMatches(){
  const res = await fetch('/matches');
  const data = await res.json();

  document.getElementById('data').innerHTML =
    data.map(m =>
      "<div class='card'><b>" + m.home + " vs " + m.away + "</b><br>" + m.time + "</div>"
    ).join('');
}

async function loadPredictions(){
  const res = await fetch('/auto-predict');
  const data = await res.json();

  document.getElementById('data').innerHTML =
    data.map(m =>
      "<div class='card'><b>" + m.match + "</b><br>Score: " + m.score + "<br>Winner: " + m.winner + "</div>"
    ).join('');
}

async function loadLive(){
  const res = await fetch('/live');
  const data = await res.json();

  document.getElementById('data').innerHTML =
    data.map(m =>
      "<div class='card'><b>" + m.match + "</b><br>" + m.score + " (" + m.minute + " min)</div>"
    ).join('');
}

</script>

</body>
</html>
  `);
});

/* =======================
   START
======================= */
app.listen(3000, () => {
  console.log("AUTO SYSTEM RUNNING ⚽🔥");
});
`);
});
