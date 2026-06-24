const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());

/* =======================
   TEAMS
======================= */
const teams = [
  "Manchester City","Arsenal","Real Madrid","Barcelona",
  "PSG","Bayern Munich","Liverpool","Chelsea",
  "Juventus","AC Milan"
];

/* =======================
   STRENGTH ENGINE
======================= */
function strength(team) {
  const seed = team.charCodeAt(0);

  const attack = 60 + (seed % 40);
  const defense = 55 + (seed % 35);
  const form = 50 + (seed % 30);

  const balance = (attack + form - defense) / 3;

  return attack + form + balance;
}

/* =======================
   MATCH GENERATOR
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
   PICK ENGINE
======================= */
function predict(home, away) {

  const s1 = strength(home);
  const s2 = strength(away);

  const total = s1 + s2;

  const p1 = Math.round((s1 / total) * 100);

  const winner = s1 > s2 ? home : away;

  return {
    winner,
    confidence: Math.max(p1, 100 - p1),
    score: `${Math.round(s1/80)}-${Math.round(s2/80)}`,
    over25: (s1 + s2 > 125) ? "OVER" : "UNDER",
    btts: (s1 > 110 && s2 > 110) ? "YES" : "NO"
  };
}

/* =======================
   HOME
======================= */
app.get("/", (req, res) => {
  res.send("KING PREDICTIONS V8 BUSINESS CLEAN ⚽🔥");
});

/* =======================
   FREE (1 MATCH + 1 MARKET ONLY)
======================= */
app.get("/free", (req, res) => {

  const m = generateMatch();
  const p = predict(m.home, m.away);

  const market = Math.random() > 0.5 ? "1X2" : "OVER_2_5";

  let prediction;

  if (market === "1X2") {
    prediction = { type: "1X2", pick: p.winner };
  } else {
    prediction = { type: "OVER_2_5", pick: p.over25 };
  }

  res.json({
    section: "FREE",
    match: `${m.home} vs ${m.away}`,
    prediction,
    confidence: p.confidence
  });
});

/* =======================
   VIP (SECTIONS CLAIRES)
======================= */
app.get("/vip", (req, res) => {

  const match1 = generateMatch();
  const match2 = generateMatch();
  const match3 = generateMatch();

  const p1 = predict(match1.home, match1.away);
  const p2 = predict(match2.home, match2.away);
  const p3 = predict(match3.home, match3.away);

  res.json({
    section: "VIP",

    "1X2": {
      match: `${match1.home} vs ${match1.away}`,
      prediction: {
        type: "1X2",
        pick: p1.winner
      },
      score: p1.score,
      confidence: p1.confidence
    },

    "OVER_2_5": {
      match: `${match2.home} vs ${match2.away}`,
      prediction: {
        type: "OVER_2_5",
        pick: p2.over25
      },
      score: p2.score,
      confidence: p2.confidence
    },

    "BTTS": {
      match: `${match3.home} vs ${match3.away}`,
      prediction: {
        type: "BTTS",
        pick: p3.btts
      },
      score: p3.score,
      confidence: p3.confidence
    }
  });
});

/* =======================
   JACKPOT (7–8 MATCHES)
======================= */
app.get("/jackpot", (req, res) => {

  const list = [];
  const size = 7 + Math.floor(Math.random() * 2);

  for (let i = 0; i < size; i++) {

    const m = generateMatch();
    const p = predict(m.home, m.away);

    list.push({
      match: `${m.home} vs ${m.away}`,
      winner: p.winner,
      score: p.score,
      confidence: p.confidence
    });
  }

  res.json({
    section: "JACKPOT",
    matches: list
  });
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
      score: `${Math.floor(Math.random()*3)}-${Math.floor(Math.random()*3)}`,
      minute: Math.floor(Math.random()*90)
    });
  }

  res.json({
    section: "LIVE",
    matches: live
  });
});

/* =======================
   UI PRO CLEAN (STRUCTURE APP)
======================= */
app.get("/ui", (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
<title>KING PREDICTIONS V8</title>

<style>
body{background:#0f0f0f;color:white;font-family:Arial;text-align:center}
.header{padding:20px;background:#111;color:#00ff88;font-size:22px}
.card{background:#1f1f1f;margin:10px auto;padding:15px;width:85%;border-radius:10px}
button{padding:12px;margin:8px;border:none;border-radius:8px;cursor:pointer}
.free{color:#22c55e}
.vip{color:#facc15}
.jackpot{color:#ff4444}
.live{color:#00aaff}
</style>

</head>

<body>

<div class="header">KING PREDICTIONS V8 BUSINESS CLEAN ⚽🔥</div>

<button onclick="load('/free')" class="free">FREE</button>
<button onclick="load('/vip')" class="vip">VIP</button>
<button onclick="load('/jackpot')" class="jackpot">JACKPOT</button>
<button onclick="load('/live')" class="live">LIVE</button>

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
app.listen(PORT, () => console.log("V8 BUSINESS CLEAN READY ⚽🔥"));
