const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());

// =======================
// TEAMS DATABASE
// =======================
const teams = [
  "Manchester City","Arsenal","Real Madrid","Barcelona",
  "PSG","Bayern Munich","Liverpool","Chelsea",
  "Juventus","AC Milan"
];

// =======================
// MATCH GENERATOR
// =======================
function generateMatch() {
  const home = teams[Math.floor(Math.random() * teams.length)];
  let away = teams[Math.floor(Math.random() * teams.length)];

  while (away === home) {
    away = teams[Math.floor(Math.random() * teams.length)];
  }

  return { home, away };
}

// =======================
// STATS SYSTEM
// =======================
function stats(team) {
  const seed = team.charCodeAt(0);

  return {
    attack: 60 + (seed % 35),
    defense: 55 + (seed % 30),
    form: 50 + (seed % 25)
  };
}

// =======================
// HOME
// =======================
app.get("/", (req, res) => {
  res.send("KING PREDICTIONS V6 ULTRA PRO ⚽🔥");
});

// =======================
// MATCHES (STABLE FIX)
// =======================
app.get("/matches", (req, res) => {
  const list = [];

  for (let i = 0; i < 5; i++) {
    const m = generateMatch();

    list.push({
      home: m.home,
      away: m.away,
      time: new Date(Date.now() + i * 3600000).toISOString()
    });
  }

  res.json(list);
});

// =======================
// FREE (SAFE SINGLE PICK)
// =======================
app.get("/free", (req, res) => {
  const m = generateMatch();

  const t1 = stats(m.home);
  const t2 = stats(m.away);

  const power1 = t1.attack + t1.form + (100 - t2.defense);
  const power2 = t2.attack + t2.form + (100 - t1.defense);

  const total = power1 + power2;

  const p1 = Math.round((power1 / total) * 100);
  const p2 = Math.round((power2 / total) * 100);

  const winner = power1 > power2 ? m.home : m.away;

  res.json({
    match: `${m.home} vs ${m.away}`,
    prediction: {
      type: "1X2",
      pick: winner
    },
    confidence: Math.max(p1, p2),
    alternatives: {
      btts: (p1 > 55 && p2 > 55) ? "YES" : "NO",
      over15: (p1 + p2 > 140) ? "YES" : "NO"
    }
  });
});

// =======================
// VIP (STRUCTURED PRO SYSTEM)
// =======================
function predict(m) {
  const t1 = stats(m.home);
  const t2 = stats(m.away);

  const power1 = t1.attack + t1.form + (100 - t2.defense);
  const power2 = t2.attack + t2.form + (100 - t1.defense);

  const total = power1 + power2;

  const p1 = Math.round((power1 / total) * 100);
  const p2 = Math.round((power2 / total) * 100);

  const score1 = Math.round(power1 / 75);
  const score2 = Math.round(power2 / 75);

  return {
    match: `${m.home} vs ${m.away}`,

    winner: power1 > power2 ? m.home : m.away,

    btts: (p1 > 55 && p2 > 55) ? "YES" : "NO",

    over25: (score1 + score2 >= 3) ? "OVER 2.5" : "UNDER 2.5",

    htft: (power1 > power2)
      ? `${m.home}/${m.home}`
      : `${m.away}/${m.away}`,

    score: `${score1}-${score2}`,

    confidence: Math.max(p1, p2)
  };
}

// =======================
// VIP ENDPOINT
// =======================
app.get("/vip", (req, res) => {

  // 🟡 3 MATCHS VIP JOUR
  const vip_today = [];
  for (let i = 0; i < 3; i++) {
    vip_today.push(predict(generateMatch()));
  }

  // 💎 JACKPOT (7 à 8 MATCHS)
  const jackpot = [];
  const size = 7 + Math.floor(Math.random() * 2);

  for (let i = 0; i < size; i++) {
    jackpot.push(predict(generateMatch()));
  }

  res.json({
    vip_today,
    jackpot
  });
});

// =======================
// LIVE
// =======================
app.get("/live", (req, res) => {
  const live = [];

  for (let i = 0; i < 3; i++) {
    const m = generateMatch();

    live.push({
      match: `${m.home} vs ${m.away}`,
      score: `${Math.floor(Math.random() * 3)}-${Math.floor(Math.random() * 3)}`,
      minute: Math.floor(Math.random() * 90)
    });
  }

  res.json(live);
});

// =======================
// UI CLEAN (FREE / VIP / LIVE)
// =======================
app.get("/ui", (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
<title>KING PREDICTIONS V6 ⚽🔥</title>

<style>
body{
  background:#0f0f0f;
  color:white;
  font-family:Arial;
  text-align:center;
}

.header{
  background:#111;
  padding:20px;
  font-size:22px;
  color:#00ff88;
  font-weight:bold;
}

button{
  padding:12px 18px;
  margin:8px;
  border:none;
  border-radius:8px;
  cursor:pointer;
  font-weight:bold;
}

.free{background:#22c55e;color:black}
.vip{background:#facc15;color:black}
.live{background:#ef4444;color:white}

.card{
  background:#1f1f1f;
  margin:10px auto;
  padding:12px;
  width:85%;
  border-radius:10px;
  text-align:left;
}
</style>
</head>

<body>

<div class="header">
KING PREDICTIONS V6 ULTRA PRO ⚽🔥
</div>

<button class="free" onclick="load('/free')">FREE</button>
<button class="vip" onclick="load('/vip')">VIP</button>
<button class="live" onclick="load('/live')">LIVE</button>

<div id="data"></div>

<script>
async function load(url){
  const r = await fetch(url);
  const d = await r.json();
  document.getElementById('data').innerHTML =
    "<pre>" + JSON.stringify(d, null, 2) + "</pre>";
}
</script>

</body>
</html>
  `);
});

// =======================
// START SERVER
// =======================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("V6 ULTRA PRO RUNNING ⚽🔥"));
