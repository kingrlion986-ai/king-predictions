const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.API_KEY;

/* =========================
   API MATCHES (REAL DATA)
========================= */
async function getMatches() {
  const res = await fetch(
    "https://api.football-data.org/v4/matches",
    {
      headers: { "X-Auth-Token": API_KEY }
    }
  );

  const data = await res.json();
  return data.matches || [];
}

/* =========================
   SIMPLE CLEAN PICK ENGINE
   (NO FAKE MATCH GENERATION)
========================= */
function cleanPick(match) {
  const home = match.homeTeam.name;
  const away = match.awayTeam.name;

  const confidence = 60 + Math.floor(Math.random() * 25);

  return {
    match: `${home} vs ${away}`,
    confidence
  };
}

/* =========================
   FREE (1 MATCH ONLY)
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

  const result = matches.slice(0, 3).map(m => ({
    match: `${m.homeTeam.name} vs ${m.awayTeam.name}`,
    pick: m.homeTeam.name,
    confidence: 65
  }));

  res.json(result);
});

/* =========================
   OVER / UNDER (3 MATCHES)
========================= */
app.get("/vip/over25", async (req, res) => {
  const matches = await getMatches();

  const markets = ["OVER 2.5", "UNDER 2.5", "OVER 3.5", "UNDER 3.5"];

  const result = matches.slice(0, 3).map(m => ({
    match: `${m.homeTeam.name} vs ${m.awayTeam.name}`,
    market: markets[Math.floor(Math.random() * markets.length)]
  }));

  res.json(result);
});

/* =========================
   BTTS (4-6 MATCHES)
========================= */
app.get("/vip/btts", async (req, res) => {
  const matches = await getMatches();

  const result = matches.slice(0, 5).map(m => ({
    match: `${m.homeTeam.name} vs ${m.awayTeam.name}`,
    pick: Math.random() > 0.5 ? "YES" : "NO"
  }));

  res.json(result);
});

/* =========================
   SCORE EXACT (2-3 MATCHES)
========================= */
app.get("/vip/score", async (req, res) => {
  const matches = await getMatches();

  const result = matches.slice(0, 3).map(m => ({
    match: `${m.homeTeam.name} vs ${m.awayTeam.name}`,
    score: `${Math.floor(Math.random()*3)}-${Math.floor(Math.random()*3)}`
  }));

  res.json(result);
});

/* =========================
   HT/FT (2-3 MATCHES)
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
   COMBI (3-5 MATCHES)
========================= */
app.get("/vip/combos", async (req, res) => {
  const matches = await getMatches();

  const result = matches.slice(0, 4).map(m => ({
    match: `${m.homeTeam.name} vs ${m.awayTeam.name}`,
    pick: "SAFE PICK"
  }));

  res.json(result);
});

/* =========================
   JACKPOT (7-8 MATCHES)
========================= */
app.get("/vip/jackpot", async (req, res) => {
  const matches = await getMatches();

  const result = matches.slice(0, 8).map(m => ({
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

app.listen(PORT, () => {
  console.log("KING PREDICTIONS V15 RUNNING ⚽🔥");
});
