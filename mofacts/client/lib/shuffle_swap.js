//Given a cluster count, a shuffleclusters string, and a swapclusters string,
//create a mapping vector. The idea is that for cluster x, mapping[x] returns
//a translated index. Note that the default mapping is identity, so that
//mapping[x] = x

createStimClusterMapping = function(clusterCount, shuffleclusters, swapclusters) {
    if (clusterCount < 1)
        return [];

    //Default mapping is identity - mapping[x] == x
    var mapping = [];
    for(var i = 0; i < clusterCount; ++i) {
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

    if (!!swapclusters) {
        //TODO
    }

    return mapping;
};
