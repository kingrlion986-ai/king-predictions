const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());

app.get("/", (req, res) => {
res.send("KING PREDICTIONS ONLINE ⚽");
});

app.get("/matches", (req, res) => {
res.json([
{ domicile: "PSG", extérieur: "OM", heure: "20:00" }
]);
});

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

res.json({
match: "${team1} vs ${team2}",
probabilities: {
[team1]: t1Prob,
draw: draw,
[team2]: t2Prob
},
score_guess: "${score1}-${score2}"
});
});

app.listen(process.env.PORT || 3000, () => {
console.log("SERVER OK");
});
