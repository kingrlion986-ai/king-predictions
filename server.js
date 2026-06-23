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
   SAFE MATCH LOADER
======================= */
app.get("/matches", async (req, res) => {
  try {

    if (!API_KEY) {
      return res.json([
        { home: "API KEY MANQUANTE", away: "Configure Render", time: new Date().toISOString() }
      ]);
    }

    const response = await fetch(
      "https://v3.football.api-sports.io/fixtures?next=10",
      {
        headers: {
          "x-rapidapi-key": API_KEY,
          "x-rapidapi-host": "v3.football.api-sports.io"
        }
      }
    );

    const data = await response.json();

    if (data.errors) {
      return res.json([
        {
          home: "API ERROR",
          away: "Vérifie ta clé API",
          time: new Date().toISOString()
        }
      ]);
    }

    const list = data.response || [];

    trackedMatches = list.map(m => ({
      home: m.teams.home.name,
      away: m.teams.away.name,
      time: m.fixture.date
    }));

    if (trackedMatches.length === 0) {
      trackedMatches = [
        { home: "Man City", away: "Arsenal", time: new Date().toISOString() },
        { home: "Real Madrid", away: "Barcelona", time: new Date().toISOString() }
      ];
    }

    res.json(trackedMatches);

  } catch (err) {
    console.log("MATCH ERROR:", err);

    res.json([
      { home: "SERVER ERROR", away: "Try later", time: new Date().toISOString() }
    ]);
  }
});

/* =======================
   PREDICTION ENGINE
======================= */
function stats(name) {
  const id = (name || "").charCodeAt(0) || 50;

  return {
    attack: 70 + (id % 25),
    defense: 65 + (id % 20)
  };
}

app.get("/auto-predict", (req, res) => {

  if (!trackedMatches.length) {
    return res.json([
      { match: "No data", score: "0-0", winner: "N/A" }
    ]);
  }

  const results = trackedMatches.map(m => {

    const t1 = stats(m.home);
    const t2 = stats(m.away);

    const p1 = t1.attack + (100 - t2.defense);
    const p2 = t2.attack + (100 - t1.defense);

    const total = p1 + p2 || 1;

    const homeP = Math.round((p1 / total) * 100);
    const awayP = Math.round((p2 / total) * 100);

    const s1 = Math.round(p1 / 70);
    const s2 = Math.round(p2 / 70);

    return {
      match: `${m.home} vs ${m.away}`,
      score: `${s1}-${s2}`,
      winner: s1 > s2 ? m.home : s2 > s1 ? m.away : "Draw",
      probabilities: {
        home: homeP,
        away: awayP
      }
    };
  });

  res.json(results);
});

/* =======================
   LIVE MATCHES
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

    res.json(result.length ? result : [
      { match: "No live match", score: "0-0", minute: 0 }
    ]);

  } catch (err) {
    console.log("LIVE ERROR:", err);

    res.json([
      { match: "System fallback", score: "0-0", minute: 0 }
    ]);
  }
});

/* =======================
   UI FIXED
======================= */
app.get("/ui", (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
<title>SYSTÈME DE PRÉDICTION AUTOMATIQUE</title>
<style>
body{font-family:Arial;background:#0f0f0f;color:white;text-align:center;}
.header{padding:20px;font-size:22px;color:#00ff88;}
.card{background:#1f1f1f;margin:10px auto;padding:15px;width:85%;border-radius:10px;}
button{padding:12px 18px;margin:10px;border:none;border-radius:8px;cursor:pointer;}
.free{color:#22c55e;}
.vip{color:#facc15;}
</style>
</head>

<body>

<div class="header">SYSTÈME DE PRÉDICTION AUTOMATIQUE</div>

<div class="card">
<h2 class="free">FREE</h2>
<p>Match + prédiction simple</p>
</div>

<div class="card">
<h2 class="vip">VIP</h2>
<p>Scores exacts + analyse avancée</p>
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
 d.map(m => `<div class='card'>${m.home} vs ${m.away}</div>`).join('');
}

async function loadPred(){
 const r = await fetch('/auto-predict');
 const d = await r.json();
 document.getElementById('data').innerHTML =
 d.map(m => `<div class='card'><b>${m.match}</b><br>${m.score}<br>${m.winner}</div>`).join('');
}

async function loadLive(){
 const r = await fetch('/live');
 const d = await r.json();
 document.getElementById('data').innerHTML =
 d.map(m => `<div class='card'>${m.match}<br>${m.score} (${m.minute} min)</div>`).join('');
}

</script>

</body>
</html>
  `);
});

/* =======================
   START
======================= */
app.listen(3000, () => console.log("AUTO SYSTEM RUNNING ⚽🔥"));
