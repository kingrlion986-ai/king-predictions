const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

/* =======================
   HOME
======================= */
app.get("/", (req, res) => {
  res.send("KING PREDICTIONS V5 CLEAN ⚽🔥");
});

/* =======================
   TEAMS (SAFE FIXES)
======================= */
const teams = [
  "Manchester City","Arsenal","Real Madrid","Barcelona",
  "PSG","Bayern Munich","Liverpool","Chelsea",
  "Juventus","AC Milan"
];

/* =======================
   SAFE MATCH GENERATOR
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
   MATCHES (SAFE)
======================= */
app.get("/matches", (req, res) => {
  const list = [];

  for (let i = 0; i < 5; i++) {
    const { home, away } = generateMatch();

    list.push({
      home,
      away,
      time: new Date(Date.now() + i * 3600000).toISOString()
    });
  }

  res.json(list);
});

/* =======================
   FREE
======================= */
app.get("/free", (req, res) => {
  const { home, away } = generateMatch();

  res.json({
    match: `${home} vs ${away}`,
    prediction: "2-1",
    winner: home,
    confidence: 72
  });
});

/* =======================
   VIP
======================= */
app.get("/vip", (req, res) => {
  const results = [];

  for (let i = 0; i < 5; i++) {
    const { home, away } = generateMatch();

    results.push({
      match: `${home} vs ${away}`,
      score: "2-1",
      winner: home,
      btts: Math.random() > 0.5 ? "YES" : "NO",
      over25: Math.random() > 0.5 ? "YES" : "NO"
    });
  }

  res.json(results);
});

/* =======================
   LIVE
======================= */
app.get("/live", (req, res) => {
  const live = [];

  for (let i = 0; i < 3; i++) {
    const { home, away } = generateMatch();

    live.push({
      match: `${home} vs ${away}`,
      score: "1-0",
      minute: 45
    });
  }

  res.json(live);
});

/* =======================
   UI (FIXED + SAFE)
======================= */
app.get("/ui", (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
<title>KING PREDICTIONS</title>

<style>
body{
  font-family: Arial;
  background:#0f0f0f;
  color:white;
  text-align:center;
}

.header{
  padding:20px;
  font-size:22px;
  color:#00ff88;
}

.card{
  background:#1f1f1f;
  margin:10px auto;
  padding:15px;
  width:80%;
  border-radius:10px;
}

button{
  padding:10px;
  margin:5px;
  border-radius:8px;
  cursor:pointer;
}
</style>
</head>

<body>

<div class="header">
KING PREDICTIONS V5 CLEAN ⚽🔥
</div>

<button onclick="loadMatches()">Matches</button>
<button onclick="loadFree()">Free</button>
<button onclick="loadVip()">VIP</button>
<button onclick="loadLive()">Live</button>

<div id="data"></div>

<script>

async function loadMatches(){
  const r = await fetch('/matches');
  const d = await r.json();

  document.getElementById('data').innerHTML =
    d.map(m => `<div class='card'>${m.home} vs ${m.away}</div>`).join('');
}

async function loadFree(){
  const r = await fetch('/free');
  const d = await r.json();

  document.getElementById('data').innerHTML =
    `<div class='card'>
      <h3>${d.match}</h3>
      <p>${d.prediction}</p>
      <p>${d.winner}</p>
      <p>${d.confidence}%</p>
    </div>`;
}

async function loadVip(){
  const r = await fetch('/vip');
  const d = await r.json();

  document.getElementById('data').innerHTML =
    d.map(m => `<div class='card'>
      ${m.match}<br>
      ${m.score}<br>
      ${m.winner}<br>
      BTTS: ${m.btts}<br>
      Over2.5: ${m.over25}
    </div>`).join('');
}

async function loadLive(){
  const r = await fetch('/live');
  const d = await r.json();

  document.getElementById('data').innerHTML =
    d.map(m => `<div class='card'>
      ${m.match}<br>
      ${m.score}<br>
      ${m.minute} min
    </div>`).join('');
}

</script>

</body>
</html>
  `);
});

/* =======================
   START SAFE
======================= */
app.listen(PORT, () => {
  console.log("KING PREDICTIONS V5 CLEAN RUNNING ⚽🔥");
});
