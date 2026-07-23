const fs = require("fs");
const path = require("path");

const FILE = path.join(
    __dirname,
    "../data/adaptiveWeights.json"
);

const DEFAULT = {

    poisson: 0.45,
    elo: 0.15,
    strength: 0.20,
    form: 0.10,
    momentum: 0.05,
    reliability: 0.05

};

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function loadWeights() {

    try {

        if (!fs.existsSync(FILE)) {

            fs.mkdirSync(
                path.dirname(FILE),
                { recursive: true }
            );

            fs.writeFileSync(
                FILE,
                JSON.stringify(DEFAULT, null, 2)
            );

            return { ...DEFAULT };

        }

        return JSON.parse(
            fs.readFileSync(FILE, "utf8")
        );

    } catch {

        return { ...DEFAULT };

    }

}

function saveWeights(weights) {

    fs.writeFileSync(
        FILE,
        JSON.stringify(weights, null, 2)
    );

}

function getWeights() {

    return loadWeights();

}

function updateWeights(item) {

    const weights = loadWeights();

    if (!item || !item.evaluation) {
        return weights;
    }

    const score = item.evaluation.globalScore || 0;

    // Bonne prédiction
    if (score >= 70) {

        weights.poisson += 0.01;
        weights.elo += 0.005;
        weights.strength += 0.005;

    }

    // Mauvaise prédiction
    else if (score < 40) {

        weights.poisson -= 0.01;
        weights.elo -= 0.005;
        weights.strength -= 0.005;

    }

    // Limites de sécurité
    weights.poisson = clamp(weights.poisson, 0.20, 0.60);
    weights.elo = clamp(weights.elo, 0.05, 0.30);
    weights.strength = clamp(weights.strength, 0.05, 0.30);
    weights.form = clamp(weights.form, 0.05, 0.20);
    weights.momentum = clamp(weights.momentum, 0.05, 0.20);
    weights.reliability = clamp(weights.reliability, 0.05, 0.20);

    saveWeights(weights);

    return weights;

}

module.exports = {

    getWeights,
    saveWeights,
    updateWeights

};
