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
                <h2>${item.match ?? "Match"}</h2>
                <hr style="margin:15px 0;">
                <p><strong>Pronostic :</strong> ${
    item.pick || item.market || item.prediction || "-"
}</p>

${currentMode.startsWith("/vip") ? `
<p><strong>⚡ Score exact :</strong> ${item.score || "-"}</p>
` : ""}
                <p><strong>Confiance :</strong> ${
                    item.confidence ?? "-"
                }%</p>
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
