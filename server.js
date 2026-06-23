const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());

/* =======================
   TEAMS DATABASE
======================= */
const teams = [
  "Manchester City","Arsenal","Real Madrid","Barcelona",
  "PSG","Bayern Munich","Liverpool","Chelsea",
  "Juventus","AC Milan"
];

/* =======================
   TEAM FORM SYSTEM (SIMULÉ MAIS STABLE)
======================= */
function teamData(name) {
  const seed = name.charCodeAt(0);

  return {
    attack: 65 + (seed % 35),
    defense: 60 + (seed % 30),
    form: 50 + (seed % 50) // forme équipe
  };
}

/* =======================
   HOME
======================= */
app.get("/", (req, res) => {
  res.send("KING PREDICTIONS V3 PRO ⚽🔥");
});

/* =======================
   MATCH GENERATOR
======================= */
function generateMatch() {
  let home = teams[Math.floor(Math.random() * teams.length)];
  let away = teams[Math.floor(Math.random() * teams.length)];

  while (home === away) {
    away = teams[Math.floor(Math.random() * teams.length)];
  }

  return { home, away };
}

/* =======================
   FREE MATCH (1 ONLY)
======================= */
app.get("/free", (req, res) => {
  const { home, away } = generateMatch();

  const t1 = teamData(home);
  const t2 = teamData(away);

  const power1 = t1.attack + t1.form + (100 - t2.defense);
  const power2 = t2.attack + t2.form + (100 - t1.defense);

  const total = power1 + power2;

  const p1 = Math.round((power1 / total) * 100);
  const p2 = Math.round((power2 / total) * 100);

  const score1 = Math.round(power1 / 80);
  const score2 = Math.round(power2 / 80);

  res.json({
    match: `${home} vs ${away}`,
    prediction: `${score1}-${score2}`,
    winner: score1 > score2 ? home : away,
    confidence: Math.max(p1, p2)
  });
});

/* =======================
   VIP MATCHES (MULTI)
======================= */
app.get("/vip", (req, res) => {

  let results = [];

  for (let i = 0; i < 5; i++) {

    const { home, away } = generateMatch();

    const t1 = teamData(home);
    const t2 = teamData(away);

    const power1 = t1.attack + t1.form + (100 - t2.defense);
    const power2 = t2.attack + t2.form + (100 - t1.defense);

    const total = power1 + power2;

    const p1 = Math.round((power1 / total) * 100);
    const p2 = Math.round((power2 / total) * 100);

    const score1 = Math.round(power1 / 75);
    const score2 = Math.round(power2 / 75);

    results.push({
      match: `${home} vs ${away}`,
      score: `${score1}-${score2}`,
      winner: score1 > score2 ? home : away,
      btts: Math.random() > 0.5 ? "YES" : "NO",
      over25: Math.random() > 0.5 ? "YES" : "NO"
    });
  }

  res.json(results);
});

/* =======================
   MATCH LIST (UI BUTTON)
======================= */
app.get("/matches", async (req, res) => {

try {

const fetch = require("node-fetch");

const response = await fetch(
  "https://v3.football.api-sports.io/fixtures?next=10",
  {
    headers: {
      "x-apisports-key": process.env.API_KEY
    }
  }
);

const data = await response.json();

// IMPORTANT : afficher la vraie réponse
res.json({
  api_key_exists: !!process.env.API_KEY,
  results: data.results,
  errors: data.errors,
  response_count: data.response ? data.response.length : 0,
  sample: data.response ? data.response.slice(0, 3) : []
});

} catch (err) {

res.json({
  error: err.message,
  api_key_exists: !!process.env.API_KEY
});

}

});

  res.json(list);
});

/* =======================
   LIVE SIMULATION
======================= */
app.get("/live", (req, res) => {
  let live = [];

  for (let i = 0; i < 3; i++) {
    const { home, away } = generateMatch();

    live.push({
      match: `${home} vs ${away}`,
      score: `${Math.floor(Math.random() * 3)}-${Math.floor(Math.random() * 3)}`,
      minute: Math.floor(Math.random() * 90)
    });
  }

  res.json(live);
});

/* =======================
   UI DASHBOARD V3
======================= */
app.get("/ui", (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
<title>SYSTÈME V3 PRO</title>

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
  font-weight:bold;
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
SYSTÈME DE PRÉDICTION AUTOMATIQUE V3
</div>

<div class="card">
<h3 class="free">🟢 FREE</h3>
<p>1 match du jour + conseil</p>
</div>

<div class="card">
<h3 class="vip">🟡 VIP</h3>
<p>Scores exacts + BTTS + Over 2.5</p>
</div>

<button onclick="loadMatches()">Charger les correspondances</button>
<button onclick="loadFree()">FREE</button>
<button onclick="loadVip()">VIP</button>
<button onclick="loadLive()">En direct</button>

<div id="data"></div>

<script>

async function loadMatches(){
  const r = await fetch('/matches');
  const d = await r.json();
  document.getElementById('data').innerHTML =
    d.map(m=>`<div class='card'>${m.home} vs ${m.away}</div>`).join('');
}

async function loadFree(){
  const r = await fetch('/free');
  const d = await r.json();
  document.getElementById('data').innerHTML =
    `<div class='card'>
      <h3>${d.match}</h3>
      <p>Score: ${d.prediction}</p>
      <p>Winner: ${d.winner}</p>
      <p>Confidence: ${d.confidence}%</p>
    </div>`;
}

async function loadVip(){
  const r = await fetch('/vip');
  const d = await r.json();
  document.getElementById('data').innerHTML =
    d.map(m=>`
      <div class='card'>
        <b>${m.match}</b><br>
        Score: ${m.score}<br>
        Winner: ${m.winner}<br>
        BTTS: ${m.btts}<br>
        Over 2.5: ${m.over25}
      </div>`).join('');
}

async function loadLive(){
  const r = await fetch('/live');
  const d = await r.json();
  document.getElementById('data').innerHTML =
    d.map(m=>`<div class='card'>${m.match}<br>${m.score}<br>${m.minute} min</div>`).join('');
}

</script>

</body>
</html>
  `);
});

/* =======================
   START
======================= */
app.listen(process.env.PORT || 3000, () => {
  console.log("V3 PRO RUNNING ⚽🔥");
});
