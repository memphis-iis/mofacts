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

    if (!!shuffleclusters) {
        //TODO
    }

    if (!!swapclusters) {
        //TODO
    }

    return mapping;
};
