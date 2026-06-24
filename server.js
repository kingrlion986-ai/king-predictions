const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());

/* =======================
   TEAMS DATABASE
======================= */
const teams = [
  "Manchester City","Arsenal","Real Madrid","Barcelona",
  "PSG","Bayern Munich","Liverpool","Chelsea",
  "Juventus","AC Milan"
];

/* =======================
   MATCH GENERATOR
======================= */
function generateMatch() {
  const home = teams[Math.floor(Math.random() * teams.length)];
  let away = teams[Math.floor(Math.random() * teams.length)];

  while (away === home) {
    away = teams[Math.floor(Math.random() * teams.length)];
  }

  return { home, away };
}

/* =======================
   ENGINE (STABLE + BUSINESS)
======================= */
function stats(team) {
  const seed = team.charCodeAt(0);

  return {
    attack: 60 + (seed % 40),
    defense: 55 + (seed % 35),
    form: 50 + (seed % 30)
  };
}

function predict(home, away) {

  const t1 = stats(home);
  const t2 = stats(away);

  const power1 = t1.attack + t1.form + (100 - t2.defense);
  const power2 = t2.attack + t2.form + (100 - t1.defense);

  const total = power1 + power2;

  const confidence = Math.round((Math.max(power1, power2) / total) * 100);

  const winner = power1 > power2 ? home : away;

  return {
    winner,
    confidence,
    score: `${Math.round(power1 / 80)}-${Math.round(power2 / 80)}`,
    over25: (power1 + power2 > 125) ? "OVER" : "UNDER",
    btts: (power1 > 110 && power2 > 110) ? "YES" : "NO"
  };
}

/* =======================
   HOME
======================= */
app.get("/", (req, res) => {
  res.send("KING PREDICTIONS V11 BUSINESS CLEAN ⚽🔥");
});

/* =======================
   FREE (SAFE PICK)
======================= */
app.get("/free", (req, res) => {

  const m = generateMatch();
  const p = predict(m.home, m.away);

  res.json({
    section: "FREE",
    match: `${m.home} vs ${m.away}`,
    prediction: {
      type: "1X2",
      pick: p.winner
    },
    confidence: p.confidence
  });
});

/* =======================
   VIP 1X2
======================= */
app.get("/vip/1x2", (req, res) => {

  const m = generateMatch();
  const p = predict(m.home, m.away);

  res.json({
    section: "1X2",
    match: `${m.home} vs ${m.away}`,
    pick: p.winner,
    confidence: p.confidence
  });
});

/* =======================
   OVER 2.5
======================= */
app.get("/vip/over25", (req, res) => {

  const m = generateMatch();
  const p = predict(m.home, m.away);

  res.json({
    section: "OVER_2_5",
    match: `${m.home} vs ${m.away}`,
    pick: p.over25,
    confidence: p.confidence
  });
});

/* =======================
   BTTS
======================= */
app.get("/vip/btts", (req, res) => {

  const m = generateMatch();
  const p = predict(m.home, m.away);

  res.json({
    section: "BTTS",
    match: `${m.home} vs ${m.away}`,
    pick: p.btts,
    confidence: p.confidence
  });
});

/* =======================
   SCORE EXACT
======================= */
app.get("/vip/score", (req, res) => {

  const m = generateMatch();
  const p = predict(m.home, m.away);

  res.json({
    section: "SCORE_EXACT",
    match: `${m.home} vs ${m.away}`,
    pick: p.score,
    confidence: p.confidence
  });
});

/* =======================
   HT / FT
======================= */
app.get("/vip/htft", (req, res) => {

  const m = generateMatch();
  const p = predict(m.home, m.away);

  const options = [
    `${m.home}/${m.home}`,
    `${m.home}/DRAW`,
    `DRAW/DRAW`,
    `${m.away}/${m.away}`
  ];

  res.json({
    section: "HT_FT",
    match: `${m.home} vs ${m.away}`,
    pick: options[Math.floor(Math.random() * options.length)],
    confidence: p.confidence
  });
});

/* =======================
   BEST COMBO (3 MATCHS)
======================= */
app.get("/vip/combos", (req, res) => {

  let matches = [];

  for (let i = 0; i < 3; i++) {

    const m = generateMatch();
    const p = predict(m.home, m.away);

    matches.push({
      match: `${m.home} vs ${m.away}`,
      prediction: {
        type: "1X2",
        pick: p.winner
      },
      confidence: p.confidence
    });
  }

  res.json({
    section: "BEST_COMBO_TODAY",
    matches
  });
});

