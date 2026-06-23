const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");

const API_KEY = "a032b98e63f13e8e40fc0cc461aa2f30";

const app = express();
app.use(cors());

/* =======================
   CACHE MÉMOIRE
======================= */
let trackedMatches = [];

/* =======================
   HOME
======================= */
app.get("/", (req, res) => {
  res.send("KING PREDICTIONS AUTO SYSTEM ⚽🔥");
});

/* =======================
   MATCHS DU JOUR
======================= */
app.get("/matches", async (req, res) => {
  try {
    const today = new Date().toISOString().split("T")[0];

    const response = await fetch(
      `https://v3.football.api-sports.io/fixtures?date=${today}`,
      {
        headers: { "x-apisports-key": API_KEY }
      }
    );

    const data = await response.json();

    const matches = data.response.slice(0, 10).map(m => {
      const home = m.teams.home.name;
      const away = m.teams.away.name;

      const exists = trackedMatches.find(
        x => x.home === home && x.away === away
      );

      if (!exists) {
        trackedMatches.push({
          home,
          away,
          status: "pre-match"
        });
      }

      return { home, away, time: m.fixture.date };
    });

    res.json(matches);

  } catch (err) {
    res.status(500).json({ error: "matches error" });
  }
});

/* =======================
   STATS
======================= */
function generateStats(name) {
  const id = name.charCodeAt(0);
  return {
    attack: 70 + (id % 25),
    defense: 65 + (id % 20)
  };
}

/* =======================
   AUTO PREDICTION
======================= */
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

    let status = "balanced";
    if (p1 > 60) status = `${m.home} strong 🔥`;
    if (p2 > 60) status = `${m.away} strong 🔥`;

    return {
      match: `${m.home} vs ${m.away}`,
      score: `${s1}-${s2}`,
      winner:
        s1 > s2 ? m.home :
        s2 > s1 ? m.away :
        "Draw",
      probabilities: {
        [m.home]: p1,
        draw,
        [m.away]: p2
      },
      status
    };
  });

  res.json(results);
});

/* =======================
   LIVE
======================= */
app.get("/live", async (req, res) => {
  try {
    const response = await fetch(
      `https://v3.football.api-sports.io/fixtures?live=all`,
      {
        headers: { "x-apisports-key": API_KEY }
      }
    );

    const data = await response.json();

    const result = data.response.map(m => {

      const home = m.teams.home.name;
      const away = m.teams.away.name;

      const gh = m.goals.home ?? 0;
      const ga = m.goals.away ?? 0;
      const minute = m.fixture.status.elapsed ?? 0;

      const ph = 80 + gh * 10 + minute * 0.2;
      const pa = 80 + ga * 10 + minute * 0.2;

      const total = ph + pa || 1;

      const pHome = Math.round((ph / total) * 100);
      const pAway = Math.round((pa / total) * 100);

      const projH = Math.round(ph / 90);
      const projA = Math.round(pa / 90);

      return {
        match: `${home} vs ${away}`,
        score: `${gh}-${ga}`,
        minute,
        projected_score: `${projH}-${projA}`,
        winner:
          projH > projA ? home :
          projA > projH ? away :
          "Draw"
      };
    });

    res.json(result);

  } catch (err) {
    res.status(500).json({ error: "live error" });
  }
});

/* =======================
   UI PROPRE
======================= */
app.get("/ui", (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
<title>King Predictions</title>

<style>
body{
  font-family:Arial;
  background:linear-gradient(135deg,#0f172a,#111827);
  color:white;
  text-align:center;
  margin:0;
  padding:20px;
}

h1{color:#facc15;}

.subtitle{color:#cbd5e1;}

.card{
  background:#1f2937;
  padding:18px;
  margin:12px auto;
  border-radius:15px;
  max-width:420px;
}

.free{color:#22c55e;}
.vip{color:#facc15;}

button{
  padding:12px 18px;
  margin:8px;
  border:none;
  border-radius:10px;
  font-weight:bold;
}
</style>

</head>

<body>

<h1>👑 KING PREDICTIONS</h1>
<p class="subtitle">Le Roi des Pronostics Sportifs ⚽🔥</p>

<div class="card">
  <h2 class="free">🟢 FREE</h2>
  <p>1 match par jour</p>
  <p>Victoire conseillée</p>
</div>

<div class="card">
  <h2 class="vip">🟡 VIP 🔒</h2>
  <p>Scores exacts</p>
  <p>HT/FT</p>
  <p>Over/Under</p>
</div>

<button onclick="loadMatches()">Load Matches</button>
<button onclick="loadAuto()">Auto Predictions</button>
<button onclick="loadLive()">Live</button>

<div id="data"></div>

<script>
async function loadMatches(){
  const r = await fetch('/matches');
  const d = await r.json();
  document.getElementById('data').innerHTML =
    d.map(m => `<div class='card'>${m.home} vs ${m.away}</div>`).join('');
}

async function loadAuto(){
  const r = await fetch('/auto-predict');
  const d = await r.json();
  document.getElementById('data').innerHTML =
    d.map(m => `<div class='card'><h3>${m.match}</h3><p>${m.score}</p><p>${m.winner}</p></div>`).join('');
}

async function loadLive(){
  const r = await fetch('/live');
  const d = await r.json();
  document.getElementById('data').innerHTML =
    d.map(m => `<div class='card'><h3>${m.match}</h3><p>${m.score}</p><p>${m.minute} min</p></div>`).join('');
}
</script>

</body>
</html>
  `);
});

/* =======================
   SERVER
======================= */
app.listen(3000, () => {
  console.log("AUTO SYSTEM RUNNING ⚽🔥");
});
