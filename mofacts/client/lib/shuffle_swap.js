//Given a cluster count, a shuffleclusters string, and a swapclusters string,
//create a mapping vector. The idea is that for cluster x, mapping[x] returns
//a translated index. Note that the default mapping is identity, so that
//mapping[x] = x HOWEVER, the user may submit a different default mapping.
//This is mainly so that multiple shuffle/swap pairs can be run. ALSO important
//is the fact that additional elements will be added if
//mapping.length < clusterCount

createStimClusterMapping = function(clusterCount, shuffleclusters, swapclusters, startMapping) {
    if (clusterCount < 1)
        return [];

    var i;

    //Default mapping is identity - mapping[x] == x
    //We also need to make sure we have clusterCount elements
    var mapping = (startMapping || []).slice(); //they get a copy back
    while (mapping.length < clusterCount) {
        mapping.push(mapping.length);
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

    //Swap out sections of clusters (one step up from our shuffle above)
    if (!!swapclusters) {
        //Get the chunks that we'll be swapping. Each chunk is in the format
        //of an array of integral indexes (after the map). We actually get
        //TWO lists of chunks - one in order and one that is the actual swap
        var ranges = [];
        Helpers.extractDelimFields(swapclusters, ranges);
        var swapChunks = _.map(ranges, Helpers.rangeVal);
        var sortChunks = _.map(ranges, Helpers.rangeVal);

        //Now insure our sorted chunks are actually in order - we sort
        //numerically by the first index
        sortChunks.sort(function(lhs, rhs) {
            var lv = lhs[0], rv = rhs[0];
            if      (lv < rv) return -1;
            else if (lv > rv) return 1;
            else              return 0;
        });

        //Now get a permuted copy of our chunks
        Helpers.shuffle(swapChunks);

        var swapped = [];
        i = 0;
        while (i < mapping.length) {
            if (sortChunks.length > 0 && i == sortChunks[0][0]) {
                //Swap chunk - grab the permuted chunk and add the mapped numbers
                var chunk = swapChunks.shift();
                for (var chunkIdx = 0; chunkIdx < chunk.length; ++chunkIdx) {
                    swapped.push(mapping[chunk[chunkIdx]]);
                }

                //advance to the next chunk
                i += sortChunks.shift().length;
            }
            else {
                //Not part of a swapped chunk - keep this number and just move
                //to the next number
                swapped.push(mapping[i]);
                i++;
            }
        }

        //All done
        mapping = swapped.slice();
    }

    return mapping;
};
