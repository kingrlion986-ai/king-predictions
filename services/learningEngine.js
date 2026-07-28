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

    const overAccuracy =
    completed.filter(
        h => h.evaluation.over25Correct
    ).length /
    completed.length;

const bttsAccuracy =
    completed.filter(
        h => h.evaluation.bttsCorrect
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
        (averageScore / 100 + overAccuracy) / 2,
        0.90,
        1.20
    );

model.poissonWeight =
    clamp(
        (winnerAccuracy + bttsAccuracy) / 2 + 0.20,
        0.90,
        1.20
    );

    const recent = completed.slice(-20);

const recentAccuracy =
    recent.filter(
        h => h.evaluation.winnerCorrect
    ).length /
    Math.max(recent.length, 1);

model.confidenceWeight *=
    clamp(
        recentAccuracy + 0.20,
        0.90,
        1.15
    );

        model.winnerWeight =
    clamp(model.winnerWeight, 0.85, 1.25);

model.eloWeight =
    clamp(model.eloWeight, 0.90, 1.20);

model.xgWeight =
    clamp(model.xgWeight, 0.90, 1.20);

model.poissonWeight =
    clamp(model.poissonWeight, 0.90, 1.20);

model.confidenceWeight =
    clamp(model.confidenceWeight, 0.90, 1.20);

    return model;

}

module.exports = {

    buildLearningModel

};
