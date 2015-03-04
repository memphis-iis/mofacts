require("./dinky_test.js");

require("../common/Helpers.js");
require("../client/lib/shuffle_swap.js");

test_suite("permutefinal", function() {
    unit_test("No Ops", function(logger) {
        assert.deepEqual([], createStimClusterMapping(0));
        assert.deepEqual([0,1], createStimClusterMapping(2));
        assert.deepEqual([0,1,2], createStimClusterMapping(3, "", ""));
        assert.deepEqual([0,1,2,3], createStimClusterMapping(4, null, null));
    });

    unit_test("Shuffle Only", function(logger) {
        //TODO
    });

    unit_test("Swap Only", function(logger) {
        //TODO
    });

    unit_test("Shuffle and Swap", function(logger) {
        //TODO
    });
});

test_report();
