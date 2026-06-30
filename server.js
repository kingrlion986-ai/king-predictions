const express = require("express");
const cors = require("cors");

const { filterVipMatches } = require("./services/vipFilterEngine");

const fs = require("fs");
const path = require("path");

const { getMatches } = require("./services/footballApi");
const { analyzeMatch } = require("./services/predictionEngine");

const app = express();
app.use(cors());
app.use(express.json());

app.get("/vip/matches", async (req, res) => {
  try {
    const matches = await getMatches();

    const vipMatches = filterVipMatches(matches);

    res.json({
      success: true,
      totalMatches: matches.length,
      vipMatches: vipMatches.length,
      data: vipMatches
    });

  } catch (error) {
    console.log("VIP MATCH ERROR:", error);

    res.status(500).json({
      success: false,
      error: "VIP system error"
    });
  }
});

const PORT = process.env.PORT || 3000;

const HISTORY_FILE = path.join(
  __dirname,
  "history.json"
);

function loadHistory() {
  try {
    if (!fs.existsSync(HISTORY_FILE)) {
      return [];
    }

    return JSON.parse(
      fs.readFileSync(HISTORY_FILE, "utf8")
    );
  } catch (err) {
    return [];
  }
}

function saveHistory(data) {
  fs.writeFileSync(
    HISTORY_FILE,
    JSON.stringify(data, null, 2)
  );
}

/* =========================
   SETTINGS LIMITS
========================= */
const SETTINGS = {
  maxFree: 1,
  maxVIP_1X2: 3,
  maxOVER: 3,
  maxBTTS: 3,
  maxSCORE: 3,
  maxCOMBI: 3,
  maxJACKPOT: 4
};

