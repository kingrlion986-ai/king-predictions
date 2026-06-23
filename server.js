const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());

const API_KEY = process.env.API_KEY;

let trackedMatches = [];

/* =======================
   SAFE FETCH (ANTI CRASH)
======================= */
async function safeFetch(url) {
  try {
    const res = await fetch(url, {
      headers: {
        "x-rapidapi-key": API_KEY || "",
        "x-rapidapi-host": "v3.football.api-sports.io"
      }
    });

    return await res.json();
  } catch (e) {
    console.log("FETCH ERROR:", e);
    return { response: [] };
  }
}

/* =======================
   HOME
======================= */
app.get("/", (req, res) => {
  res.send("KING PREDICTIONS AUTO SYSTEM ⚽🔥");
});

/* =======================
   MATCHS (100% SAFE)
======================= */
app.get("/matches", async (req, res) => {
  const data = await safeFetch(
    "https://v3.football.api-sports.io/fixtures?next=20"
  );

  const list = data.response || [];

  let matches = list.map(m => {
    const home = m?.teams?.home?.name || "Unknown";
    const away = m?.teams?.away?.name || "Unknown";

    if (!trackedMatches.find(x => x.home === home && x.away === away)) {
      trackedMatches.push({ home, away, status: "tracked" });
    }

    return {
      home,
      away,
      time: m?.fixture?.date || null
    };
  });

  if (matches.length === 0) {
    matches = [
      { home: "No data", away: "Try later", time: new Date().toISOString() }
    ];
  }

  res.json(matches);
});

/* =======================
   AUTO PREDICTION SAFE
======================= */
function generateStats(name = "") {
  const id = name.charCodeAt(0) || 50;
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
   LIVE SAFE
======================= */
app.get("/live", async (req, res) => {
  const data = await safeFetch(
    "https://v3.football.api-sports.io/fixtures?live=all"
  );

  const result = (data.response || []).map(m => ({
    match: `${m?.teams?.home?.name || "?"} vs ${m?.teams?.away?.name || "?"}`,
    score: `${m?.goals?.home ?? 0}-${m?.goals?.away ?? 0}`,
    minute: m?.fixture?.status?.elapsed ?? 0
  }));

  res.json(result.length ? result : [
    { match: "No live match", score: "0-0", minute: 0 }
  ]);
});

/* =======================
   UI CLEAN + STABLE
======================= */
app.get("/ui", (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
<title>SYSTÈME DE PRÉDICTION AUTOMATIQUE</title>
<style>
body{font-family:Arial;background:#0f0f0f;color:white;text-align:center;margin:0}
.header{background:#111;padding:20px;font-size:22px;color:#00ff88}
.card{background:#1f1f1f;margin:10px auto;padding:15px;width:85%;border-radius:10px}
button{padding:12px 18px;margin:10px;border:0;border-radius:8px;cursor:pointer}
.btn1{background:#3b82f6;color:white}
.btn2{background:#22c55e;color:white}
.btn3{background:#f59e0b;color:white}
</style>
</head>

<body>

<div class="header">SYSTÈME DE PRÉDICTION AUTOMATIQUE</div>

<div class="card">
<h3>🟢 FREE</h3>
<p>1 match recommandé par jour</p>
<p>✔ Victoire conseillée</p>
</div>

<div class="card">
<h3>🟡 VIP 🔒</h3>
<p>✔ Scores exacts</p>
<p>✔ BTTS / Over / HTFT</p>
</div>

<button class="btn1" onclick="loadMatches()">Charger les correspondances</button>
<button class="btn2" onclick="loadPredictions()">Prédictions automatiques</button>
<button class="btn3" onclick="loadLive()">En direct</button>

<div id="data"></div>

<script>
async function loadMatches(){
  const r = await fetch('/matches');
  const d = await r.json();
  document.getElementById('data').innerHTML =
    d.map(m=>\`<div class='card'>\${m.home} vs \${m.away}</div>\`).join('');
}

async function loadPredictions(){
  const r = await fetch('/auto-predict');
  const d = await r.json();
  document.getElementById('data').innerHTML =
    d.map(m=>\`<div class='card'><b>\${m.match}</b><br>\${m.score}<br>\${m.winner}</div>\`).join('');
}

async function loadLive(){
  const r = await fetch('/live');
  const d = await r.json();
  document.getElementById('data').innerHTML =
    d.map(m=>\`<div class='card'>\${m.match}<br>\${m.score} (\${m.minute})</div>\`).join('');
}
</script>

</body>
</html>
  `);
});

/* =======================
   START (RENDER SAFE)
======================= */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("AUTO SYSTEM RUNNING ⚽🔥");
});
