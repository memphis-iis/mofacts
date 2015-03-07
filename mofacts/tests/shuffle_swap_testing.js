require("./dinky_test.js");

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

        var c = 0;
        while (c < 10) {
            mapping = createStimClusterMapping(10, "", "0-4 5-9");
            if (!in_order(mapping))
                break;
            c++;
        }

        assert.equal(true, c < 10, "no shuffling in 10 tries?");
        assert.deepEqual([5,6,7,8,9,0,1,2,3,4], mapping);
    });

    unit_test("Shuffle and Swap", function(logger) {
        var mapping;

        mapping = createStimClusterMapping(10, "0-4 5-9", "0-4 5-9");
        assert.equal(false, in_order(mapping));
        assert.deepEqual([0,9], min_max(mapping));
        assert.equal(10, _.uniq(mapping).length);

        var shuf1 = false, shuf2 = false;

        var c = 0;
        while ( !(shuf1 && shuf2) ) {
            mapping = createStimClusterMapping(10, "0-4 5-9", "0-4 5-9");
            console.log(mapping);
            if (mapping[0] < mapping[5]) {
                shuf1 = true;
                assert.equal(false, in_order(mapping.slice(0,5)));
                assert.deepEqual([0,4], min_max(mapping.slice(0,5)));
                assert.equal(5, _.uniq(mapping.slice(0,5)).length);

                assert.equal(false, in_order(mapping.slice(5)));
                assert.deepEqual([5,9], min_max(mapping.slice(5)));
                assert.equal(5, _.uniq(mapping.slice(5)).length);
            }
            else {
                shuf2 = true;
                assert.equal(false, in_order(mapping.slice(5)));
                assert.deepEqual([0,4], min_max(mapping.slice(5)));
                assert.equal(5, _.uniq(mapping.slice(5)).length);

                assert.equal(false, in_order(mapping.slice(0,5)));
                assert.deepEqual([5,9], min_max(mapping.slice(0,5)));
                assert.equal(5, _.uniq(mapping.slice(0,5)).length);
            }

            if (++c >= 10) {
                break;
            }
        }

        assert.equal(true, c < 10, "no shuffling in 10 tries?");
    });
});

test_report();
