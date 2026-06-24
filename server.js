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
   MATCH GENERATOR SAFE
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
   PRO STATS ENGINE
======================= */
function stats(team) {
  const seed = team.charCodeAt(0);

  return {
    attack: 60 + (seed % 40),
    defense: 55 + (seed % 35),
    form: 50 + (seed % 30)
  };
}

/* =======================
   PREDICTION ENGINE
======================= */
function predict(home, away) {

  const t1 = stats(home);
  const t2 = stats(away);

  const power1 = t1.attack + t1.form + (100 - t2.defense);
  const power2 = t2.attack + t2.form + (100 - t1.defense);

  const total = power1 + power2;

  const prob1 = Math.round((power1 / total) * 100);

  const winner = power1 > power2 ? home : away;

  return {
    winner,
    confidence: Math.max(prob1, 100 - prob1),
    score: `${Math.round(power1 / 80)}-${Math.round(power2 / 80)}`,
    over25: (power1 + power2 > 125) ? "OVER" : "UNDER",
    btts: (power1 > 110 && power2 > 110) ? "YES" : "NO"
  };
}

/* =======================
   HOME
======================= */
app.get("/", (req, res) => {
  res.send("KING PREDICTIONS V9 PRO CLEAN ⚽🔥");
});

/* =======================
   FREE (1 MATCH / 1 PICK)
======================= */
app.get("/free", (req, res) => {

  const m = generateMatch();
  const p = predict(m.home, m.away);

  res.json({
    section: "FREE",
    match: `${m.home} vs ${m.away}`,
    prediction: {
      type: "1X2",
      pick: p.winner
    },
    confidence: p.confidence
  });
});

/* =======================
   VIP (PRO STRUCTURE CLEAN)
======================= */
app.get("/vip", (req, res) => {

  const m1 = generateMatch();
  const m2 = generateMatch();
  const m3 = generateMatch();
  const m4 = generateMatch();
  const m5 = generateMatch();

  const p1 = predict(m1.home, m1.away);
  const p2 = predict(m2.home, m2.away);
  const p3 = predict(m3.home, m3.away);
  const p4 = predict(m4.home, m4.away);
  const p5 = predict(m5.home, m5.away);

  res.json({
    section: "VIP",

    "1X2": {
      match: `${m1.home} vs ${m1.away}`,
      prediction: { type: "1X2", pick: p1.winner },
      score: p1.score,
      confidence: p1.confidence
    },

    "OVER_2_5": {
      match: `${m2.home} vs ${m2.away}`,
      prediction: { type: "OVER_2_5", pick: p2.over25 },
      score: p2.score,
      confidence: p2.confidence
    },

    "BTTS": {
      match: `${m3.home} vs ${m3.away}`,
      prediction: { type: "BTTS", pick: p3.btts },
      score: p3.score,
      confidence: p3.confidence
    },

    "SCORE_EXACT": {
      match: `${m4.home} vs ${m4.away}`,
      prediction: { type: "SCORE_EXACT", pick: p4.score },
      confidence: p4.confidence
    },

    "HT_FT": {
      match: `${m5.home} vs ${m5.away}`,
      prediction: {
        type: "HT_FT",
        pick: `${m5.home}/${m5.home}`
      },
      confidence: p5.confidence
    },

    "COMBINED": {
      type: "COMBO_3",
      matches: [
        { match: `${m1.home} vs ${m1.away}`, pick: p1.winner },
        { match: `${m2.home} vs ${m2.away}`, pick: p2.over25 },
        { match: `${m3.home} vs ${m3.away}`, pick: p3.btts }
      ],
      confidence: Math.round((p1.confidence + p2.confidence + p3.confidence) / 3)
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
   UI CLEAN PRO
======================= */
app.get("/ui", (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
<title>KING V9 PRO</title>

<style>
body{background:#0f0f0f;color:white;font-family:Arial;text-align:center}
.header{padding:20px;background:#111;color:#00ff88;font-size:22px}
button{padding:10px;margin:5px;border-radius:8px;border:none;cursor:pointer}
pre{background:#1f1f1f;padding:10px;border-radius:10px;width:90%;margin:auto}
</style>
</head>

<body>

<div class="header">KING PREDICTIONS V9 PRO CLEAN ⚽🔥</div>

<button onclick="load('/free')">FREE</button>
<button onclick="load('/vip')">VIP</button>
<button onclick="load('/jackpot')">JACKPOT</button>
<button onclick="load('/live')">LIVE</button>

<pre id="data"></pre>

<script>
async function load(url){
  const r = await fetch(url);
  const d = await r.json();
  document.getElementById('data').innerText = JSON.stringify(d,null,2);
}
</script>

</body>
</html>
  `);
});

/* =======================
   START SAFE
======================= */
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("V9 PRO CLEAN RUNNING ⚽🔥");
});
