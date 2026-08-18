const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const {
  getMatches,
  initializeDatabase
} = require("./services/footballApi");

const { analyzeMatch } =
  require("./services/predictionEngine");

const {
  filterVipMatches,
  filterVipOver25,
  filterVipBtts
} = require("./services/vipFilterEngine");

const { startDailyScheduler } =
  require("./services/dailyScheduler");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 3000;
const HISTORY_FILE = path.join(__dirname, "history.json");

const CACHE_TTL = 15 * 60 * 1000;

/*
 * On analyse plusieurs matchs afin d'avoir
 * suffisamment de candidats VIP.
 *
 * Le moteur reste strict ensuite.
 */
const MAX_ANALYSES = 8;

let cache = null;
let cacheTime = 0;
let building = null;
let dailyDate = null;


/* ======================================================
   HELPERS
====================================================== */

function loadHistory() {

  try {

    return JSON.parse(
      fs.readFileSync(
        HISTORY_FILE,
        "utf8"
      )
    );

  } catch {

    return [];

  }
}


function validAnalysis(a) {

  const h =
    a?.teamStats?.home;

  const v =
    a?.teamStats?.away;

  return (

    a?.match &&
    h &&
    v &&

    Number(h.played) >= 5 &&
    Number(v.played) >= 5

  );

}


function matchName(a) {

  return (
    `${a.match.homeTeam.name} vs ${a.match.awayTeam.name}`
  );

}


/*
 * Normalisation centrale.
 *
 * TOUTES les routes utilisent cette structure.
 * Cela évite les incohérences entre backend et UI.
 */
function publicPrediction(a) {

  const p =
    a?.predictions || {};

  const model =
    a?.model || {};

  const probabilities =
    p?.probabilities || {};

  const decision =
    p?.aiDecision || {};

  return {

    match:
      matchName(a),

    homeTeam:
      a.match.homeTeam,

    awayTeam:
      a.match.awayTeam,

    predictions: {

      winner:
        p.winner ?? null,

      winnerConfidence:
        Number(p.winnerConfidence ?? 0),

      probabilities: {

        homeWin:
          Number(probabilities.homeWin ?? 0),

        draw:
          Number(probabilities.draw ?? 0),

        awayWin:
          Number(probabilities.awayWin ?? 0)

      },

      over25:
        p.over25 ?? null,

      over25Confidence:
        Number(p.over25Confidence ?? 0),

      btts:
        p.btts ?? null,

      bttsConfidence:
        Number(p.bttsConfidence ?? 0),

      correctScore:
        p.correctScore ?? null,

      correctScoreProbability:
        Number(
          p.correctScoreProbability ?? 0
        ),

      aiRating:
        Number(p.aiRating ?? 0),

      predictionStrength:
        Number(
          p.predictionStrength ?? 0
        ),

      quality:
        p.quality ?? null,

      aiDecision: {

        decision:
          decision.decision ?? "NO BET",

        risk:
          decision.risk ?? "UNKNOWN",

        score:
          Number(decision.score ?? 0)

      }

    },

    model: {

      expectedGoals:
        Number(model.expectedGoals ?? 0),

      expectedHomeGoals:
        Number(
          model.expectedHomeGoals ?? 0
        ),

      expectedAwayGoals:
        Number(
          model.expectedAwayGoals ?? 0
        )

    },

    teamStats: {

      home: a.teamStats.home,

      away: a.teamStats.away

    }

  };

}


/* ======================================================
   ANALYSE
====================================================== */

