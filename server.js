const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());

const teams = [
  "Manchester City","Arsenal","Real Madrid","Barcelona",
  "PSG","Bayern Munich","Liverpool","Chelsea"
];

/* =======================
   HOME
======================= */
app.get("/", (req, res) => {
  res.send("KING PREDICTIONS V2 PRO ⚽🔥");
});

/* =======================
   MATCHS SAFE
======================= */
app.get("/matches", (req, res) => {
  const matches = [];

  for (let i = 0; i < 5; i++) {
    const home = teams[Math.floor(Math.random() * teams.length)];
    let away = teams[Math.floor(Math.random() * teams.length)];

    while (away === home) {
      away = teams[Math.floor(Math.random() * teams.length)];
    }

    matches.push({
      home,
      away,
      time: new Date().toISOString()
    });
  }

  res.json(matches);
});

/* =======================
   PREDICTION SAFE
======================= */
function stats(t) {
  const n = t.charCodeAt(0);
  return {
    a: 60 + (n % 30),
    d: 55 + (n % 25)
  };
}

app.get("/auto-predict", (req, res) => {
  const results = [];

  for (let i = 0; i < 5; i++) {
    const home = teams[Math.floor(Math.random() * teams.length)];
    let away = teams[Math.floor(Math.random() * teams.length)];

    while (away === home) {
      away = teams[Math.floor(Math.random() * teams.length)];
    }

    const h = stats(home);
    const a = stats(away);

    const p1 = h.a + (100 - a.d);
    const p2 = a.a + (100 - h.d);

    const total = p1 + p2;

    const ph = Math.round((p1 / total) * 100);
    const pa = Math.round((p2 / total) * 100);

    const s1 = Math.round(p1 / 70);
    const s2 = Math.round(p2 / 70);

    results.push({
      match: `${home} vs ${away}`,
      score: `${s1}-${s2}`,
      winner: s1 > s2 ? home : away,
      probabilities: { home: ph, away: pa }
    });
  }

  res.json(results);
});

/* =======================
   LIVE SAFE
======================= */
app.get("/live", (req, res) => {
  res.json([
    { match: "Live Match 1", score: "1-0", minute: 45 },
    { match: "Live Match 2", score: "0-0", minute: 30 }
  ]);
});

/* =======================
   UI SAFE (NO CRASH)
======================= */
app.get("/ui", (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
<title>Prediction System</title>
<style>
body{background:#111;color:white;text-align:center;font-family:Arial}
.card{background:#222;margin:10px;padding:10px;border-radius:10px}
button{padding:10px;margin:5px}
</style>
</head>
<body>

<h1>SYSTÈME DE PRÉDICTION AUTOMATIQUE</h1>

<div class="card">
<p>🟢 FREE</p>
<p>1 match conseillé</p>
</div>

<div class="card">
<p>🟡 VIP</p>
<p>Scores exacts + coupons</p>
</div>

<button onclick="loadMatches()">Charger les correspondances</button>
<button onclick="loadPred()">Prédictions automatiques</button>
<button onclick="loadLive()">En direct</button>

<div id="data"></div>

<script>
async function loadMatches(){
  const r = await fetch('/matches');
  const d = await r.json();
  document.getElementById('data').innerHTML =
    d.map(m=>"<div class='card'>"+m.home+" vs "+m.away+"</div>").join('');
}

async function loadPred(){
  const r = await fetch('/auto-predict');
  const d = await r.json();
  document.getElementById('data').innerHTML =
    d.map(m=>"<div class='card'><b>"+m.match+"</b><br>"+m.score+"</div>").join('');
}

async function loadLive(){
  const r = await fetch('/live');
  const d = await r.json();
  document.getElementById('data').innerHTML =
    d.map(m=>"<div class='card'>"+m.match+" "+m.score+"</div>").join('');
}
</script>

</body>
</html>
  `);
});

/* =======================
   START
======================= */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("RUNNING SAFE V2"));
