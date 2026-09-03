console.log("👑 KING PREDICTIONS AI — FRONTEND V1.1");
const API="/analysis";
const $=id=>document.getElementById(id);
const num=v=>{const n=Number(v);return Number.isFinite(n)?n:0};
const text=(v,f="-")=>v===undefined||v===null||v===""?f:String(v);
const pct=v=>`${Math.round(num(v))}%`;

function team(t){return text(t?.name,"Équipe inconnue")}

function formatDate(v){
if(!v)return "Date inconnue";
const d=new Date(v);
if(Number.isNaN(d.getTime()))return "Date inconnue";
return d.toLocaleString("fr-FR",{dateStyle:"medium",timeStyle:"short"});
}

function getAnalyses(data){
if(Array.isArray(data))return data;
if(Array.isArray(data?.analyses))return data.analyses;
if(Array.isArray(data?.data))return data.data;
if(Array.isArray(data?.results))return data.results;
return [];
}

function render(data){
console.log("📦 ANALYSIS DATA:",data);
const results=$("results");
if(!results)return console.error("❌ #results introuvable");

const list=getAnalyses(data);

if($("matches"))$("matches").textContent=list.length;
if($("predictions"))$("predictions").textContent=list.length;
if($("lastUpdate")){
$("lastUpdate").textContent=list.length
?`📅 ${text(data?.date,"Aujourd'hui")} • ${list.length} analyse(s)`
:"🔍 Aucune analyse disponible";
}

if(!list.length){
results.innerHTML=`
<div class="empty-card">
<h3>🔍 Aucune analyse</h3>
<p>Le serveur n'a retourné aucune analyse.</p>
<button onclick="loadAnalysis()">🔄 Actualiser</button>
</div>`;
return;
}

results.innerHTML=list.map((a,i)=>{
const m=a?.match||{};
const p=a?.predictions||{};
const model=a?.model||{};
const probs=p?.probabilities||{};
const home=team(m?.homeTeam);
const away=team(m?.awayTeam);
const competition=text(m?.competition?.name||m?.competition?.code,"Compétition inconnue");

return `
<article class="prediction-card">
<div class="card-number">ANALYSE ${i+1}</div>

<h2>⚽ ${home}</h2>
<div class="vs">VS</div>
<h2>${away}</h2>

<p class="date">🕐 ${formatDate(m?.utcDate)}</p>
<p>🏆 <strong>${competition}</strong></p>

<div class="section">
<h3>📊 Probabilités du modèle</h3>
<div class="probabilities">
<div>
<span>🏠 Domicile</span>
<strong>${pct(probs.homeWin)}</strong>
</div>
<div>
<span>🤝 Nul</span>
<strong>${pct(probs.draw)}</strong>
</div>
<div>
<span>✈️ Extérieur</span>
<strong>${pct(probs.awayWin)}</strong>
</div>
</div>
</div>

<div class="section">
<h3>⚽ Buts attendus</h3>
<p>🏠 ${home} : <strong>${num(model.expectedHomeGoals).toFixed(2)}</strong></p>
<p>✈️ ${away} : <strong>${num(model.expectedAwayGoals).toFixed(2)}</strong></p>
<p>📈 Total xG : <strong>${num(model.expectedGoals).toFixed(2)}</strong></p>
</div>

<div class="section">
<h3>🧠 Analyse IA</h3>
<p>🎯 Tendance : <strong>${text(p.winner)}</strong></p>
<p>⚽ Over 2.5 : <strong>${pct(p.over25Confidence)}</strong></p>
<p>🟠 BTTS : <strong>${text(p.btts)}</strong> — ${pct(p.bttsConfidence)}</p>
<p>🎯 Score théorique : <strong>${text(p.correctScore)}</strong></p>
</div>

<div class="quality">
<p>🧠 Confiance du modèle : <strong>${pct(p.confidence)}</strong></p>
<p>📚 Données utilisées : <strong>${num(p.matchesUsed)}</strong> matchs</p>
<p>✅ Qualité des données : <strong>${text(p.dataQuality)}</strong></p>
</div>
</article>`;
}).join("");
}

async function loadAnalysis(){
const results=$("results");

if(!results){
console.error("❌ Élément #results absent");
return;
}

results.innerHTML=`
<div class="loading">
⏳ Chargement des analyses...
</div>`;

try{
const url=`${API}?v=${Date.now()}`;
console.log("📡 REQUÊTE:",url);

const response=await fetch(url,{
method:"GET",
cache:"no-store",
headers:{
"Accept":"application/json",
"Cache-Control":"no-cache"
}
});

console.log("🌐 HTTP:",response.status,response.statusText);

if(!response.ok){
throw new Error(`Serveur HTTP ${response.status}`);
}

const raw=await response.text();

console.log("📄 TAILLE:",raw.length);

if(!raw.trim()){
throw new Error("Réponse vide du serveur");
}

let data;

try{
data=JSON.parse(raw);
}catch(e){
console.error("❌ JSON INVALIDE:",raw.slice(0,500));
throw new Error("Le serveur n'a pas envoyé un JSON valide");
}

render(data);

}catch(error){
console.error("❌ FRONTEND:",error);

results.innerHTML=`
<div class="error-card">
<h3>❌ Impossible d'afficher les analyses</h3>
<p>${text(error?.message,"Erreur inconnue")}</p>
<br>
<button onclick="loadAnalysis()">🔄 Réessayer</button>
</div>`;
}
}

async function refreshAnalysis(){
await loadAnalysis();
}

window.loadAnalysis=loadAnalysis;
window.refreshAnalysis=refreshAnalysis;

document.addEventListener("DOMContentLoaded",()=>{
console.log("🚀 DOM READY");
loadAnalysis();
});
