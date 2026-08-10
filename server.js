const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const {
  getMatches,
  initializeDatabase
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
  filterVipMatches,
  filterVipOver25,
  filterVipBtts
} = require("./services/vipFilterEngine");

const {
  startDailyScheduler
} = require("./services/dailyScheduler");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 3000;

const HISTORY_FILE =
  path.join(__dirname, "history.json");

const ANALYSIS_CACHE = new Map();

const ANALYSIS_TTL =
  15 * 60 * 1000;

const ANALYSIS_RUNNING = new Map();

let DAILY_PREDICTIONS = null;
let DAILY_DATE = null;

let PRELOADED_ANALYSES = null;
let PRELOAD_TIME = 0;

const PRELOAD_TTL =
  15 * 60 * 1000;

let DAILY_BUILD_RUNNING = false;
let DAILY_BUILD_PROMISE = null;

const SETTINGS = {
  maxFree: 1,
  maxVIP_1X2: 5,
  maxOVER: 6,
  maxBTTS: 5,
  maxSCORE: 3
};

let FREE_RUNNING = null;


/* =========================
   SLEEP
========================= */

function sleep(ms) {

  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });

}


/* =========================
   HISTORY
========================= */

function loadHistory() {

  try {

    if (!fs.existsSync(HISTORY_FILE)) {
      return [];
    }

    return JSON.parse(
      fs.readFileSync(
        HISTORY_FILE,
        "utf8"
      )
    );

  } catch (err) {

    console.error(
      "HISTORY LOAD ERROR:",
      err.message
    );

    return [];

  }

}


function saveHistory(data) {

  fs.writeFileSync(
    HISTORY_FILE,
    JSON.stringify(
      data,
      null,
      2
    )
  );

}


/* =========================
   PRELOAD
========================= */

async function getPreloadedAnalyses() {

  if (
    PRELOADED_ANALYSES &&
    Date.now() - PRELOAD_TIME < PRELOAD_TTL
  ) {

    console.log(
      "⚡ PRELOADED ANALYSES:",
      PRELOADED_ANALYSES.length
    );

    return PRELOADED_ANALYSES;

  }


  const matches =
    await getMatches();


  if (
    !matches ||
    matches.length === 0
  ) {

    console.log(
      "⚠️ NO MATCHES AVAILABLE"
    );

    PRELOADED_ANALYSES = [];

    PRELOAD_TIME = Date.now();

    return [];

  }


  /*
     On analyse les 5 meilleurs
     matchs déjà fournis par footballApi.
  */

  const selectedMatches =
    matches.slice(0, 5);


  console.log(
    "🏆 TOP MATCHES SELECTED:",
    selectedMatches.map(
      m =>
        `${m.homeTeam.name} vs ${m.awayTeam.name}`
    )
  );


  console.log(
    "🎯 MATCHES SELECTED FOR AI:",
    selectedMatches.length
  );


  PRELOADED_ANALYSES =
    await analyzeMatches(
      selectedMatches
    );


  PRELOAD_TIME =
    Date.now();


  console.log(
    "✅ PRELOAD ANALYSES:",
    PRELOADED_ANALYSES.length
  );


  return PRELOADED_ANALYSES;

}


/* =========================
   VIP ANALYSES
========================= */

async function getVipAnalyses() {

  const matches =
    await getMatches();


  const selectedMatches =
    matches.slice(0, 5);


  console.log(
    "🏆 VIP MATCHES:",
    selectedMatches.length
  );


  return await analyzeMatches(
    selectedMatches
  );

}


/* =========================
   DAILY PREDICTIONS
========================= */

function getToday() {

  return new Date()
    .toISOString()
    .split("T")[0];

}


async function getDailyPredictions() {

  const today =
    getToday();


  if (DAILY_BUILD_RUNNING) {

    console.log(
      "⏳ DAILY BUILD ALREADY RUNNING"
    );

    return DAILY_BUILD_PROMISE;

  }


  if (
    DAILY_PREDICTIONS &&
    DAILY_DATE === today
  ) {

    console.log(
      "⚡ DAILY CACHE"
    );

    return DAILY_PREDICTIONS;

  }


  console.log(
    "🔄 NEW DAILY PREDICTIONS"
  );


  DAILY_BUILD_RUNNING = true;


  DAILY_BUILD_PROMISE =
    (async () => {

      try {

        const analyses =
          await getPreloadedAnalyses();


        if (
          !analyses ||
          analyses.length === 0
        ) {

          console.log(
            "⚠️ NO PREDICTIONS FOUND"
          );

          return [];

        }


        DAILY_PREDICTIONS =
          analyses;

        DAILY_DATE =
          today;


        console.log(
          "✅ DAILY PREDICTIONS CREATED:",
          analyses.length
        );


        return DAILY_PREDICTIONS;

      } catch (err) {

        console.error(
          "❌ DAILY PREDICTIONS ERROR:",
          err.stack
        );

        return [];

      } finally {

        DAILY_BUILD_RUNNING = false;
        DAILY_BUILD_PROMISE = null;

      }

    })();


  return DAILY_BUILD_PROMISE;

}


