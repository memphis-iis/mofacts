//Given a cluster count, a shuffleclusters string, and a swapclusters string,
//create a mapping vector. The idea is that for cluster x, mapping[x] returns
//a translated index. Note that the default mapping is identity, so that
//mapping[x] = x

createStimClusterMapping = function(clusterCount, shuffleclusters, swapclusters) {
    if (clusterCount < 1)
        return [];

    var i;

    //Default mapping is identity - mapping[x] == x
    var mapping = [];
    for(i = 0; i < clusterCount; ++i) {
        mapping.push(i);
    }

    //Shufle the given ranges of cards (like permutefinalresult)
    if (!!shuffleclusters) {
        var shuffleRanges = [];
        Helpers.extractDelimFields(shuffleclusters, shuffleRanges);

        var shuffled = mapping.slice(); //work on a copy

        _.each(shuffleRanges, function(rng) {
            var targetIndexes = Helpers.rangeVal(rng);
            var randPerm = targetIndexes.slice(); //clone
            Helpers.shuffle(randPerm);

            for(j = 0; j < targetIndexes.length; ++j) {
                shuffled[targetIndexes[j]] = mapping[randPerm[j]];
            }
        });

        mapping = shuffled.slice();
    }

    //TODO: Phil - should we blow up if the shuffle size are unequal?
    //Swap out sections of clusters (one step up from our shuffle above)
    if (!!swapclusters) {
        var rangeFlatten = function(ranges) {
            var output = [];
            _.each(ranges, function(rng) {
                Helpers.rangeVal(rng).forEach(function(num) {
                    output.push(num);
                });
            });
            return output;
        };

        var swapRangesSrc = [];
        Helpers.extractDelimFields(swapclusters, swapRangesSrc);
        var swapIndexSrc = rangeFlatten(swapRangesSrc);

        var swapRangesDest = swapRangesSrc.slice();
        Helpers.shuffle(swapRangesDest);
        var swapIndexDest = rangeFlatten(swapRangesDest);

        var swapped = mapping.slice(); //work on a copy

        for(i = 0; i < swapIndexSrc.length; ++i) {
            swapped[swapIndexSrc[i]] = mapping[swapIndexDest[i]];
        }

        mapping = swapped.slice();
    }

    return mapping;
};
