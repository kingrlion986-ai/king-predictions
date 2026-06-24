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
   STRENGTH ENGINE (REALISTIC)
======================= */
function strength(team) {
  const seed = team.charCodeAt(0);

  const attack = 60 + (seed % 40);
  const defense = 55 + (seed % 35);
  const form = 50 + (seed % 30);

  const stability = (attack + form - defense) / 3;

  return attack + form + stability;
}

/* =======================
   MATCH GENERATOR (CLEAN)
======================= */
function generateMatch() {
  const home = teams[Math.floor(Math.random() * teams.length)];
  let away = teams[Math.floor(Math.random() * teams.length)];

  while (away === home) {
    away = teams[Math.floor(Math.random() * teams.length)];
  }

  return { home, away };
}

/* =======================
   PICK ENGINE (1 MARKET ONLY)
======================= */
function generatePick(home, away) {
  const s1 = strength(home);
  const s2 = strength(away);

  const total = s1 + s2;

  const p1 = Math.round((s1 / total) * 100);
  const p2 = Math.round((s2 / total) * 100);

  const winner = s1 > s2 ? home : away;

  const over25 = (s1 + s2 > 125) ? "OVER" : "UNDER";
  const btts = (s1 > 110 && s2 > 110) ? "YES" : "NO";

  return {
    winner,
    confidence: Math.max(p1, p2),
    score: `${Math.round(s1 / 80)}-${Math.round(s2 / 80)}`,
    over25,
    btts
  };
}

/* =======================
   HOME
======================= */
app.get("/", (req, res) => {
  res.send("KING PREDICTIONS V8 PRO BUSINESS CLEAN ⚽🔥");
});

/* =======================
   FREE (1 MATCH / 1 MARKET)
======================= */
app.get("/free", (req, res) => {
  const m = generateMatch();
  const p = generatePick(m.home, m.away);

  // FREE = 1 seul marché
  const marketType = Math.random() > 0.5 ? "1X2" : "OVER_2_5";

  let prediction;

  if (marketType === "1X2") {
    prediction = {
      type: "1X2",
      pick: p.winner
    };
  } else {
    prediction = {
      type: "OVER_2_5",
      pick: p.over25
    };
  }

  res.json({
    match: `${m.home} vs ${m.away}`,
    prediction,
    confidence: p.confidence
  });
});

/* =======================
   VIP (FIXED 3 MATCHES)
======================= */
app.get("/vip", (req, res) => {

  const results = [];

  const markets = ["1X2", "OVER_2_5", "BTTS"];

  for (let i = 0; i < 3; i++) {

    const m = generateMatch();
    const p = generatePick(m.home, m.away);

    const market = markets[i];

    let pick = "";

    if (market === "1X2") pick = p.winner;
    if (market === "OVER_2_5") pick = p.over25;
    if (market === "BTTS") pick = p.btts;

    results.push({
      match: `${m.home} vs ${m.away}`,
      prediction: {
        type: market,
        pick
      },
      score: p.score,
      confidence: p.confidence
    });
  }

  res.json({
    vip_today: results
  });
});

/* =======================
   JACKPOT (7-8 MATCHES FIXED)
======================= */
app.get("/jackpot", (req, res) => {

  const jackpot = [];

  const size = 7 + Math.floor(Math.random() * 2);

  for (let i = 0; i < size; i++) {

    const m = generateMatch();
    const p = generatePick(m.home, m.away);

    jackpot.push({
      match: `${m.home} vs ${m.away}`,
      winner: p.winner,
      score: p.score,
      confidence: p.confidence
    });
  }

  res.json({ jackpot });
});

/* =======================
   LIVE
======================= */
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

/* =======================
   UI CLEAN
======================= */
app.get("/ui", (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
<title>V8 BUSINESS CLEAN</title>
<style>
body{background:#0f0f0f;color:white;font-family:Arial;text-align:center}
.header{padding:20px;background:#111;color:#00ff88;font-size:22px}
.card{background:#1f1f1f;margin:10px auto;padding:15px;width:85%;border-radius:10px}
button{padding:12px;margin:8px;border:none;border-radius:8px;cursor:pointer}
</style>
</head>
<body>

<div class="header">KING PREDICTIONS V8 BUSINESS CLEAN ⚽🔥</div>

<button onclick="load('/free')">FREE</button>
<button onclick="load('/vip')">VIP</button>
<button onclick="load('/jackpot')">JACKPOT</button>
<button onclick="load('/live')">LIVE</button>

<div id="data"></div>

<script>
async function load(url){
  const r = await fetch(url);
  const d = await r.json();
  document.getElementById('data').innerHTML =
    '<pre>'+JSON.stringify(d,null,2)+'</pre>';
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
app.listen(PORT, () => console.log("V8 BUSINESS CLEAN RUNNING ⚽🔥"));
