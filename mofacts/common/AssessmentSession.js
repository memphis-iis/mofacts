//TODO: actually use the assessment session

AssessmentSession = {
    //Given an array of clusters (from a simulus file), a unit 
    //(from a TDF), and the unit number (since the schedule needs
    //that info) - create a schedule using the assessmentsession
    //settings in the unit as applied to the clusters
    createSchedule: function(clusters, unitNumber, unit) {
        var clusterIdx = [];
        for(i = 0; i < clusters.length; ++i) {
            clusterIdx.push(i);
        }
        clusterIdx = Helpers.shuffle(clusterIdx).slice(0, 4);
        
        console.log("CLUSTER INDEXES FOR SCHEDULE");
        console.log(clusterIdx);
        
        quests = [];
        for(i = 0; i < clusterIdx.length; ++i) {
            var idx = clusterIdx[i];
            quests.push({
                testType: "d",    //TODO: not always a drill 
                clusterIndex: idx
            });
        }
        
        var schedule = {
            unitNumber: unitNumber,
            created: new Date(),
            permute: "0,1|2,3", //TODO: obviously, this needs work
            q: quests
        };
        
        console.log("Created schedule for current unit:");
        console.log(schedule);
        
        return schedule;
    }
};
