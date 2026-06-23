const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");

const API_KEY = process.env.API_KEY;

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
   MATCHS
======================= */
app.get("/matches", async (req, res) => {
  try {
    const response = await fetch(
      "https://v3.football.api-sports.io/fixtures?next=10",
      {
        headers: {
          "x-apisports-key": API_KEY
        }
      }
    );

    const data = await response.json();

    const matches = (data.response || []).map(m => {
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

      return {
        home,
        away,
        time: m.fixture.date
      };
    });

    res.json(matches);

  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "matches error" });
  }
});

/* =======================
   AUTO PRÉDICTION
======================= */
function generateStats(name) {
  const id = name.charCodeAt(0);
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
   LIVE
======================= */
app.get("/live", async (req, res) => {
  try {
    const response = await fetch(
      "https://v3.football.api-sports.io/fixtures?live=all",
      {
        headers: {
          "x-apisports-key": API_KEY
        }
      }
    );

    const data = await response.json();

    const result = (data.response || []).map(m => {
      const home = m.teams.home.name;
      const away = m.teams.away.name;

      const gh = m.goals.home ?? 0;
      const ga = m.goals.away ?? 0;

      const minute = m.fixture.status.elapsed ?? 0;

      return {
        match: `${home} vs ${away}`,
        score: `${gh}-${ga}`,
        minute
      };
    });

    res.json(result);

  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "live error" });
  }
});

/* =======================
   UI
======================= */
app.get("/ui", (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
<title>King Predictions</title>
<style>
body{font-family:Arial;background:#111;color:white;text-align:center;}
.card{background:#222;padding:15px;margin:10px;border-radius:10px;}
button{padding:10px 20px;margin:10px;}
.free{color:#22c55e;}
.vip{color:#facc15;}
</style>
</head>

<body>

<h1>👑 KING PREDICTIONS</h1>

<div class="card">
  <h2 class="free">🟢 FREE</h2>
  <p>1 match recommandé par jour</p>
</div>

<div class="card">
  <h2 class="vip">🟡 VIP 🔒</h2>
  <p>Scores exacts + analyses avancées</p>
</div>

<button onclick="loadMatches()">Matches</button>
<button onclick="loadAuto()">Predictions</button>
<button onclick="loadLive()">Live</button>

<div id="data"></div>

<script>
async function loadMatches(){
  const r = await fetch('/matches');
  const d = await r.json();
  document.getElementById('data').innerHTML =
    d.map(m => "<div class='card'>"+m.home+" vs "+m.away+"</div>").join('');
}

async function loadAuto(){
  const r = await fetch('/auto-predict');
  const d = await r.json();
  document.getElementById('data').innerHTML =
    d.map(m => "<div class='card'><h3>"+m.match+"</h3><p>"+m.score+"</p><p>"+m.winner+"</p></div>").join('');
}

async function loadLive(){
  const r = await fetch('/live');
  const d = await r.json();
  document.getElementById('data').innerHTML =
    d.map(m => "<div class='card'><h3>"+m.match+"</h3><p>"+m.score+"</p><p>"+m.minute+" min</p></div>").join('');
}
</script>

</body>
</html>
  `);
});

/* =======================
   START
======================= */
app.listen(3000, () => {
  console.log("AUTO SYSTEM RUNNING ⚽🔥");
});
