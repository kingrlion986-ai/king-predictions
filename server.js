const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const {
  getMatches
} = require("./services/footballApi");

const {
  analyzeMatch
} = require("./services/predictionEngine");

const {
  rankMatches,
  rankOver25Matches,
  rankBTTSMatches,
  rankScoreMatches
} = require("./services/rankingEngine");

const {
  filterVipMatches
} = require("./services/vipFilterEngine");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 3000;

const HISTORY_FILE = path.join(__dirname, "history.json");

const ANALYSIS_CACHE = new Map();

const ANALYSIS_TTL = 5 * 60 * 1000;

const ANALYSIS_RUNNING = new Map();

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

async function analyzeMatches(matches) {

  const uniqueMatches = [
 ...new Map(
 matches.map(
 m => [m.id,m]
 )
 ).values()
];


  const key =
    matches
      .map(
        m =>
        `${m.homeTeam.id}-${m.awayTeam.id}`
      )
      .join("|");



  const cached =
    ANALYSIS_CACHE.get(key);



  if (
    cached &&
    Date.now() - cached.time
    <
    ANALYSIS_TTL
  ) {

    console.log(
      "⚡ ANALYSIS CACHE"
    );

    return cached.data;

  }





  if (
    ANALYSIS_RUNNING.has(key)
  ) {

    console.log(
      "⏳ ANALYSIS ALREADY RUNNING"
    );

    return ANALYSIS_RUNNING.get(key);

  }



  const promise =
    (async()=>{


      const analyses = [];



      for (const match of uniqueMatches) {

        try {


          const result =
            await analyzeMatch(
              match
            );


          analyses.push(
            result
          );


        } catch(error) {


          console.log(
            "MATCH ANALYSIS ERROR:",
            error.message
          );


        }


      }



      ANALYSIS_CACHE.set(
        key,
        {
          time: Date.now(),
          data: analyses
        }
      );



      return analyses;


    })();





  ANALYSIS_RUNNING.set(
    key,
    promise
  );



  try {

    return await promise;


  } finally {


    ANALYSIS_RUNNING.delete(
      key
    );


  }


}

/* =========================
   SETTINGS LIMITS
========================= */
const SETTINGS = {
  maxFree: 1,
  maxVIP_1X2: 5,
  maxOVER: 6,
  maxBTTS: 5,
  maxSCORE: 3,
};

/* =========================
   FREE (1 MATCH)
========================= */
app.get("/free", async (req, res) => {
  try {
    const matches = await getMatches();

console.log("TOTAL MATCHS:", matches.length);

console.log(
  "STATUTS UNIQUES:",
  [...new Set(matches.map(m => m.status))]
);
    matches.forEach(match => {
  console.log(
    `${match.homeTeam.name} (${match.homeTeam.id}) vs ${match.awayTeam.name} (${match.awayTeam.id})`
  );
});

if (!matches.length) {
  return res.json({
    error: "No future matches"
  });
}

const match = matches[0];
const analysis = await analyzeMatch(match);

console.log(
  "RESULT MATCH:",
  JSON.stringify(analysis.match, null, 2)
);
    res.json({
      match: analysis.match,
      prediction: "1X2",
      pick:
analysis.predictions.winner === "DRAW"
  ? "Double Chance"
  : analysis.predictions.winner,
      confidence: analysis.predictions.winnerConfidence,
      stats: {
        homeStrength: analysis.teamStats.home.strength,
        awayStrength: analysis.teamStats.away.strength
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/* =========================
   VIP PREDICTIONS
========================= */
app.get("/vip/predictions", async (req, res) => {

  console.log("VIP ROUTE CALLED");

  try {
    const analyses = await analyzeMatches(
  await getMatches()
);

const vipMatches = filterVipMatches(analyses);

const predictions = vipMatches.map(result => ({
  match: result.match,
  winner: result.predictions.winner,
  confidence: result.predictions.winnerConfidence,
  btts: result.predictions.btts,
  over25: result.predictions.over25,
  score: result.predictions.correctScore
}));

res.json({
  success: true,
  count: predictions.length,
  data: predictions
});

} catch (error) {
    console.error("VIP PREDICTIONS ERROR:", error);

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

    const analyses = await analyzeMatches(
  await getMatches()
);
    const ranked = rankMatches(analyses);

    const result = ranked
      .slice(0, SETTINGS.maxVIP_1X2)
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
      }));

    res.json(result);

  } catch (err) {

    console.error("VIP 1X2 ERROR:", err);

    res.status(500).json({
      error: "Internal server error"
    });

  }
});

/* =========================
   OVER / UNDER
========================= */
app.get("/vip/over25", async (req, res) => {
  try {
    const analyses = await analyzeMatches(
  await getMatches()
);
const ranked = rankOver25Matches(analyses);

const selected = ranked.slice(
  0,
  SETTINGS.maxOVER
);
    const result = selected.map(a => ({
  match: a.match,
  market: a.predictions.over25,
  confidence: a.predictions.over25Confidence,
  expectedGoals: a.model.expectedGoals,
  homeOver25Rate: a.teamStats.home.over25Rate,
  awayOver25Rate: a.teamStats.away.over25Rate
}));

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/* =========================
   BTTS (YES / NO)
========================= */
app.get("/vip/btts", async (req, res) => {
  try {
    const analyses = await analyzeMatches(
  await getMatches()
);
const ranked = rankBTTSMatches(analyses);

const selected = ranked.slice(
  0,
  SETTINGS.maxBTTS
);

    const result = selected.map(a => ({
  match: a.match,
  pick: a.predictions.btts,
  confidence: a.predictions.bttsConfidence,
  homeBTTSRate: a.teamStats.home.bttsRate,
  awayBTTSRate: a.teamStats.away.bttsRate
}));

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/* =========================
   SCORE EXACT
========================= */
app.get("/vip/score", async (req, res) => {
  try {
    const analyses = await analyzeMatches(
  await getMatches()
);
const ranked = rankScoreMatches(analyses);

const selected = ranked.slice(
  0,
  SETTINGS.maxSCORE
);

    const result = selected.map(a => ({
  match: a.match,
  score: a.predictions.correctScore,

  confidence: Math.round(
    a.model.expectedGoals * 22
  ),

  expectedHomeGoals: a.model?.expectedHomeGoals ?? 0,
  expectedAwayGoals: a.model?.expectedAwayGoals ?? 0
}));

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/* =========================
   UI
========================= */
app.get("/", (req, res) => {
    res.sendFile(__dirname + "/public/index.html");
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

    console.log(
  matches.map(m => ({
    home: m.homeTeam.name,
    away: m.awayTeam.name,
    status: m.status,
    date: m.utcDate
  }))
);

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

app.get("/system", async(req,res)=>{

  res.json({

    status:"KING PREDICTIONS V17 ONLINE",

    cache:
      ANALYSIS_CACHE.size,

    running:
      ANALYSIS_RUNNING.size,

    time:
      new Date().toISOString()

  });


});

app.listen(PORT, "0.0.0.0", () => {
  console.log("KING PREDICTIONS V16 RUNNING ⚽🔥");
});
  
