const fs = require("fs");
const path = require("path");

const FILE =
path.join(
    __dirname,
    "../data/adaptiveWeights.json"
);

const DEFAULT = {

    elo: 1.00,
    xg: 1.00,
    poisson: 1.00,
    form: 1.00,
    stability: 1.00,
    confidence: 1.00

};

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

module.exports = {

    getWeights,
    saveWeights

};
