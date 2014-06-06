/* AssessmentSession - this is the main logic for loading the necessary
 * data from the TDF and Stimulus files and creating a schedule based
 * on the assessment session configuration.
 * */


//TODO: if you want the assessment session format to be completely
//      consistent, then the initial positions should be zero based
//      (currently one-based, so A_1 would become A_0 and so on). Most
//      of the change should be to the TDF files since only one line
//      should need to changed (look for a "NOTE" comment around line
//      93 or so).


AssessmentSession = {
    /* Create a schedule using the assessmentsession settings in the
     * unit as applied to the clusters
     * 
     * INPUTS:
     *  setspec - the setspec object from the TDF
     *  clusters - array of clusters (from the stimulus file)
     *  unitNumber - number (index, 0-based) of the unit in the TDF
     *  unit - current unit (as specified by unitNumber)
     * 
     * RETURNS: a schedule object
     * 
     * NOTE: this is the "public" version, which is just a try-catch
     *       wrapper around createScheduleImpl
    */
    createSchedule: function(setspec, clusters, unitNumber, unit) {
        try {
            return AssessmentSession.createScheduleImpl(setspec, clusters, unitNumber, unit);
        }
        catch(e) {
            console.log("Error creating a schedule from the assessment session in the TDF...");
            console.log(e);
            return null;
        }
    },
    
    //"Private" implmentation version of createSchedule - should really
    //be wrapped in an exception handler (see createSchedule for
    //parameter descriptions)
    createScheduleImpl: function(setspec, clusters, unitNumber, unit) {
        //First get the setting we'll use
        var settings = AssessmentSession.loadAssessmentSettings(setspec, unit);
        console.log("ASSESSMENT SESSION LOADED FOR SCHEDULE CREATION");
        console.log(settings);
        
        //Shuffle clusters at start
        if (settings.randomClusters) {
            Helpers.shuffle(settings.clusterNumbers);
        }
        
        //Our question array should be pre-populated
        //Remember that addressing a javascript array index forces the
        //expansion of the array to that index
        var quests = [];
        quests[settings.scheduleSize-1] = {};
        
        //How you set a question
        var setQuest = function(qidx, type, clusterIndex, condition) {
            quests[qidx] = {
                testType: type,
                clusterIndex: clusterIndex,
                condition: condition
            };
        };
        
        //For each group
        for (var i = 0; i < settings.groupNames.length; ++i) {
            //Get initial info for this group
            var groupName = settings.groupNames[i];
            var group = settings.groups[i]; //group = array of strings
            var numTemplates = Helpers.intVal(settings.numTemplatesList[i]);
            var templateSize = Helpers.intVal(settings.templateSizes[i]);
            
            //Generate template indices
            var indices = [];
            for (var z = 0; z < numTemplates; ++z) {
                indices.push(z);
            }
            if (settings.randomConditions) {
                Helpers.shuffle(indices);
            }
            
            //For each template index
            for (var j = 0; j < indices.length; ++j) {
                var index = indices[j];
                
                //Find in initial position
                var firstPos;
                for(firstPos = 0; firstPos < settings.initialPositions.length; ++firstPos) {
                    var entry = settings.initialPositions[firstPos];
                    //NOTE the 1-based assumption for initial position values
                    if (groupName === entry[0] && Helpers.intVal(entry.substring(2)) == index + 1) {
                        break; //FOUND
                    }
                }
                
                //Remove and use first cluster no matter what
                var clusterNum = settings.clusterNumbers.shift();
                
                //If we didn't find the group, move to next group
                if (firstPos >= settings.initialPositions.length) {
                    break;
                }
                
                //Choose random numbers to use throughout the template
                var randOffset = Math.floor(Math.random() * settings.clusterSize);
                
                //Work through the group elements
                for (var k = 0; k < templateSize; ++k) {
                    var groupEntry = group[index * templateSize + k];
                    var parts = groupEntry.split(",");
                    
                    var forward = true; //Note that we ignore the f/b setting in the group
                    
                    var type = parts[2].toUpperCase()[0];
                    if (type === "T") {
                        type = "D";
                    }
                    
                    var showHint = false;
                    if (parts[2].length > 1) {
                        showHint = (parts[2].toUpperCase()[1] === "H");
                    }
                    
                    var location = Helpers.intVal(parts[3]);
                    
                    //For proto, re-randomize for every k
                    if (settings.specType === "proto") {
                        randOffset = Math.floor(Math.random() * settings.clusterSize);
                    }
                    
                    var offStr = parts[0].toLowerCase();
                    if (offStr === "m") {
                        //Trial from model
                        setQuest(firstPos + location, type, 0, "select_"+type);
                    }
                    else {
                        //Trial by other means
                        var offset;
                        if (offStr === "r") {
                            offset = Math.floor(Math.random() * settings.ranChoices);
                        }
                        else {
                            offset = Helpers.intVal(offStr);
                        }
                        
                        var condition = groupName + "-" + index;
                        
                        var st = settings.specType.toLowerCase();
                        if ( (settings.clusterSize == 1) && (st === "structuralpairs" || st === "structuralgroups") ) {
                            condition += "-" + offset + "-0";
                            offset = 0;
                        }
                        
                        if (showHint) {
                            condition += "-" + "H";
                        }
                        
                        var pairNum = settings.clusterSize * clusterNum + offset;
                        setQuest(firstPos + location, type, pairNum, condition);
                    } //offset is Model or something else?
                } //k (walk thru group elements)
            } //j (each template index)
        } //i (each group)
        
        //NOW we can create the final ordering of the questions
        var finalQuests = [];
        finalQuests[settings.scheduleSize-1] = {};
        
        for (var i = 0; i < settings.finalPermute.length; ++i) {
            var targetIndexes = Helpers.rangeVal(settings.finalPermute[i]);
            var randPerm = targetIndexes.slice(); //clone
            Helpers.shuffle(randPerm);
            
            for(var j = 0; j < targetIndexes.length; ++j) {
                finalQuests[targetIndexes[j]] = quests[randPerm[j]];
            }
        }
        
        //Note that our cardTemplate.js code has some fancy permutation
        //logic, but that we don't currently use it from the assessment
        //session
        var schedule = {
            unitNumber: unitNumber,
            created: new Date(),
            permute: null,
            q: finalQuests
        };
        
        console.log("Created schedule for current unit:");
        console.log(schedule);
        
        return schedule;
    },
    
    //Given a unit object loaded from a TDF, populate and return a settings
    //object with the parameters as specified by the Assessment Session
    loadAssessmentSettings: function(setspec, unit) {
        var settings = {
            clusterSize: 1,
            specType: "unspecified",
            groupNames: [],
            templateSizes: [],
            numTemplatesList: [],
            initialPositions: [],
            groups: [],
            randomClusters: false,
            randomConditions: false,
            scheduleSize: 0,
            finalPermute: [],
            clusterNumbers: [],
            ranChoices: 0
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
        
        //Get the setspec settings first
        settings.clusterSize = Helpers.intVal(setspec.clustersize);
        settings.specType = Helpers.display(setspec.clustermodel);
        
        //The "easy" "top-level" settings
        parseVals(assess.initialpositions, settings.initialPositions);
        parseVals(assess.permutefinalresult, settings.finalPermute);        
        settings.randomClusters = boolVal(assess.assignrandomclusters);
        settings.randomConditions = boolVal(assess.randomizegroups);
        settings.ranChoices = Helpers.intVal(assess.randomchoices);
        
        //Condition by group        
        by_group = Helpers.firstElement(assess.conditiontemplatesbygroup);
        if (by_group) {
            parseVals(by_group.groupnames,        settings.groupNames);
            parseVals(by_group.clustersrepeated,  settings.templateSizes);
            parseVals(by_group.templatesrepeated, settings.numTemplatesList);
            parseVals(by_group.initialpositions,  settings.initialPositions);
            
            var new_group = [];
            parseVals(by_group.group[0], new_group);
            if (new_group.length > 0) {
                settings.groups.push(new_group);
            }
        }
        
        //Now that all possible changes to initial positions have been 
        //done, we know our schedule size
        settings.scheduleSize = settings.initialPositions.length;
        
        //Cluster Numbers
        var clusterList = [];
        parseVals(assess.clusterlist, clusterList);
        for (var i = 0; i < clusterList.length; ++i) {
            var nums = Helpers.rangeVal(clusterList[i]);
            for (var j = 0; j < nums.length; ++j) {
                settings.clusterNumbers.push(nums[j]);
            }
        }
        
        return settings;
    }
};
