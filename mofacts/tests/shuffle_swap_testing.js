require("./dinky_test.js");

require("../lib/globalHelpers.js");
require("../common/Helpers.js");
require("../client/lib/shuffle_swap.js");

test_suite("shuffle_swap", function() {
    var in_order = function(arr) {
        for(var i = 1; i < arr.length; ++i) {
            if (arr[i-1] != arr[i] - 1) {
                return false;
            }
        }
        return true;
    };

    var min_max = function(arr) {
        var mn = arr[0];
        var mx = mn;
        for(var i = 1; i < arr.length; ++i) {
            var val = arr[i];
            if (val < mn) mn = val;
            if (val > mx) mx = val;
        }
        return [mn, mx];
    };

    unit_test("No Ops", function(logger) {
        assert.deepEqual([], createStimClusterMapping(0));
        assert.deepEqual([0,1], createStimClusterMapping(2));
        assert.deepEqual([0,1,2], createStimClusterMapping(3, "", ""));
        assert.deepEqual([0,1,2,3], createStimClusterMapping(4, null, null));
    });

    unit_test("Previous Ops", function(logger){
        assert.deepEqual([7,8,9], createStimClusterMapping(3, "", "", [7,8,9]));
        assert.deepEqual([5,4,3,2], createStimClusterMapping(4, null, null, [5,4,3,2]));
        //Test short array
        assert.deepEqual([7,8,9,3], createStimClusterMapping(4, "", "", [7,8,9]));
    });

    unit_test("Shuffle Only", function(logger) {
        var mapping;

        mapping = createStimClusterMapping(10, "0-9", "");
        assert.equal(false, in_order(mapping));
        assert.deepEqual([0,9], min_max(mapping));
        assert.equal(10, _.uniq(mapping).length);

        mapping = createStimClusterMapping(10, "0-4 5-9", "");
        assert.equal(false, in_order(mapping));
        assert.deepEqual([0,9], min_max(mapping));
        assert.equal(10, _.uniq(mapping).length);

        assert.equal(false, in_order(mapping.slice(0,5)));
        assert.deepEqual([0,4], min_max(mapping.slice(0,5)));
        assert.equal(5, _.uniq(mapping.slice(0,5)).length);

        assert.equal(false, in_order(mapping.slice(5)));
        assert.deepEqual([5,9], min_max(mapping.slice(5)));
        assert.equal(5, _.uniq(mapping.slice(5)).length);
    });

    unit_test("Swap Only", function(logger) {
        var mapping;
        var c;

        //Vanilla swaps - same size, contiguous, and covering
        logger.log("Vanilla swaps");
        c = 0;
        while (c < 10) {
            mapping = createStimClusterMapping(10, "", "0-4 5-9");
            logger.log("Order ==", in_order(mapping), mapping);
            if (!in_order(mapping))
                break;
            c++;
        }

        assert.equal(true, c < 10, "no shuffling in 10 tries?");
        assert.deepEqual([5,6,7,8,9,0,1,2,3,4], mapping);

        //Hard swaps - non-contiguous and differently sized
        logger.log("Hard swaps");
        c = 0;
        while (c < 10) {
            mapping = createStimClusterMapping(10, "", "1-4 6-8");
            logger.log("Order ==", in_order(mapping), mapping);
            if (!in_order(mapping))
                break;
            c++;
        }

        assert.equal(true, c < 10, "no shuffling in 10 tries?");
        assert.deepEqual([0,6,7,8,5,1,2,3,4,9], mapping);
    });

    unit_test("Swap Only - Previous Val", function(logger) {
        var mapping;
        var c;

        //Hard swaps - non-contiguous and differently sized
        logger.log("Hard swaps with previous");
        c = 0;
        while (c < 10) {
            mapping = createStimClusterMapping(10, "", "1-4 6-8", [-42,1,2,3,4,42,6,7,8,84]);
            //Can't use in order, so use a more manual check
            if (mapping[1] == 6)
                break;
            c++;
        }

        logger.log("Mapping found is", mapping);

        assert.equal(true, c < 10, "no shuffling in 10 tries?");
        assert.deepEqual([-42,6,7,8,42,1,2,3,4,84], mapping);
    });

    unit_test("Shuffle and Swap", function(logger) {
        var mapping;

        mapping = createStimClusterMapping(10, "0-4 5-9", "0-4 5-9");
        assert.equal(false, in_order(mapping));
        assert.deepEqual([0,9], min_max(mapping));
        assert.equal(10, _.uniq(mapping).length);

        var shuf1 = false, shuf2 = false, c = 0;
        while ( !(shuf1 && shuf2) && (++c < 20) ) {
            mapping = createStimClusterMapping(10, "0-4 5-9", "0-4 5-9");
            logger.log(mapping);
            if (in_order(mapping.slice(0,5)) || in_order(mapping.slice(5))) {
                logger.log("rejected");
                continue; //We want everything shuffled
            }

            if (mapping[0] < mapping[5]) {
                shuf1 = true;
                assert.deepEqual([0,4], min_max(mapping.slice(0,5)));
                assert.equal(5, _.uniq(mapping.slice(0,5)).length);

                assert.deepEqual([5,9], min_max(mapping.slice(5)));
                assert.equal(5, _.uniq(mapping.slice(5)).length);
            }
            else {
                shuf2 = true;
                assert.deepEqual([0,4], min_max(mapping.slice(5)));
                assert.equal(5, _.uniq(mapping.slice(5)).length);

                assert.deepEqual([5,9], min_max(mapping.slice(0,5)));
                assert.equal(5, _.uniq(mapping.slice(0,5)).length);
            }
        }

        assert.equal(true, c < 20, "no shuffling in 20 tries?");
    });
});

test_report();
