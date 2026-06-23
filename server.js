const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());

/* =======================
   DATA (TEAMS FIXES)
======================= */
const teams = [
  "Manchester City", "Arsenal", "Real Madrid",
  "Barcelona", "PSG", "Bayern Munich",
  "Liverpool", "Chelsea", "Juventus", "AC Milan"
];

/* =======================
   STATS ENGINE
======================= */
function stats(team) {
  const seed = team.charCodeAt(0);
  return {
    attack: 70 + (seed % 30),
    defense: 60 + (seed % 25)
  };
}

/* =======================
   HOME
======================= */
app.get("/", (req, res) => {
  res.send("KING PREDICTIONS V2 PRO ⚽🔥");
});

/* =======================
   MATCHS (AUTO GENERATION)
======================= */
app.get("/matches", (req, res) => {
  let matches = [];

  for (let i = 0; i < 6; i++) {
    let home = teams[Math.floor(Math.random() * teams.length)];
    let away = teams[Math.floor(Math.random() * teams.length)];

    while (home === away) {
      away = teams[Math.floor(Math.random() * teams.length)];
    }

    matches.push({
      home,
      away,
      time: new Date(Date.now() + i * 3600000).toISOString()
    });
  }

  res.json(matches);
});

/* =======================
   AUTO PREDICTION ENGINE
======================= */
app.get("/auto-predict", (req, res) => {
  let results = [];

  for (let i = 0; i < 6; i++) {
    let home = teams[Math.floor(Math.random() * teams.length)];
    let away = teams[Math.floor(Math.random() * teams.length)];

    const t1 = stats(home);
    const t2 = stats(away);

    const power1 = t1.attack + (100 - t2.defense);
    const power2 = t2.attack + (100 - t1.defense);

    const total = power1 + power2;

    const p1 = Math.round((power1 / total) * 100);
    const p2 = Math.round((power2 / total) * 100);

    const score1 = Math.round(power1 / 75);
    const score2 = Math.round(power2 / 75);

    let winner =
      score1 > score2 ? home :
      score2 > score1 ? away :
      "Draw";

    results.push({
      match: `${home} vs ${away}`,
      score: `${score1}-${score2}`,
      winner,
      probabilities: {
        home: p1,
        away: p2
      }
    });
  }

  res.json(results);
});

/* =======================
   LIVE SIMULATION
======================= */
app.get("/live", (req, res) => {
  let live = [];

  for (let i = 0; i < 3; i++) {
    let home = teams[Math.floor(Math.random() * teams.length)];
    let away = teams[Math.floor(Math.random() * teams.length)];

    live.push({
      match: `${home} vs ${away}`,
      score: `${Math.floor(Math.random() * 4)}-${Math.floor(Math.random() * 4)}`,
      minute: Math.floor(Math.random() * 90)
    });
  }

  res.json(live);
});

/* =======================
   UI DASHBOARD (PRO)
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

button {
  padding: 12px 18px;
  margin: 10px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
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
</style>
</head>

<body>

<div class="header">
SYSTÈME DE PRÉDICTION AUTOMATIQUE
</div>

<div class="card">
<h3>🟢 FREE</h3>
<p>1 match recommandé</p>
<p>Victoire conseillée</p>
</div>

<div class="card">
<h3>🟡 VIP 🔒</h3>
<p>Scores exacts</p>
<p>HT/FT + BTTS</p>
<p>Coupons multiples</p>
</div>

<button class="btn1" onclick="loadMatches()">Charger les correspondances</button>
<button class="btn2" onclick="loadPred()">Prédictions automatiques</button>
<button class="btn3" onclick="loadLive()">En direct</button>

<div id="data"></div>

<script>
async function loadMatches(){
  const r = await fetch('/matches');
  const d = await r.json();

  document.getElementById('data').innerHTML =
    d.map(m => `<div class='card'>${m.home} vs ${m.away}<br>${m.time}</div>`).join('');
}

async function loadPred(){
  const r = await fetch('/auto-predict');
  const d = await r.json();

  document.getElementById('data').innerHTML =
    d.map(m => `<div class='card'><b>${m.match}</b><br>${m.score}<br>Winner: ${m.winner}</div>`).join('');
}

async function loadLive(){
  const r = await fetch('/live');
  const d = await r.json();

  document.getElementById('data').innerHTML =
    d.map(m => `<div class='card'><b>${m.match}</b><br>${m.score}<br>${m.minute} min</div>`).join('');
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
  console.log("V2 PRO RUNNING ⚽🔥");
});
