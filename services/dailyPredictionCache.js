const fs = require("fs");
const path = require("path");

const CACHE_FILE = path.join(__dirname, "../data/dailyPredictions.json");

// Crée le dossier data s'il n'existe pas
if (!fs.existsSync(path.dirname(CACHE_FILE))) {
    fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true });
}

function getToday() {
    return new Date().toISOString().split("T")[0];
}

function hasValidDailyCache() {

    if (!fs.existsSync(CACHE_FILE)) {
        return false;
    }

    try {

        const cache = JSON.parse(
            fs.readFileSync(CACHE_FILE, "utf8")
        );

        return cache.date === getToday();

    } catch {

        return false;

    }

}

function loadDailyPredictions() {

    if (!hasValidDailyCache()) {
        return null;
    }

    return JSON.parse(
        fs.readFileSync(CACHE_FILE, "utf8")
    ).predictions;

}

function saveDailyPredictions(predictions) {

    fs.writeFileSync(
        CACHE_FILE,
        JSON.stringify({
            date: getToday(),
            predictions
        }, null, 2)
    );

    console.log(
        `✅ ${predictions.length} prédictions sauvegardées`
    );

}

function clearDailyCache() {

    if (fs.existsSync(CACHE_FILE)) {
        fs.unlinkSync(CACHE_FILE);
    }

}

module.exports = {
    hasValidDailyCache,
    loadDailyPredictions,
    saveDailyPredictions,
    clearDailyCache
};