/* =========================
   FREE (1 MATCH)
========================= */
app.get("/free", async (req, res) => {
  try {
    const matches = await getMatches();

    matches.forEach(match => {
  console.log(
    `${match.homeTeam.name} (${match.homeTeam.id}) vs ${match.awayTeam.name} (${match.awayTeam.id})`
  );
});

const futureMatches = matches.filter(
  m => m.status === "TIMED"
);

if (!futureMatches.length) {
  return res.json({ error: "No future matches" });
}

const match = futureMatches[0];
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
   VIP PREDICTIONS
========================= */
app.get("/vip/predictions", async (req, res) => {
  try {
    const matches = await getMatches();

    const vipMatches = filterVipMatches(matches);

    const predictions = await Promise.all(
      vipMatches.map(async (match) => {
        const result = await analyzeMatch(match);

        return {
          match: result.match,
          winner: result.predictions.winner,
          confidence: result.predictions.winnerConfidence,
          btts: result.predictions.btts,
          over25: result.predictions.over25,
          score: result.predictions.correctScore
        };
      })
    );

    res.json({
      success: true,
      count: predictions.length,
      data: predictions
    });

  } catch (error) {
    console.log("VIP PREDICTIONS ERROR:", error);

    res.status(500).json({
      success: false,
      error: "VIP prediction error"
    });
  }
});

/* =========================
   VIP 1X2
========================= */
app.get("/vip/1x2", async (req, res) => {
  try {
    const matches = await getMatches();

const futureMatches = matches.filter(
  m => m.status === "TIMED"
);

const selected = futureMatches.slice(
  0,
  SETTINGS.maxVIP_1X2
);

const analyses = await Promise.all(
  selected.map(analyzeMatch)
);
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

const futureMatches = matches.filter(
  m => m.status === "TIMED"
);

const selected = futureMatches.slice(
  0,
  SETTINGS.maxVIP_1X2
);

const analyses = await Promise.all(
  selected.map(analyzeMatch)
);

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

const futureMatches = matches.filter(
  m => m.status === "TIMED"
);

const selected = futureMatches.slice(
  0,
  SETTINGS.maxVIP_1X2
);

const analyses = await Promise.all(
  selected.map(analyzeMatch)
);

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

const futureMatches = matches.filter(
  m => m.status === "TIMED"
);

const selected = futureMatches.slice(
  0,
  SETTINGS.maxVIP_1X2
);

const analyses = await Promise.all(
  selected.map(analyzeMatch)
);

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

const futureMatches = matches.filter(
  m => m.status === "TIMED"
);

const selected = futureMatches.slice(
  0,
  SETTINGS.maxVIP_1X2
);

const analyses = await Promise.all(
  selected.map(analyzeMatch)
);

    const result = analyses.map(a => ({
      match: a.match,
      pick: a.predictions?.htft || "N/A",
confidence: a.predictions?.htftConfidence || 60
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

const futureMatches = matches.filter(
  m => m.status === "TIMED"
);

const selected = futureMatches.slice(
  0,
  SETTINGS.maxVIP_1X2
);

const analyses = await Promise.all(
  selected.map(analyzeMatch)
);

    const result = analyses.map(a => ({
      match: a.match,
      pick: `${a.predictions.winner} + ${a.predictions.over25}`,
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

const futureMatches = matches.filter(
  m => m.status === "TIMED"
);

const selected = futureMatches.slice(
  0,
  SETTINGS.maxJACKPOT
);

const analyses = await Promise.all(
  selected.map(analyzeMatch)
);

    const result = analyses.map(a => ({
      match: a.match,
      winner: a.predictions.winner,
      btts: a.predictions.btts,
      over25: a.predictions.over25,
      score: a.predictions.correctScore
    }));

     const history = loadHistory();

const lastEntry = history[history.length - 1];

if (
  !lastEntry ||
  JSON.stringify(lastEntry.predictions) !==
  JSON.stringify(result)
) {
  history.push({
    date: new Date().toISOString(),
    type: "jackpot",
    predictions: result
  });

  saveHistory(history);
}

res.json(result);
  } catch (err) {
    console.log("JACKPOT ERROR:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

/* =========================
   VIP TOP
========================= */
app.get("/vip/top", async (req, res) => {
  try {
    const matches = await getMatches();

    const futureMatches = matches.filter(
      m => m.status === "TIMED"
    );

    const analyses = await Promise.all(
      futureMatches.map(analyzeMatch)
    );

    const topMatches = analyses
      .sort(
        (a, b) =>
          b.predictions.winnerConfidence -
          a.predictions.winnerConfidence
      )
      .slice(0, 10)
      .map(a => ({
        match: a.match,
        prediction: a.predictions.winner,
        confidence: a.predictions.winnerConfidence,
        probabilities: a.predictions.probabilities,
        btts: a.predictions.btts,
        over25: a.predictions.over25,
        score: a.predictions.correctScore
      }));

    res.json(topMatches);

  } catch (err) {
    console.log("VIP TOP ERROR:", err.message);
    res.status(500).json({
      error: "Internal server error"
    });
  }
});

/* =========================
   LIVE
========================= */
app.get("/live", async (req, res) => {
  try {
    const matches = await getMatches();

    const liveMatches = matches.filter(
      m => m.status === "IN_PLAY" ||
           m.status === "TIMED"
    );

    liveMatches.slice(0, 3).forEach(m => {
      console.log(
        `${m.homeTeam.name} vs ${m.awayTeam.name}`,
        "STATUS:",
        m.status,
        "DATE:",
        m.utcDate
      );
    });

    const result = liveMatches.slice(0, 3).map(m => ({
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
<button onclick="load('/vip/top')">TOP</button>
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

/* =========================
   ACCURACY
========================= */
app.get("/accuracy", async (req, res) => {
  try {
    const history = loadHistory();

    if (!history.length) {
      return res.json({
        checked: 0,
        correct: 0,
        accuracy: 0
      });
    }

    const matches = await getMatches();

    const finishedMatches = matches.filter(
      m => m.status === "FINISHED"
    );

    let checked = 0;
    let correct = 0;

    history.forEach(entry => {
      entry.predictions.forEach(pred => {

        const realMatch = finishedMatches.find(
          m =>
            `${m.homeTeam.name} vs ${m.awayTeam.name}` === pred.match
        );

        if (!realMatch) return;

        checked++;

        let realWinner = "DRAW";

        if (
          realMatch.score.fullTime.home >
          realMatch.score.fullTime.away
        ) {
          realWinner = realMatch.homeTeam.name;
        } else if (
          realMatch.score.fullTime.away >
          realMatch.score.fullTime.home
        ) {
          realWinner = realMatch.awayTeam.name;
        }

        if (pred.winner === realWinner) {
          correct++;
        }
      });
    });

    res.json({
      checked,
      correct,
      accuracy:
        checked > 0
          ? Math.round((correct / checked) * 100)
          : 0
    });

  } catch (err) {
    console.log("ACCURACY ERROR:", err.message);

    res.status(500).json({
      error: "Internal server error"
    });
  }
});

/* =========================
   HISTORY
========================= */
app.get("/history", (req, res) => {
  res.json(loadHistory());
});

/* =========================
   RESULTS
========================= */
app.get("/results", async (req, res) => {
  try {
    const matches = await getMatches();

    const finishedMatches = matches.filter(
      m => m.status === "FINISHED"
    );

    const result = finishedMatches.slice(0, 20).map(m => ({
      match: `${m.homeTeam.name} vs ${m.awayTeam.name}`,
      score: `${m.score.fullTime.home}-${m.score.fullTime.away}`,
      date: m.utcDate
    }));

    res.json(result);

  } catch (err) {
    console.log("RESULTS ERROR:", err.message);

    res.status(500).json({
      error: "Internal server error"
    });
  }
});

/* =========================
   HEALTH
========================= */
app.get("/health", (req, res) => {
  const history = loadHistory();

  res.json({
    status: "ok",
    version: "16",
    history: history.length,
    timestamp: new Date().toISOString()
  });
});

/* =========================
   STATS
========================= */
app.get("/stats", (req, res) => {
  const history = loadHistory();

  res.json({
    jackpotsSaved: history.length,
    lastPrediction:
      history.length > 0
        ? history[history.length - 1].date
        : null
  });
});

app.get("/debug", async (req, res) => {
  try {
    const matches = await getMatches();

    const result = matches.map(m => ({
      home: m.homeTeam.name,
      homeId: m.homeTeam.id,
      away: m.awayTeam.name,
      awayId: m.awayTeam.id
    }));

    res.json(result);
  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});

app.listen(PORT, () => {
  console.log("KING PREDICTIONS V16 RUNNING ⚽🔥");
});