/* =========================
   ANALYZE MATCHES
========================= */

async function analyzeMatches(matches) {

  const uniqueMatches = [
    ...new Map(
      matches.map(
        m => [m.id, m]
      )
    ).values()
  ];


  if (
    uniqueMatches.length === 0
  ) {

    return [];

  }


  const key =
    uniqueMatches
      .map(
        m =>
          `${m.homeTeam.id}-${m.awayTeam.id}`
      )
      .join("|");


  const cached =
    ANALYSIS_CACHE.get(key);


  if (
    cached &&
    Date.now() - cached.time <
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
    (async () => {

      const analyses = [];


      for (
        const match of uniqueMatches
      ) {

        try {

          console.log(
            "➡️ Analyse:",
            match.homeTeam.name,
            "vs",
            match.awayTeam.name
          );


          const result =
            await analyzeMatch(
              match
            );


          if (result) {

            analyses.push(
              result
            );

            console.log(
              "✅ Analyse OK:",
              match.homeTeam.name
            );

          }

        } catch (err) {

          console.error(
            "❌ ERREUR SUR:",
            match.homeTeam.name
          );

          console.error(
            err.stack
          );

        }


        await sleep(6000);

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
   FREE
========================= */

app.get(
  "/free",
  async (req, res) => {

    try {

      if (FREE_RUNNING) {

        return res.json(
          await FREE_RUNNING
        );

      }


      FREE_RUNNING =
        (async () => {

          const analyses =
            await getDailyPredictions();


          if (
            !analyses.length
          ) {

            return {
              error:
                "No future matches"
            };

          }


          const analysis =
            analyses[0];


          return {

            match:
              `${analysis.match.homeTeam.name} vs ${analysis.match.awayTeam.name}`,

            prediction:
              "1X2",

            pick:
              analysis.predictions.winner ===
              "DRAW"
                ? "Double Chance"
                : analysis.predictions.winner,

            confidence:
              analysis.predictions.winnerConfidence,

            quality:
              analysis.predictions.quality,

            stats: {

              homeStrength:
                analysis.teamStats.home.strength,

              awayStrength:
                analysis.teamStats.away.strength

            }

          };

        })();


      const result =
        await FREE_RUNNING;


      res.json(
        result
      );

    } catch (err) {

      console.error(
        "FREE ERROR:",
        err
      );

      res.status(500).json({
        error:
          "Internal server error"
      });

    } finally {

      FREE_RUNNING = null;

    }

  }
);


/* =========================
   VIP PREDICTIONS
========================= */

app.get(
  "/vip/predictions",
  async (req, res) => {

    try {

      const analyses =
        await getVipAnalyses();


      const vipMatches =
        filterVipMatches(
          analyses
        );


      const predictions =
        vipMatches
          .slice(
            0,
            SETTINGS.maxVIP_1X2
          )
          .map(result => ({

            match:
              `${result.match.homeTeam.name} vs ${result.match.awayTeam.name}`,

            winner:
              result.predictions.winner,

            confidence:
              result.predictions.winnerConfidence,

            vipScore:
              result.vipScore,

            btts:
              result.predictions.btts,

            over25:
              result.predictions.over25,

            score:
              result.predictions.correctScore

          }));


      console.log(
        "👑 VIP 1X2:",
        predictions.length
      );


      res.json({

        success: true,

        count:
          predictions.length,

        data:
          predictions

      });

    } catch (error) {

      console.error(
        "VIP PREDICTIONS ERROR:",
        error
      );

      res.status(500).json({

        success: false,

        error:
          "VIP prediction error"

      });

    }

  }
);


/* =========================
   VIP 1X2
========================= */

app.get(
  "/vip/1x2",
  async (req, res) => {

    try {

      const analyses =
        await getDailyPredictions();


      /*
         IMPORTANT :
         On utilise maintenant
         le vrai filtre VIP.
      */

      const vipMatches =
        filterVipMatches(
          analyses
        );


      const selected =
        vipMatches.slice(
          0,
          SETTINGS.maxVIP_1X2
        );


      const result =
        selected.map(a => ({

          match:
            `${a.match.homeTeam.name} vs ${a.match.awayTeam.name}`,

          pick:
            a.predictions.winner,

          confidence:
            a.predictions.winnerConfidence,

          vipScore:
            a.vipScore,

          homeStrength:
            a.teamStats.home.strength,

          awayStrength:
            a.teamStats.away.strength,

          form: {

            home:
              `${a.teamStats.home.wins}W-${a.teamStats.home.draws}D-${a.teamStats.home.losses}L`,

            away:
              `${a.teamStats.away.wins}W-${a.teamStats.away.draws}D-${a.teamStats.away.losses}L`

          }

        }));


      console.log(
        "👑 VIP 1X2:",
        result.length
      );


      res.json(
        result
      );

    } catch (err) {

      console.error(
        "VIP 1X2 ERROR:",
        err
      );

      res.status(500).json({

        error:
          "Internal server error"

      });

    }

  }
);


/* =========================
   VIP OVER 2.5
========================= */

app.get(
  "/vip/over25",
  async (req, res) => {

    try {

      const analyses =
        await getDailyPredictions();


      const vipMatches =
        filterVipOver25(
          analyses
        );


      const selected =
        vipMatches.slice(
          0,
          SETTINGS.maxOVER
        );


      const result =
        selected.map(a => ({

          match:
            `${a.match.homeTeam.name} vs ${a.match.awayTeam.name}`,

          market:
            a.predictions.over25,

          confidence:
            a.predictions.over25Confidence,

          vipScore:
            a.vipScore,

          expectedGoals:
            a.model.expectedGoals,

          homeOver25Rate:
            a.teamStats.home.over25Rate,

          awayOver25Rate:
            a.teamStats.away.over25Rate

        }));


      console.log(
        "🔥 VIP OVER25:",
        result.length
      );


      res.json(
        result
      );

    } catch (err) {

      console.error(
        "VIP OVER25 ERROR:",
        err
      );

      res.status(500).json({

        error:
          "Internal server error"

      });

    }

  }
);


/* =========================
   VIP BTTS
========================= */

app.get(
  "/vip/btts",
  async (req, res) => {

    try {

      const analyses =
        await getDailyPredictions();


      const vipMatches =
        filterVipBtts(
          analyses
        );


      const selected =
        vipMatches.slice(
          0,
          SETTINGS.maxBTTS
        );


      const result =
        selected.map(a => ({

          match:
            `${a.match.homeTeam.name} vs ${a.match.awayTeam.name}`,

          pick:
            a.predictions.btts,

          confidence:
            a.predictions.bttsConfidence,

          vipScore:
            a.vipScore,

          homeBTTSRate:
            a.teamStats.home.bttsRate,

          awayBTTSRate:
            a.teamStats.away.bttsRate

        }));


      console.log(
        "🔥 VIP BTTS:",
        result.length
      );


      res.json(
        result
      );

    } catch (err) {

      console.error(
        "VIP BTTS ERROR:",
        err
      );

      res.status(500).json({

        error:
          "Internal server error"

      });

    }

  }
);


/* =========================
   SCORE EXACT
========================= */

app.get(
  "/vip/score",
  async (req, res) => {

    try {

      const analyses =
        await getDailyPredictions();


      const ranked =
        rankScoreMatches(
          analyses
        );


      const selected =
        ranked.slice(
          0,
          SETTINGS.maxSCORE
        );


      const result =
        selected.map(a => ({

          match:
            `${a.match.homeTeam.name} vs ${a.match.awayTeam.name}`,

          score:
            a.predictions.correctScore,

          confidence:
            Math.round(
              a.model.expectedGoals * 22
            ),

          expectedHomeGoals:
            a.model?.expectedHomeGoals ?? 0,

          expectedAwayGoals:
            a.model?.expectedAwayGoals ?? 0

        }));


      res.json(
        result
      );

    } catch (err) {

      console.error(
        "VIP SCORE ERROR:",
        err
      );

      res.status(500).json({

        error:
          "Internal server error"

      });

    }

  }
);


/* =========================
   UI
========================= */

app.get(
  "/",
  (req, res) => {

    res.sendFile(
      path.join(
        __dirname,
        "public/index.html"
      )
    );

  }
);


/* =========================
   ACCURACY
========================= */

app.get(
  "/accuracy",
  async (req, res) => {

    try {

      const history =
        loadHistory();


      if (
        !history.length
      ) {

        return res.json({

          checked: 0,
          correct: 0,
          accuracy: 0

        });

      }


      const matches =
        await getMatches();


      const finishedMatches =
        matches.filter(
          m =>
            m.status ===
            "FINISHED"
        );


      let checked = 0;
      let correct = 0;


      history.forEach(
        entry => {

          entry.predictions.forEach(
            pred => {

              const realMatch =
                finishedMatches.find(
                  m =>
                    `${m.homeTeam.name} vs ${m.awayTeam.name}` ===
                    pred.match
                );


              if (!realMatch)
                return;


              checked++;


              let realWinner =
                "DRAW";


              if (
                realMatch.score.fullTime.home >
                realMatch.score.fullTime.away
              ) {

                realWinner =
                  realMatch.homeTeam.name;

              } else if (
                realMatch.score.fullTime.away >
                realMatch.score.fullTime.home
              ) {

                realWinner =
                  realMatch.awayTeam.name;

              }


              if (
                pred.winner ===
                realWinner
              ) {

                correct++;

              }

            }
          );

        }
      );


      res.json({

        checked,

        correct,

        accuracy:
          checked > 0
            ? Math.round(
                (
                  correct /
                  checked
                ) * 100
              )
            : 0

      });

    } catch (err) {

      console.error(
        "ACCURACY ERROR:",
        err.message
      );

      res.status(500).json({

        error:
          "Internal server error"

      });

    }

  }
);


/* =========================
   HISTORY
========================= */

app.get(
  "/history",
  (req, res) => {

    res.json(
      loadHistory()
    );

  }
);


/* =========================
   RESULTS
========================= */

app.get(
  "/results",
  async (req, res) => {

    try {

      const matches =
        await getMatches();


      const finishedMatches =
        matches.filter(
          m =>
            m.status ===
            "FINISHED"
        );


      const result =
        finishedMatches
          .slice(0, 20)
          .map(m => ({

            match:
              `${m.homeTeam.name} vs ${m.awayTeam.name}`,

            score:
              `${m.score.fullTime.home}-${m.score.fullTime.away}`,

            date:
              m.utcDate

          }));


      res.json(
        result
      );

    } catch (err) {

      console.error(
        "RESULTS ERROR:",
        err.message
      );

      res.status(500).json({

        error:
          "Internal server error"

      });

    }

  }
);


/* =========================
   HEALTH
========================= */

app.get(
  "/health",
  (req, res) => {

    const history =
      loadHistory();


    res.json({

      status: "ok",

      version: "20",

      history:
        history.length,

      timestamp:
        new Date().toISOString()

    });

  }
);


/* =========================
   STATS
========================= */

app.get(
  "/stats",
  (req, res) => {

    const history =
      loadHistory();


    res.json({

      jackpotsSaved:
        history.length,

      lastPrediction:
        history.length > 0
          ? history[
              history.length - 1
            ].date
          : null

    });

  }
);


/* =========================
   DEBUG
========================= */

app.get(
  "/debug",
  async (req, res) => {

    try {

      const matches =
        await getMatches();


      const result =
        matches.map(m => ({

          home:
            m.homeTeam.name,

          homeId:
            m.homeTeam.id,

          away:
            m.awayTeam.name,

          awayId:
            m.awayTeam.id

        }));


      res.json(
        result
      );

    } catch (err) {

      res.status(500).json({

        error:
          err.message

      });

    }

  }
);


/* =========================
   SYSTEM
========================= */

app.get(
  "/system",
  async (req, res) => {

    res.json({

      status:
        "KING PREDICTIONS AI ONLINE",

      cache:
        ANALYSIS_CACHE.size,

      running:
        ANALYSIS_RUNNING.size,

      daily:
        DAILY_PREDICTIONS
          ? DAILY_PREDICTIONS.length
          : 0,

      time:
        new Date().toISOString()

    });

  }
);


/* =========================
   PRELOAD
========================= */

async function preloadPredictions() {

  try {

    console.log(
      "🔄 PRELOADING PREDICTIONS..."
    );


    await getPreloadedAnalyses();


    console.log(
      "✅ PRELOAD FINISHED"
    );

  } catch (err) {

    console.error(
      "❌ PRELOAD ERROR:",
      err.message
    );

  }

}


/* =========================
   SERVER
========================= */

app.listen(
  PORT,
  "0.0.0.0",
  () => {

    console.log(
      "👑 KING PREDICTIONS AI ONLINE"
    );

    console.log(
      "🚀 Server started on port:",
      PORT
    );


    (async () => {

      try {

        console.log(
          "⏳ Initialisation..."
        );


        await initializeDatabase();


        console.log(
          "✅ Database prête"
        );


        await preloadPredictions();


        console.log(
          "✅ Préchargement terminé"
        );


        startDailyScheduler(
          async () => {

            console.log(
              "♻️ RESET DAILY SYSTEM"
            );


            DAILY_PREDICTIONS =
              null;

            DAILY_DATE =
              null;


            PRELOADED_ANALYSES =
              null;

            PRELOAD_TIME =
              0;


            ANALYSIS_CACHE.clear();


            await getDailyPredictions();

          }
        );


      } catch (err) {

        console.error(
          "STARTUP ERROR:",
          err.stack
        );

      }

    })();

  }
);