/* =======================
   JACKPOT DU JOUR (7-8 MATCHS PRO)
======================= */
app.get("/vip/jackpot", (req, res) => {

  let matches = [];

  while (matches.length < 8) {

    const m = generateMatch();
    const p = predict(m.home, m.away);

    if (p.confidence >= 52) {
      matches.push({
        match: `${m.home} vs ${m.away}`,
        prediction: {
          type: "1X2",
          pick: p.winner
        },
        score: p.score,
        confidence: p.confidence,
        btts: p.btts,
        over25: p.over25
      });
    }
  }

  res.json({
    section: "JACKPOT_DU_JOUR",
    matches
  });
});

/* =======================
   LIVE MATCHES
======================= */
app.get("/live", (req, res) => {

  let live = [];

  for (let i = 0; i < 3; i++) {

    const m = generateMatch();

    live.push({
      match: `${m.home} vs ${m.away}`,
      score: `${Math.floor(Math.random()*3)}-${Math.floor(Math.random()*3)}`,
      minute: Math.floor(Math.random()*90)
    });
  }

  res.json({
    section: "LIVE",
    matches: live
  });
});

/* =======================
   UI BOOKMAKER PRO
======================= */
app.get("/ui", (req, res) => {

res.send(`
<!DOCTYPE html>
<html>
<head>
<title>KING V13 BET365 UI PRO ⚽🔥</title>

<style>
body{
  margin:0;
  font-family: Arial;
  background:#0b0f14;
  color:white;
}

.header{
  background:#111827;
  padding:18px;
  text-align:center;
  font-size:20px;
  color:#00ff88;
  font-weight:bold;
}

.menu{
  display:flex;
  flex-wrap:wrap;
  justify-content:center;
  gap:8px;
  padding:10px;
}

button{
  background:#1f2937;
  color:white;
  border:none;
  padding:10px 12px;
  border-radius:8px;
  cursor:pointer;
  font-weight:bold;
}

button:hover{
  background:#00ff88;
  color:black;
}

.card{
  background:#111827;
  margin:10px auto;
  padding:15px;
  border-radius:10px;
  max-width:650px;
  text-align:left;
  box-shadow:0 0 10px rgba(0,255,136,0.1);
}

.badge{
  display:inline-block;
  padding:4px 8px;
  border-radius:6px;
  font-size:12px;
  margin-bottom:8px;
}

.green{background:#16a34a;}
.yellow{background:#facc15;color:black;}
.red{background:#ef4444;}

pre{
  white-space:pre-wrap;
}

</style>
</head>

<body>

<div class="header">
KING PREDICTIONS V13 BET365 PRO ⚽🔥
</div>

<div class="menu">
  <button onclick="load('/free')">FREE</button>
  <button onclick="load('/vip/1x2')">1X2</button>
  <button onclick="load('/vip/over25')">OVER 2.5</button>
  <button onclick="load('/vip/btts')">BTTS</button>
  <button onclick="load('/vip/score')">SCORE</button>
  <button onclick="load('/vip/htft')">HT/FT</button>
  <button onclick="load('/vip/combos')">COMBI</button>
  <button onclick="load('/vip/jackpot')">JACKPOT 🔥</button>
  <button onclick="load('/live')">LIVE</button>
</div>

<div id="data" class="card">
Clique sur une section 👆
</div>

<script>

async function load(url){
  const r = await fetch(url);
  const d = await r.json();
  document.getElementById("data").innerHTML = render(d);
}

/* =======================
   RENDER PRO UI
======================= */
function render(data){

  if(Array.isArray(data)){
    return data.map(m => card(m)).join('');
  }

  return card(data);
}

/* =======================
   CARD DESIGN PRO
======================= */
function card(m){

  if(!m.match && !m.prediction){
    return `<pre>${JSON.stringify(m,null,2)}</pre>`;
  }

  const conf = m.confidence || 0;

  let color = "green";
  if(conf < 52) color = "yellow";
  if(conf < 50) color = "red";

  return `
    <div class="card">
      <span class="badge ${color}">CONF ${conf}%</span><br><br>

      <b>${m.match || ""}</b><br><br>

      ${m.prediction ? `
        <div>🎯 Type: ${m.prediction.type}</div>
        <div>👉 Pick: ${m.prediction.pick}</div>
      ` : ""}

      ${m.score ? `<div>⚽ Score: ${m.score}</div>` : ""}

      ${m.winner ? `<div>🏆 Winner: ${m.winner}</div>` : ""}

      ${m.btts ? `<div>BTTS: ${m.btts}</div>` : ""}

      ${m.over25 ? `<div>Over 2.5: ${m.over25}</div>` : ""}

    </div>
  `;
}

</script>

</body>
</html>
`);

});

/* =======================
   START SERVER
======================= */
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("KING V11 BUSINESS RUNNING ⚽🔥");
});
