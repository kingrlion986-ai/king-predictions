console.log("APP JS LOADED");

let currentMode = "/free";

async function loadPredictions(url) {

    const results = document.getElementById("results");

    results.innerHTML = "<h2>⏳ Chargement...</h2>";

    try {

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();

        console.log("API RESPONSE:", data);

        let list = [];

        if (Array.isArray(data)) {
            list = data;
        } else if (Array.isArray(data.data)) {
            list = data.data;
        } else {
            list = [data];
        }

        document.getElementById("matches").innerText = list.length;
        document.getElementById("predictions").innerText = list.length;

        results.innerHTML = "";

        list.forEach(item => {

            const card = document.createElement("div");
            card.className = "card";
            card.style.marginBottom = "20px";

            card.innerHTML = `
<h2>${item.match.homeTeam.name} vs ${item.match.awayTeam.name}</h2>

<hr style="margin:15px 0;">

<p><strong>Pronostic :</strong> ${item.predictions.winner}</p>

<p><strong>Confiance :</strong> ${item.predictions.confidence}%</p>

<p><strong>1/N/2 :</strong>
${item.predictions.probabilities.homeWin}% /
${item.predictions.probabilities.draw}% /
${item.predictions.probabilities.awayWin}%</p>

<p><strong>Score exact :</strong>
${item.predictions.correctScore}</p>

<p><strong>BTTS :</strong>
${item.predictions.btts}
(${item.predictions.bttsConfidence}%)</p>

<p><strong>Over 2.5 :</strong>
${item.predictions.over25}
(${item.predictions.over25Confidence}%)</p>

<p><strong>xG :</strong>
${item.model.expectedHomeGoals}
-
${item.model.expectedAwayGoals}</p>
`;

            results.appendChild(card);
        });

    } catch (e) {

        console.error(e);

        results.innerHTML = `
            <h2>❌ Impossible de charger les données.</h2>
            <p>${e.message}</p>
        `;
    }
}

currentMode = "/free";
loadPredictions(currentMode);