async function buildAnalyses() {

  if (
    cache &&
    Date.now() - cacheTime < CACHE_TTL
  ) {

    console.log(
      "⚡ ANALYSIS CACHE:",
      cache.length
    );

    return cache;

  }


  if (building) {

    return building;

  }


  building = (async () => {

    const matches =
      await getMatches();


    if (!matches?.length) {

      console.log(
        "⚠️ NO FUTURE MATCHES"
      );

      return [];

    }


    /*
     * On prend davantage de candidats.
     *
     * Les filtres VIP décident ensuite
     * lesquels sont réellement bons.
     */
    const selected =
      matches.slice(
        0,
        MAX_ANALYSES
      );


    console.log(
      "🎯 MATCHES FOR AI:",
      selected.length
    );


    const results = [];


    for (
      const match of selected
    ) {

      try {

        console.log(
          "🔎 ANALYZING:",
          match.homeTeam.name,
          "vs",
          match.awayTeam.name
        );


        const result =
          await analyzeMatch(
            match
          );


        if (
          !validAnalysis(
            result
          )
        ) {

          console.log(
            "🚫 REJECTED — INSUFFICIENT DATA:",
            match.homeTeam.name,
            "vs",
            match.awayTeam.name
          );

          continue;

        }


        results.push(
          result
        );


        console.log(
          "✅ AI READY:",
          matchName(result)
        );


      } catch (err) {

        console.error(
          "❌ ANALYSIS ERROR:",
          err.message
        );

      }

    }


    cache =
      results;

    cacheTime =
      Date.now();


    console.log(
      "🤖 AI READY:",
      results.length
    );


    return results;

  })();


  try {

    return await building;

  } finally {

    building = null;

  }

}


/* ======================================================
   DAILY
====================================================== */

async function getDaily() {

  const today =
    new Date()
      .toISOString()
      .slice(0, 10);


  if (
    dailyDate === today &&
    cache
  ) {

    return cache;

  }


  const data =
    await buildAnalyses();


  dailyDate =
    today;


  console.log(
    "👑 DAILY READY:",
    data.length
  );


  return data;

}


/* ======================================================
   FREE
====================================================== */

app.get(
  "/free",
  async (req, res) => {

    try {

      const analyses =
        await getDaily();


      if (!analyses.length) {

        return res.json([]);

      }


      /*
       * FREE = meilleur candidat disponible.
       */
      const a =
        analyses[0];


      res.json([
        publicPrediction(a)
      ]);


    } catch (err) {

      console.error(
        "FREE ERROR:",
        err.message
      );


      res.status(500).json({
        error:
          "Internal server error"
      });

    }

  }
);


/* ======================================================
   VIP 1X2
====================================================== */

app.get(
  "/vip/1x2",
  async (req, res) => {

    try {

      const filtered =
        filterVipMatches(
          await getDaily()
        );


      const data =
        filtered
          .slice(0, 5)
          .map(a => ({

            ...publicPrediction(a),

            vipMarket:
              "1X2",

            vipScore:
              Number(
                a.vipScore ?? 0
              )

          }));


      console.log(
        "👑 VIP 1X2:",
        data.length
      );


      res.json(data);


    } catch (err) {

      console.error(
        "VIP 1X2 ERROR:",
        err.message
      );


      res.status(500).json({
        error:
          "Internal server error"
      });

    }

  }
);


/* ======================================================
   VIP OVER 2.5
====================================================== */

app.get(
  "/vip/over25",
  async (req, res) => {

    try {

      const filtered =
        filterVipOver25(
          await getDaily()
        );


      const data =
        filtered
          .slice(0, 6)
          .map(a => ({

            ...publicPrediction(a),

            vipMarket:
              "OVER 2.5",

            vipScore:
              Number(
                a.vipScore ?? 0
              )

          }));


      console.log(
        "🔥 VIP OVER25:",
        data.length
      );


      res.json(data);


    } catch (err) {

      console.error(
        "VIP OVER25 ERROR:",
        err.message
      );


      res.status(500).json({
        error:
          "Internal server error"
      });

    }

  }
);


/* ======================================================
   VIP BTTS
====================================================== */

app.get(
  "/vip/btts",
  async (req, res) => {

    try {

      const filtered =
        filterVipBtts(
          await getDaily()
        );


      const data =
        filtered
          .slice(0, 5)
          .map(a => ({

            ...publicPrediction(a),

            vipMarket:
              "BTTS",

            vipScore:
              Number(
                a.vipScore ?? 0
              )

          }));


      console.log(
        "🔥 VIP BTTS:",
        data.length
      );


      res.json(data);


    } catch (err) {

      console.error(
        "VIP BTTS ERROR:",
        err.message
      );


      res.status(500).json({
        error:
          "Internal server error"
      });

    }

  }
);


