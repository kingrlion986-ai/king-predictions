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
   MATCHS (STABLE + REAL DATA)
======================= */
app.get("/matches", async (req, res) => {
  try {
    const response = await fetch(
      "https://v3.football.api-sports.io/fixtures?next=20",
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

      if (!trackedMatches.find(x => x.home === home && x.away === away)) {
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

    if (!matches.length) {
      return res.json([
        {
          home: "Aucun match disponible",
          away: "Réessayez plus tard",
          time: new Date().toISOString()
        }
      ]);
    }

    res.json(matches);

  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "matches error" });
  }
});

/* =======================
   AUTO PREDICTION
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
   LIVE MATCHES
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

    const result = (data.response || []).map(m => ({
      match: `${m.teams.home.name} vs ${m.teams.away.name}`,
      score: `${m.goals.home ?? 0}-${m.goals.away ?? 0}`,
      minute: m.fixture.status.elapsed ?? 0
    }));

    res.json(result);

  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "live error" });
  }
});

/* =======================
   START SERVER
======================= */
app.listen(3000, () => {
  console.log("AUTO SYSTEM RUNNING ⚽🔥");
});
