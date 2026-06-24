const express = require("express");
const cors = require("cors");

const { getMatches } = require("./services/footballApi");
const { analyzeMatch } = require("./services/predictionEngine");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

/* =========================
   SETTINGS LIMITS
========================= */
const SETTINGS = {
  maxFree: 1,
  maxVIP_1X2: 3,
  maxOVER: 3,
  maxBTTS: 5,
  maxSCORE: 3,
  maxCOMBI: 5,
  maxJACKPOT: 8
};

/* =========================
   FREE (1 MATCH)
========================= */
app.get("/free", async (req, res) => {
  try {
    const matches = await getMatches();
    if (!matches.length) {
      return res.json({ error: "No matches" });
    }

    const match = matches[0];
    const analysis = await analyzeMatch(match);

    res.json({
      match: analysis.match,
      prediction: "1X2",
      pick: analysis.predictions.winner,
      confidence: analysis.predictions.winnerConfidence,
      stats: {
        homeStrength: analysis.teamStats.home.strength,
        awayStrength: analysis.teamStats.away.strength
      }
    });
  } catch (err) {
    console.log("FREE ERROR:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

/* =========================
   VIP 1X2
========================= */
app.get("/vip/1x2", async (req, res) => {
  try {
    const matches = await getMatches();
    const selected = matches.slice(0, SETTINGS.maxVIP_1X2);

    const analyses = await Promise.all(selected.map(analyzeMatch));

    const result = analyses
      .map(a => ({
        match: a.match,
        pick: a.predictions.winner,
        confidence: a.predictions.winnerConfidence,
        homeStrength: a.teamStats.home.strength,
        awayStrength: a.teamStats.away.strength,
        form: {
          home: `${a.teamStats.home.wins}W-${a.teamStats.home.draws}D-${a.teamStats.home.losses}L`,
          away: `${a.teamStats.away.wins}W-${a.teamStats.away.draws}D-${a.teamStats.away.losses}L`
        }
      }))
      .sort((a, b) => b.confidence - a.confidence);

    res.json(result);
  } catch (err) {
    console.log("VIP 1X2 ERROR:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

/* =========================
   OVER / UNDER
========================= */
app.get("/vip/over25", async (req, res) => {
  try {
    const matches = await getMatches();
    const selected = matches.slice(0, SETTINGS.maxOVER);

    const analyses = await Promise.all(selected.map(analyzeMatch));

    const result = analyses.map(a => ({
      match: a.match,
      market: a.predictions.over25,
      confidence: a.predictions.over25Confidence,
      expectedGoals: a.model.expectedGoals,
      homeOver25Rate: a.teamStats.home.over25Rate,
      awayOver25Rate: a.teamStats.away.over25Rate
    }));

    res.json(result);
  } catch (err) {
    console.log("OVER25 ERROR:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

/* =========================
   BTTS (YES / NO)
========================= */
app.get("/vip/btts", async (req, res) => {
  try {
    const matches = await getMatches();
    const selected = matches.slice(0, SETTINGS.maxBTTS);

    const analyses = await Promise.all(selected.map(analyzeMatch));

    const result = analyses.map(a => ({
      match: a.match,
      pick: a.predictions.btts,
      confidence: a.predictions.bttsConfidence,
      homeBTTSRate: a.teamStats.home.bttsRate,
      awayBTTSRate: a.teamStats.away.bttsRate
    }));

    res.json(result);
  } catch (err) {
    console.log("BTTS ERROR:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

/* =========================
   SCORE EXACT
========================= */
app.get("/vip/score", async (req, res) => {
  try {
    const matches = await getMatches();
    const selected = matches.slice(0, SETTINGS.maxSCORE);

    const analyses = await Promise.all(selected.map(analyzeMatch));

    const result = analyses.map(a => ({
      match: a.match,
      score: a.predictions.correctScore,
      expectedHomeGoals: a.model.expectedHomeGoals,
      expectedAwayGoals: a.model.expectedAwayGoals
    }));

    res.json(result);
  } catch (err) {
    console.log("SCORE ERROR:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

/* =========================
   HT/FT
========================= */
app.get("/vip/htft", async (req, res) => {
  try {
    const matches = await getMatches();
    const selected = matches.slice(0, 3);

    const analyses = await Promise.all(selected.map(analyzeMatch));

    const result = analyses.map(a => ({
      match: a.match,
      pick: a.predictions.htft,
      confidence: a.predictions.htftConfidence
    }));

    res.json(result);
  } catch (err) {
    console.log("HTFT ERROR:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

/* =========================
   COMBI
========================= */
app.get("/vip/combos", async (req, res) => {
  try {
    const matches = await getMatches();
    const selected = matches.slice(0, SETTINGS.maxCOMBI);

    const analyses = await Promise.all(selected.map(analyzeMatch));

    const result = analyses.map(a => ({
      match: a.match,
      pick: `${a.predictions.winner} OR ${a.predictions.over25}`,
      confidence: Math.round(
        (a.predictions.winnerConfidence + a.predictions.over25Confidence) / 2
      )
    }));

    res.json(result);
  } catch (err) {
    console.log("COMBOS ERROR:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

/* =========================
   JACKPOT
========================= */
app.get("/vip/jackpot", async (req, res) => {
  try {
    const matches = await getMatches();
    const selected = matches.slice(0, SETTINGS.maxJACKPOT);

    const analyses = await Promise.all(selected.map(analyzeMatch));

    const result = analyses.map(a => ({
      match: a.match,
      winner: a.predictions.winner,
      btts: a.predictions.btts,
      over25: a.predictions.over25,
      score: a.predictions.correctScore
    }));

    res.json(result);
  } catch (err) {
    console.log("JACKPOT ERROR:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

/* =========================
   LIVE
   (pour l’instant on garde une version simple,
   mais plus réaliste que du full random)
========================= */
app.get("/live", async (req, res) => {
  try {
    const matches = await getMatches();

    const result = matches.slice(0, 3).map(m => ({
      match: `${m.homeTeam.name} vs ${m.awayTeam.name}`,
      status: m.status,
      score: `${m.score?.fullTime?.home ?? 0}-${m.score?.fullTime?.away ?? 0}`,
      utcDate: m.utcDate
    }));

    res.json(result);
  } catch (err) {
    console.log("LIVE ERROR:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

/* =========================
   UI
========================= */
app.get("/ui", (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
<title>KING PREDICTIONS V16</title>
</head>

<body style="background:#0b0f14;color:white;font-family:Arial;text-align:center">

<h1>KING PREDICTIONS V16 ⚽🔥</h1>

<button onclick="load('/free')">FREE</button>
<button onclick="load('/vip/1x2')">1X2</button>
<button onclick="load('/vip/over25')">OVER/UNDER</button>
<button onclick="load('/vip/btts')">BTTS</button>
<button onclick="load('/vip/score')">SCORE</button>
<button onclick="load('/vip/htft')">HT/FT</button>
<button onclick="load('/vip/combos')">COMBI</button>
<button onclick="load('/vip/jackpot')">JACKPOT</button>
<button onclick="load('/live')">LIVE</button>

<pre id="data" style="text-align:left;max-width:900px;margin:20px auto;white-space:pre-wrap;"></pre>

<script>
async function load(url){
  const r = await fetch(url);
  const d = await r.json();
  document.getElementById("data").innerText =
    JSON.stringify(d, null, 2);
}
</script>

</body>
</html>
  `);
});

app.get("/", (req, res) => {
  res.send("KING PREDICTIONS V16 ⚽🔥 SERVER OK");
});

app.listen(PORT, () => {
  console.log("KING PREDICTIONS V16 RUNNING ⚽🔥");
});