/* ======================================================
   SCORE EXACT
====================================================== */

app.get(
  "/vip/score",
  async (req, res) => {

    try {

      const analyses =
        await getDaily();


      /*
       * Le score exact n'est jamais présenté
       * comme une certitude.
       *
       * On classe simplement les meilleurs
       * scores exacts produits par Poisson.
       */
      const data =
        analyses

          .filter(a =>
            validAnalysis(a)
          )

          .filter(a =>
            a.predictions?.correctScore
          )

          .sort((a, b) => {

            return (
              Number(
                b.predictions
                  ?.correctScoreProbability
                || 0
              )
              -
              Number(
                a.predictions
                  ?.correctScoreProbability
                || 0
              )
            );

          })

          .slice(0, 3)

          .map(a => ({

            ...publicPrediction(a),

            vipMarket:
              "SCORE EXACT",

            vipScore:
              Number(
                a.predictions
                  ?.correctScoreProbability
                || 0
              )

          }));


      console.log(
        "📊 SCORE EXACT:",
        data.length
      );


      res.json(data);


    } catch (err) {

      console.error(
        "SCORE ERROR:",
        err.message
      );


      res.status(500).json({
        error:
          "Internal server error"
      });

    }

  }
);


/* ======================================================
   HISTORY
====================================================== */

app.get(
  "/history",
  (req, res) => {

    res.json(
      loadHistory()
    );

  }
);


/* ======================================================
   ACCURACY
====================================================== */

app.get(
  "/accuracy",
  (req, res) => {

    const history =
      loadHistory();


    let checked = 0;

    let correct = 0;


    for (
      const day of history
    ) {

      for (
        const pred
        of day.predictions || []
      ) {

        if (
          !pred.winner ||
          !pred.result
        )
          continue;


        checked++;


        if (
          pred.winner ===
          pred.result
        ) {

          correct++;

        }

      }

    }


    res.json({

      checked,

      correct,

      accuracy:
        checked
          ? Math.round(
              correct /
              checked *
              100
            )
          : 0

    });

  }
);


/* ======================================================
   HEALTH
====================================================== */

app.get(
  "/health",
  (req, res) => {

    res.json({

      status:
        "ok",

      ai:
        "KING PREDICTIONS AI",

      analyses:
        cache?.length || 0,

      cacheAge:
        cacheTime
          ? Math.round(
              (
                Date.now() -
                cacheTime
              ) / 1000
            )
          : null

    });

  }
);


/* ======================================================
   DEBUG
====================================================== */

app.get(
  "/debug",
  async (req, res) => {

    try {

      const matches =
        await getMatches();


      res.json(
        matches.map(m => ({

          home:
            m.homeTeam.name,

          homeId:
            m.homeTeam.id,

          away:
            m.awayTeam.name,

          awayId:
            m.awayTeam.id,

          date:
            m.utcDate

        }))
      );


    } catch (err) {

      res.status(500).json({

        error:
          err.message

      });

    }

  }
);


/* ======================================================
   HOME
====================================================== */

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


/* ======================================================
   START
====================================================== */

app.listen(
  PORT,
  "0.0.0.0",
  async () => {

    console.log(
      "👑 KING PREDICTIONS AI ONLINE"
    );

    console.log(
      "🚀 PORT:",
      PORT
    );


    try {

      await initializeDatabase();

      console.log(
        "✅ DATABASE READY"
      );


      await getDaily();

      console.log(
        "✅ AI PRELOAD READY"
      );


      startDailyScheduler(
        async () => {

          console.log(
            "♻️ DAILY RESET"
          );


          cache = null;

          cacheTime = 0;

          dailyDate = null;


          await getDaily();

        }
      );


    } catch (err) {

      console.error(
        "❌ STARTUP ERROR:",
        err.stack
      );

    }

  }
);
