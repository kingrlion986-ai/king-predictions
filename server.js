const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());

// =======================
// TEAMS
// =======================
const teams = [
  "Manchester City","Arsenal","Real Madrid","Barcelona",
  "PSG","Bayern Munich","Liverpool","Chelsea",
  "Juventus","AC Milan"
];

// =======================
// MATCH GENERATOR SAFE
// =======================
function generateMatch() {
  const home = teams[Math.floor(Math.random() * teams.length)];
  let away = teams[Math.floor(Math.random() * teams.length)];

  while (away === home) {
    away = teams[Math.floor(Math.random() * teams.length)];
  }

  return { home, away };
}

// =======================
// STATS SIMPLE
// =======================
function stats(team) {
  const seed = team.charCodeAt(0);

  return {
    attack: 60 + (seed % 30),
    defense: 55 + (seed % 25),
    form: 50 + (seed % 20)
  };
}

// =======================
// HOME
// =======================
app.get("/", (req, res) => {
  res.send("KING PREDICTIONS V4 CLEAN ⚽🔥");
});

// =======================
// MATCHES STABLE
// =======================
app.get("/matches", (req, res) => {
  const list = [];

  for (let i = 0; i < 5; i++) {
    const m = generateMatch();

    list.push({
      home: m.home,
      away: m.away,
      time: new Date(Date.now() + i * 3600000).toISOString()
    });
  }

  res.json(list);
});

// =======================
// FREE PREDICTION
// =======================
app.get("/free", (req, res) => {
  const m = generateMatch();

  const t1 = stats(m.home);
  const t2 = stats(m.away);

  const power1 = t1.attack + t1.form + (100 - t2.defense);
  const power2 = t2.attack + t2.form + (100 - t1.defense);

  const total = power1 + power2;

  const p1 = Math.round((power1 / total) * 100);
  const p2 = Math.round((power2 / total) * 100);

  const s1 = Math.round(power1 / 80);
  const s2 = Math.round(power2 / 80);

  res.json({
    match: `${m.home} vs ${m.away}`,
    score: `${s1}-${s2}`,
    winner: s1 > s2 ? m.home : m.away,
    confidence: Math.max(p1, p2)
  });
});

// =======================
// VIP
// =======================
app.get("/vip", (req, res) => {
  const results = [];

  for (let i = 0; i < 5; i++) {
    const m = generateMatch();

    const t1 = stats(m.home);
    const t2 = stats(m.away);

    const power1 = t1.attack + t1.form + (100 - t2.defense);
    const power2 = t2.attack + t2.form + (100 - t1.defense);

    const total = power1 + power2;

    const p1 = Math.round((power1 / total) * 100);
    const p2 = Math.round((power2 / total) * 100);

    const s1 = Math.round(power1 / 75);
    const s2 = Math.round(power2 / 75);

    results.push({
      match: `${m.home} vs ${m.away}`,
      score: `${s1}-${s2}`,
      winner: s1 > s2 ? m.home : m.away,
      btts: Math.random() > 0.5 ? "YES" : "NO",
      over25: Math.random() > 0.5 ? "YES" : "NO"
    });
  }

  res.json(results);
});

// =======================
// LIVE
// =======================
app.get("/live", (req, res) => {
  const live = [];

  for (let i = 0; i < 3; i++) {
    const m = generateMatch();

    live.push({
      match: `${m.home} vs ${m.away}`,
      score: `${Math.floor(Math.random() * 3)}-${Math.floor(Math.random() * 3)}`,
      minute: Math.floor(Math.random() * 90)
    });
  }

  res.json(live);
});

// =======================
// UI FIXED (PLUS DE PAGE BLANCHE)
// =======================
app.get("/ui", (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
<title>KING PREDICTIONS V4 CLEAN ⚽🔥</title>

<style>
body{
  background:#0f0f0f;
  color:white;
  font-family:Arial;
  text-align:center;
}

button{
  padding:12px;
  margin:6px;
  cursor:pointer;
  border:none;
  border-radius:8px;
}

.card{
  background:#1f1f1f;
  margin:10px auto;
  padding:10px;
  width:85%;
  border-radius:10px;
}
</style>
</head>

<body>

<h1>KING PREDICTIONS V4 CLEAN ⚽🔥</h1>

<button onclick="load('/matches')">MATCHS</button>
<button onclick="load('/free')">FREE</button>
<button onclick="load('/vip')">VIP</button>
<button onclick="load('/live')">LIVE</button>

<div id="data"></div>

<script>
async function load(url){
  try{
    const r = await fetch(url);
    const d = await r.json();

    document.getElementById('data').innerHTML =
      "<pre>" + JSON.stringify(d, null, 2) + "</pre>";
  } catch(e){
    document.getElementById('data').innerHTML =
      "<div class='card'>Erreur API</div>";
  }
}
</script>

</body>
</html>
  `);
});

// =======================
// START SERVER
// =======================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("V4 CLEAN RUNNING ⚽🔥"));
