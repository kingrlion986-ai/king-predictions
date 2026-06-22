const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");

const API_KEY = "a032b98e63f13e8e40fc0cc461aa2f30";

const app = express();
app.use(cors());

/* =======================
   HOME
======================= */
app.get("/", (req, res) => {
  res.send("KING PREDICTIONS LIVE BET365 STYLE ⚽🔥");
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

    const matches = data.response.slice(0, 10).map(m => ({
      home: m.teams.home.name,
      away: m.teams.away.name,
      time: m.fixture.date
    }));

    res.json(matches);

  } catch (err) {
    res.status(500).json({ error: "matches error" });
  }
});

/* =======================
   PREDICTION PRE-MATCH (FIXE)
======================= */
app.get("/predict", async (req, res) => {

  const team1 = req.query.team1 || "PSG";
  const team2 = req.query.team2 || "OM";

  const id1 = team1.charCodeAt(0);
  const id2 = team2.charCodeAt(0);

  const attack1 = 70 + (id1 % 20);
  const attack2 = 70 + (id2 % 20);

  const defense1 = 60 + (id1 % 25);
  const defense2 = 60 + (id2 % 25);

  const power1 = attack1 + (100 - defense2);
  const power2 = attack2 + (100 - defense1);

  const total = power1 + power2;

  const p1 = Math.round((power1 / total) * 100);
  const p2 = Math.round((power2 / total) * 100);
  const draw = Math.max(8, 100 - (p1 + p2));

  const g1 = Math.round(power1 / 65);
  const g2 = Math.round(power2 / 65);

  const winner =
    g1 > g2 ? team1 :
    g2 > g1 ? team2 :
    "Draw";

  res.json({
    match: `${team1} vs ${team2}`,
    winner,
    probabilities: {
      [team1]: p1,
      draw,
      [team2]: p2
    },
    score_guess: `${g1}-${g2}`,
    btts: g1 > 0 && g2 > 0 ? "Yes" : "No",
    over25: (g1 + g2 > 2) ? "Over 2.5" : "Under 2.5"
  });
});

/* =======================
   LIVE SYSTEM (REAL TIME)
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

      // 🔥 LIVE POWER
      const ph = 80 + gh * 10 + minute * 0.2;
      const pa = 80 + ga * 10 + minute * 0.2;

      const total = ph + pa || 1;

      const pHome = Math.round((ph / total) * 100);
      const pAway = Math.round((pa / total) * 100);

      const xgHome = +(ph / 90).toFixed(2);
      const xgAway = +(pa / 90).toFixed(2);

      const projHome = Math.round(xgHome);
      const projAway = Math.round(xgAway);

      const momentum = pHome - pAway;

      let status = "Balanced";
      if (momentum > 15) status = `${home} dominant 🔥`;
      if (momentum < -15) status = `${away} dominant 🔥`;

      const winner =
        projHome > projAway ? home :
        projAway > projHome ? away :
        "Draw";

      return {
        match: `${home} vs ${away}`,
        score_live: `${gh}-${ga}`,
        minute,

        probabilities: {
          [home]: pHome,
          [away]: pAway
        },

        xG: {
          [home]: xgHome,
          [away]: xgAway
        },

        projected_score: `${projHome}-${projAway}`,
        winner_prediction: winner,
        momentum_status: status
      };
    });

    res.json(result);

  } catch (err) {
    res.status(500).json({ error: "live error" });
  }
});

/* =======================
   SIMPLE UI DASHBOARD
======================= */
app.get("/ui", (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
<title>King Predictions LIVE</title>
<style>
body{font-family:Arial;background:#111;color:white;text-align:center;}
.card{background:#222;padding:20px;margin:20px;border-radius:10px;}
button{padding:10px 20px;margin-top:10px;}
</style>
</head>
<body>

<h1>⚽ KING PREDICTIONS LIVE</h1>

<button onclick="loadLive()">Load Live</button>

<div id="data"></div>

<script>
async function loadLive(){
  const res = await fetch('/live');
  const data = await res.json();

  document.getElementById('data').innerHTML =
    data.map(m => `
      <div class="card">
        <h3>${m.match}</h3>
        <p>Score: ${m.score_live} (min ${m.minute})</p>
        <p>Winner: ${m.winner_prediction}</p>
        <p>Status: ${m.momentum_status}</p>
        <p>Projected: ${m.projected_score}</p>
      </div>
    `).join('');
}
</script>

</body>
</html>
  `);
});

/* =======================
   START SERVER
======================= */
app.listen(3000, () => {
  console.log("KING LIVE SYSTEM RUNNING ⚽🔥");
});
