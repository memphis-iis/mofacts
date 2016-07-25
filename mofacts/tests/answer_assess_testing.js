//We are currently skipping any client-only stuff in the global helpers
Meteor = { isClient: false, isServer: true };

require("./dinky_test.js");

require("../lib/globalHelpers.js");
require("../lib/editDistance.js");
require("../lib/answerAssess.js");

test_suite("Answers", function() {
    var setspec = {
        'lfparameter': [0.85]
    };

    unit_test("simple matching", function(logger) {
        var checkResult = function(isCorrectExpected, matchTextExpected, result) {
            logger.log("checkResult:",
                displayify({'isCorrectExpected': isCorrectExpected, 'matchTextExpected': matchTextExpected}),
                "GOT:",
                displayify(result)
            );
            assert.deepEqual(isCorrectExpected, result[0]);
            assert.deepEqual(matchTextExpected, result[1]);
        };

        checkResult(true,  'Correct.',                            Answers.answerIsCorrect('', '', setspec));
        checkResult(true,  'Correct.',                            Answers.answerIsCorrect('A', 'A', setspec));
        checkResult(false, 'Incorrect. The correct answer is B.', Answers.answerIsCorrect('Wrong', 'B', setspec));
        checkResult(false, 'The correct answer is B.',            Answers.answerIsCorrect('', 'B', setspec));
        checkResult(false, 'Incorrect. The correct answer is B.', Answers.answerIsCorrect(null, 'B', setspec));
    });

    unit_test("simple bar", function(logger) {
        var checkResult = function(isCorrectExpected, matchTextExpected, result) {
            logger.log("checkResult:",
                displayify({'isCorrectExpected': isCorrectExpected, 'matchTextExpected': matchTextExpected}),
                "GOT:",
                displayify(result)
            );
            assert.deepEqual(isCorrectExpected, result[0]);
            assert.deepEqual(matchTextExpected, result[1]);
        };

        checkResult(true,  'Correct.',                            Answers.answerIsCorrect('A', 'A|B', setspec));
        checkResult(true,  'Correct.',                            Answers.answerIsCorrect('B', 'A|B', setspec));
        checkResult(false, 'Incorrect. The correct answer is A.', Answers.answerIsCorrect('C', 'A|B', setspec));
        checkResult(false, 'The correct answer is A.',            Answers.answerIsCorrect('', 'A|B', setspec));
        checkResult(false, 'Incorrect. The correct answer is A.', Answers.answerIsCorrect(null, 'A|B', setspec));
    });

    unit_test("simple bar w spaces", function(logger) {
        var checkResult = function(isCorrectExpected, matchTextExpected, result) {
            logger.log("checkResult:",
                displayify({'isCorrectExpected': isCorrectExpected, 'matchTextExpected': matchTextExpected}),
                "GOT:",
                displayify(result)
            );
            assert.deepEqual(isCorrectExpected, result[0]);
            assert.deepEqual(matchTextExpected, result[1]);
        };

        checkResult(true,  'Correct.',                            Answers.answerIsCorrect('A is first',  'A is first|B is second', setspec));
        checkResult(true,  'Correct.',                            Answers.answerIsCorrect('B is second', 'A is first|B is second', setspec));

        checkResult(false, 'Incorrect. The correct answer is A is first.', Answers.answerIsCorrect('C',  'A is first|B is second', setspec));
        checkResult(false, 'The correct answer is A is first.',            Answers.answerIsCorrect('',   'A is first|B is second', setspec));
        checkResult(false, 'Incorrect. The correct answer is A is first.', Answers.answerIsCorrect(null, 'A is first|B is second', setspec));
    });

    unit_test("simple edit dist", function(logger) {
        var checkResult = function(isCorrectExpected, matchTextExpected, result) {
            logger.log("checkResult:",
                displayify({'isCorrectExpected': isCorrectExpected, 'matchTextExpected': matchTextExpected}),
                "GOT:",
                displayify(result)
            );
            assert.deepEqual(isCorrectExpected, result[0]);
            assert.deepEqual(matchTextExpected, result[1]);
        };

        checkResult(true,  "Close enough to the correct answer 'ABCDEFGHIJK'.", Answers.answerIsCorrect('ABCDEFGHIJZ', 'ABCDEFGHIJK',   setspec));
        checkResult(true,  "Close enough to the correct answer 'ABCDEFGHIJK'.", Answers.answerIsCorrect('ABCDEFGHIJZ', 'ABCDEFGHIJK|B', setspec));
    });

    unit_test("branching", function(logger){
        var checkResult = function(isCorrectExpected, matchTextExpected, result) {
            logger.log("checkResult:",
                displayify({'isCorrectExpected': isCorrectExpected, 'matchTextExpected': matchTextExpected}),
                "GOT:",
                displayify(result)
            );
            assert.deepEqual(isCorrectExpected, result[0]);
            assert.deepEqual(matchTextExpected, result[1]);
        };

        var correct;

        correct = 'ten letter~Correct 1;ab+c~Wrong 1;.*~Wrong 2';
        checkResult(true,  "Correct 1", Answers.answerIsCorrect('ten letter', correct, setspec));
        checkResult(true,  "Correct 1 (you were close enough)", Answers.answerIsCorrect('ten letterX', correct, setspec));
        checkResult(false, "Wrong 1",   Answers.answerIsCorrect('abc',        correct, setspec));
        checkResult(false, "Wrong 2",   Answers.answerIsCorrect('ooops',      correct, setspec));

        correct = 'ten letter|xyz~Correct 1;ab+c~Wrong 1;.*~Wrong 2';
        checkResult(true,  "Correct 1", Answers.answerIsCorrect('ten letter',  correct, setspec));
        checkResult(true,  "Correct 1 (you were close enough)", Answers.answerIsCorrect('ten letterz', correct, setspec));
        checkResult(true,  "Correct 1", Answers.answerIsCorrect('xyz',         correct, setspec));
        checkResult(false, "Wrong 1",   Answers.answerIsCorrect('abc',         correct, setspec));
        checkResult(false, "Wrong 2",   Answers.answerIsCorrect('ooops',       correct, setspec));
    });
});

test_report();
