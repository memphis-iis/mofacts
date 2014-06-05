//TODO: actually use the assessment session

//TODO: make sure everything is zero-based (e.g. permutefinalresult is currently 1-based)

AssessmentSession = {
    //Given an array of clusters (from a simulus file), a unit 
    //(from a TDF), and the unit number (since the schedule needs
    //that info) - create a schedule using the assessmentsession
    //settings in the unit as applied to the clusters
    createSchedule: function(clusters, unitNumber, unit) {
        //First get the setting we'll use
        var settings = AssessmentSession.loadAssessmentSettings(unit);
        console.log("ASSESSMENT SESSION LOADED FOR SCHEDULE CREATION");
        console.log(settings);
        
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
    },
    
    //Given a unit object loaded from a TDF, populate and return a settings
    //object with the parameters as specified by the Assessment Session
    loadAssessmentSettings: function(unit) {
        var settings = {
            groupNames: [],
            templateSizes: [],
            numTemplatesList: [],
            initialPositions: [],
            groups: [],
            randomClusters: false,
            randomConditions: false,
            scheduleSize: 0,
            finalPermute: [],
            ranChoices: 0,
            clusterNumbers: []
        };
        
        if (!unit || !unit.assessmentsession) {
            return settings;
        }
        
        var assess = Helpers.firstElement(unit.assessmentsession);
        if (!assess) {
            return settings;
        }

        //Some simple helpers for parsing
        var parseVals = function(src, dest) {
            if (!src) {
                return;
            }
            var fields = Helpers.trim(src).split(" ");
            for(var i = 0; i < fields.length; ++i) {
                var fld = Helpers.trim(fields[i]);
                if (fld && fld.length > 0) {
                    dest.push(fld);
                }
            }
        }
        
        var boolVal = function(src) {
            return Helpers.display(src).toLowerCase === "true";
        }
        
        var intVal = function(src) {
            var val = parseInt(Helpers.display(src));
            if (isNaN(val)) {
                val = 0;
            }            
            return val;
        }
        
        //The "easy" "top-level" settings
        parseVals(assess.initialpositions, settings.initialPositions);
        parseVals(assess.permutefinalresult, settings.finalPermute);        
        settings.randomClusters = boolVal(assess.assignrandomclusters);
        settings.randomConditions = boolVal(assess.randomizegroups);
        settings.ranChoices = intVal(assess.randomchoices);
        
        //Condition by group        
        by_group = Helpers.firstElement(assess.conditiontemplatesbygroup);
        if (by_group) {
            parseVals(by_group.groupnames,        settings.groupNames);
            parseVals(by_group.clustersrepeated,  settings.templateSizes);
            parseVals(by_group.templatesrepeated, settings.numTemplatesList);
            parseVals(by_group.initialpositions,  settings.initialPositions);
            
            var new_group = [];
            parseVals(by_group.group, new_group);
            if (new_group.length > 0) {
                settings.groups.push(new_group);
            }
        }
        
        //Cluster Numbers
        var clusterList = [];
        parseVals(assess.clusterlist, clusterList);
        for (var i = 0; i < clusterList.length; ++i) {
            var cluster = clusterList[i];
            var idx = cluster.indexOf("-");
            if (idx < 1) {
                continue; //Invalid format
            }
            
            var first = intVal(cluster.substring(0, idx));
            var last  = intVal(cluster.substring(idx+1));
            if (last < first) {
                continue; //Invalid format
            }
            
            for (var r = first; r <= last; ++r) {
                settings.clusterNumbers.push(r);
            }
        }
        
        return settings;
    }
};
