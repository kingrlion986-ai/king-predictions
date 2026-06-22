const express = require("express");
const cors = require("cors");

const API_KEY = "a032b98e63f13e8e40fc0cc461aa2f30";

const app = express();
app.use(cors());

/* =======================
   HOME
======================= */
app.get("/", (req, res) => {
res.send("KING PREDICTIONS ONLINE ⚽");
});

/* =======================
   MATCHS
======================= */
app.get("/matches", (req, res) => {
res.json([
{ domicile: "PSG", extérieur: "OM", heure: "20:00" }
]);
});

/* =======================
   PREDICTION API
======================= */
app.get("/predict", (req, res) => {

const team1 = req.query.team1 || "PSG";
const team2 = req.query.team2 || "OM";

const teams = {
PSG: { attack: 85, defense: 80 },
OM: { attack: 70, defense: 65 },
Madrid: { attack: 90, defense: 85 },
Barca: { attack: 88, defense: 82 },
Bayern: { attack: 87, defense: 84 },
Arsenal: { attack: 82, defense: 78 }
};

const t1 = teams[team1] || { attack: 75, defense: 75 };
const t2 = teams[team2] || { attack: 75, defense: 75 };

const t1Power = t1.attack + (100 - t2.defense);
const t2Power = t2.attack + (100 - t1.defense);

const total = t1Power + t2Power;

const t1Prob = Math.round((t1Power / total) * 100);
const t2Prob = Math.round((t2Power / total) * 100);
const draw = Math.max(10, 100 - (t1Prob + t2Prob));

const score1 = Math.round(t1Power / 35);
const score2 = Math.round(t2Power / 35);

const winner =
score1 > score2 ? team1 :
score2 > score1 ? team2 :
"Nul";

const confidence =
winner === "Nul"
? "50%"
: Math.max(t1Prob, t2Prob) + "%";

const btts =
score1 > 0 && score2 > 0
? "Oui"
: "Non";

const over25 =
(score1 + score2) > 2
? "Over 2.5"
: "Under 2.5";

res.json({
match: `${team1} vs ${team2}`,
winner,
confidence,
probabilities: {
[team1]: t1Prob,
draw,
[team2]: t2Prob
},
score_guess: `${score1}-${score2}`,
btts,
over25
});

});

/* =======================
   UI WEB
======================= */
app.get("/ui", (req, res) => {
res.send(`
<!DOCTYPE html>
<html>
<head>
<title>King Predictions</title>
<style>
body{
font-family: Arial;
background:#111;
color:white;
text-align:center;
padding:40px;
}
.card{
background:#222;
padding:20px;
border-radius:12px;
max-width:500px;
margin:auto;
}
input{
padding:10px;
margin:5px;
}
button{
padding:10px 20px;
cursor:pointer;
}
</style>
</head>

<body>
<div class="card">
<h1>⚽ KING PREDICTIONS</h1>

<input id="team1" placeholder="Equipe 1" value="PSG">
<input id="team2" placeholder="Equipe 2" value="OM">

<br><br>

<button onclick="predict()">Voir la prédiction</button>

<div id="result"></div>
</div>

<script>
async function predict(){

const team1 = document.getElementById("team1").value;
const team2 = document.getElementById("team2").value;

const rep = await fetch('/predict?team1=' + team1 + '&team2=' + team2);
const data = await rep.json();

document.getElementById("result").innerHTML =
"<h3>"+data.match+"</h3>" +
"<p>Vainqueur probable : "+data.winner+"</p>" +
"<p>Confiance : "+data.confidence+"</p>" +
"<p>Score prévu : "+data.score_guess+"</p>" +
"<p>BTTS : "+data.btts+"</p>" +
"<p>"+data.over25+"</p>" +
"<pre>"+JSON.stringify(data.probabilities, null, 2)+"</pre>";

}
</script>

</body>
</html>
`);
});

/* =======================
   START SERVER
======================= */
app.listen(process.env.PORT || 3000, () => {
console.log("SERVER OK");
});
