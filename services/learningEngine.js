const {
    loadHistory
} = require("./historyEngine");

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function buildLearningModel() {

    const history = loadHistory();

    const completed =
        history.filter(
            h => h.evaluation
        );

    const model = {

        winnerWeight: 1,

        eloWeight: 1,

        xgWeight: 1,

        poissonWeight: 1,

        confidenceWeight: 1,

        matches: completed.length

    };

    if (completed.length < 30) {

        return model;

    }

    const winnerAccuracy =
        completed.filter(
            h => h.evaluation.winnerCorrect
        ).length /
        completed.length;

    const averageScore =
        completed.reduce(
            (sum, h) =>
                sum + h.evaluation.globalScore,
            0
        ) / completed.length;

    model.winnerWeight =
        clamp(
            0.8 + winnerAccuracy,
            0.80,
            1.30
        );

    model.confidenceWeight =
        clamp(
            averageScore / 100,
            0.80,
            1.20
        );

    model.eloWeight =
        clamp(
            winnerAccuracy + 0.20,
            0.90,
            1.25
        );

    model.xgWeight =
        clamp(
            averageScore / 90,
            0.90,
            1.20
        );

    model.poissonWeight =
        clamp(
            averageScore / 95,
            0.90,
            1.20
        );

    return model;

}

module.exports = {

    buildLearningModel

};
