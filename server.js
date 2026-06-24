const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");

const app = express();
app.use(cors());

const API_KEY = process.env.API_KEY;

/* =======================
   HOME
======================= */
app.get("/", (req, res) => {
  res.send("KING PREDICTIONS V5 PRO ⚽🔥");
});

/* =======================
   MATCHS RÉELS (API FOOTBALL-DATA)
======================= */
app.get("/matches", async (req, res) => {
  try {
    const response = await fetch(
      "https://api.football-data.org/v4/matches",
      {
        headers: {
          "X-Auth-Token": API_KEY
        }
      }
    );

    const data = await response.json();

    if (!data.matches) {
      return res.json([]);
    }

    const matches = data.matches.slice(0, 10).map(m => ({
      home: m.homeTeam.name,
      away: m.awayTeam.name,
      status: m.status,
      time: m.utcDate
    }));

    res.json(matches);

  } catch (err) {
    res.json({
      error: "API unavailable",
      message: err.message
    });
  }
});

/* =======================
   MOTEUR DE PRÉDICTION PRO
======================= */
function strength(teamName) {
  const seed = teamName.charCodeAt(0);

  return {
    attack: 60 + (seed % 30),
    defense: 55 + (seed % 25)
  };
}

/* =======================
   FREE (1 MATCH PROPRE)
======================= */
app.get("/free", async (req, res) => {

  try {
    const r = await fetch("https://api.football-data.org/v4/matches", {
      headers: { "X-Auth-Token": API_KEY }
    });

    const d = await r.json();
    const match = d.matches?.[0];

    if (!match) {
      return res.json({ error: "No match available" });
    }

    const home = match.homeTeam.name;
    const away = match.awayTeam.name;

    const h = strength(home);
    const a = strength(away);

    const powerH = h.attack + (100 - a.defense);
    const powerA = a.attack + (100 - h.defense);

    const total = powerH + powerA;

    const ph = Math.round((powerH / total) * 100);
    const pa = Math.round((powerA / total) * 100);

    const scoreH = Math.max(0, Math.round(powerH / 85));
    const scoreA = Math.max(0, Math.round(powerA / 85));

    const winner =
      scoreH > scoreA ? home :
      scoreA > scoreH ? away : "DRAW";

    res.json({
      match: `${home} vs ${away}`,
      score: `${scoreH}-${scoreA}`,
      winner,
      confidence: Math.max(ph, pa)
    });

  } catch (err) {
    res.json({ error: "free system error" });
  }
});

/* =======================
   VIP (MULTI MATCH CLEAN)
======================= */
app.get("/vip", async (req, res) => {

  try {
    const r = await fetch("https://api.football-data.org/v4/matches", {
      headers: { "X-Auth-Token": API_KEY }
    });

    const d = await r.json();

    const results = (d.matches || []).slice(0, 5).map(m => {

      const home = m.homeTeam.name;
      const away = m.awayTeam.name;

      const h = strength(home);
      const a = strength(away);

      const powerH = h.attack + (100 - a.defense);
      const powerA = a.attack + (100 - h.defense);

      const scoreH = Math.round(powerH / 90);
      const scoreA = Math.round(powerA / 90);

      return {
        match: `${home} vs ${away}`,
        score: `${scoreH}-${scoreA}`,
        winner:
          scoreH > scoreA ? home :
          scoreA > scoreH ? away : "DRAW",
        btts: scoreH > 0 && scoreA > 0 ? "YES" : "NO",
        over25: (scoreH + scoreA >= 3) ? "YES" : "NO"
      };
    });

    res.json(results);

  } catch (err) {
    res.json([]);
  }
});

/* =======================
   LIVE (PRO PREVIEW CLEAN)
======================= */
app.get("/live", async (req, res) => {

  try {
    const r = await fetch("https://api.football-data.org/v4/matches", {
      headers: { "X-Auth-Token": API_KEY }
    });

    const d = await r.json();

    const live = (d.matches || [])
      .filter(m => m.status === "LIVE")
      .slice(0, 5)
      .map(m => ({
        match: `${m.homeTeam.name} vs ${m.awayTeam.name}`,
        score: `${m.score?.fullTime?.home ?? 0}-${m.score?.fullTime?.away ?? 0}`,
        status: m.status
      }));

    res.json(live.length ? live : [{ match: "No live match", score: "0-0", status: "OFF" }]);

  } catch (err) {
    res.json([{ match: "system error", score: "0-0" }]);
  }
});

/* =======================
   START SERVER
======================= */
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("KING PREDICTIONS V5 PRO RUNNING ⚽🔥");
});
