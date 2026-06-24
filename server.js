const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.API_KEY;
const BASE_URL = "https://api.football-data.org/v4";

function getStrength(teamName) {
  let sum = 0;
  for (let i = 0; i < teamName.length; i++) {
    sum += teamName.charCodeAt(i);
  }
  return sum % 100;
}

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
   REAL API FETCH
========================= */
async function getMatches() {
  try {
    const res = await fetch(BASE_URL + "/matches", {
      headers: { "X-Auth-Token": API_KEY }
    });

    const data = await res.json();
    return data.matches || [];
  } catch (err) {
    console.log("API ERROR:", err.message);
    return [];
  }
}

/* =========================
   FREE (1 MATCH)
========================= */
app.get("/free", async (req, res) => {
  const matches = await getMatches();
  if (!matches.length) return res.json({ error: "No matches" });

  const m = matches[0];

  res.json({
  match: `${m.homeTeam.name} vs ${m.awayTeam.name}`,
  prediction: "1X2",
  pick: m.homeTeam.name,
  confidence: 70

  });
});

/* =========================
   VIP 1X2 (3 MATCHES)
========================= */
app.get("/vip/1x2", async (req, res) => {
  const matches = await getMatches();

  const result = matches
    .slice(0, SETTINGS.maxVIP_1X2)
    .map(m => {

      const homeStrength = getStrength(m.homeTeam.name);
      const awayStrength = getStrength(m.awayTeam.name);

      const pick =
        homeStrength > awayStrength
          ? m.homeTeam.name
          : m.awayTeam.name;

      const confidence = Math.min(
        Math.abs(homeStrength - awayStrength) + 55,
        95
      );

      return {
        match: `${m.homeTeam.name} vs ${m.awayTeam.name}`,
        pick,
        confidence
      };
    })
    .sort((a, b) => b.confidence - a.confidence);

  res.json(result);
});

/* =========================
   OVER / UNDER
========================= */
app.get("/vip/over25", async (req, res) => {
  const matches = await getMatches();

  const result = matches
    .slice(0, SETTINGS.maxOVER)
    .map(m => {

      const home = getStrength(m.homeTeam.name);
      const away = getStrength(m.awayTeam.name);

      const total = home + away;

      return {
        match: `${m.homeTeam.name} vs ${m.awayTeam.name}`,
        market: total > 100 ? "OVER 2.5" : "UNDER 2.5",
        confidence: Math.min(total, 95)
      };
    });

  res.json(result);
});

/* =========================
   BTTS (YES / NO)
========================= */
app.get("/vip/btts", async (req, res) => {
  const matches = await getMatches();

  const result = matches
    .slice(0, SETTINGS.maxBTTS)
    .map(m => {

      const home = getStrength(m.homeTeam.name);
      const away = getStrength(m.awayTeam.name);

      const avg = (home + away) / 2;

      return {
        match: `${m.homeTeam.name} vs ${m.awayTeam.name}`,
        pick: avg > 45 ? "YES" : "NO",
        confidence: Math.round(avg)
      };
    });

  res.json(result);
});

/* =========================
   SCORE EXACT (NO FAKE MATCHES)
========================= */
app.get("/vip/score", async (req, res) => {

  const matches = await getMatches();

  const result = matches
    .slice(0, SETTINGS.maxSCORE)
    .map(m => {

      const home = getStrength(m.homeTeam.name);
      const away = getStrength(m.awayTeam.name);

      const h = Math.round(home / 35);
      const a = Math.round(away / 35);

      return {
        match: `${m.homeTeam.name} vs ${m.awayTeam.name}`,
        score: `${h}-${a}`
      };
    });

  res.json(result);
});

/* =========================
   HT/FT
========================= */
app.get("/vip/htft", async (req, res) => {
  const matches = await getMatches();

  const result = matches.slice(0, 3).map(m => ({
    match: `${m.homeTeam.name} vs ${m.awayTeam.name}`,
    pick: "DRAW/HOME"
  }));

  res.json(result);
});

/* =========================
   COMBI
========================= */
app.get("/vip/combos", async (req, res) => {
  const matches = await getMatches();

  const result = matches.slice(0, SETTINGS.maxCOMBI).map(m => ({
    match: `${m.homeTeam.name} vs ${m.awayTeam.name}`,
    pick: "SAFE PICK"
  }));

  res.json(result);
});

/* =========================
   JACKPOT
========================= */
app.get("/vip/jackpot", async (req, res) => {
  const matches = await getMatches();

  const result = matches.slice(0, SETTINGS.maxJACKPOT).map(m => ({
    match: `${m.homeTeam.name} vs ${m.awayTeam.name}`,
    pick: "HIGH RISK"
  }));

  res.json(result);
});

/* =========================
   LIVE
========================= */
app.get("/live", async (req, res) => {
  const matches = await getMatches();

  const result = matches.slice(0, 3).map(m => ({
    match: `${m.homeTeam.name} vs ${m.awayTeam.name}`,
    score: `${Math.floor(Math.random()*3)}-${Math.floor(Math.random()*3)}`,
    minute: Math.floor(Math.random()*90)
  }));

  res.json(result);
});

/* =========================
   UI
========================= */
app.get("/ui", (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
<title>KING PREDICTIONS V15</title>
</head>

<body style="background:#0b0f14;color:white;font-family:Arial;text-align:center">

<h1>KING PREDICTIONS V15 ⚽🔥</h1>

<button onclick="load('/free')">FREE</button>
<button onclick="load('/vip/1x2')">1X2</button>
<button onclick="load('/vip/over25')">OVER/UNDER</button>
<button onclick="load('/vip/btts')">BTTS</button>
<button onclick="load('/vip/score')">SCORE</button>
<button onclick="load('/vip/htft')">HT/FT</button>
<button onclick="load('/vip/combos')">COMBI</button>
<button onclick="load('/vip/jackpot')">JACKPOT</button>
<button onclick="load('/live')">LIVE</button>

<pre id="data"></pre>

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
  res.send("KING PREDICTIONS V15 ⚽🔥 SERVER OK");
});

app.listen(PORT, () => {
  console.log("KING PREDICTIONS V15 RUNNING ⚽🔥");
});
