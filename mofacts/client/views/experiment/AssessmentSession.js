import { shuffle, extractDelimFields, randomChoice, rangeVal, getStimCount, createStimClusterMapping } from '../../lib/currentTestingHelpers';

/* AssessmentSession - this is the main logic for loading the necessary
 * data from the TDF and Stimulus files and creating a schedule based
 * on the assessment session configuration.
 * */

AssessmentSession = {
    /* Create a schedule using the assessmentsession settings in the
     * unit as applied to the clusters in the stimulus file
     *
     * INPUTS:
     *  setspec - the setspec object from the TDF
     *  unitNumber - number (index, 0-based) of the unit in the TDF
     *  unit - current unit (as specified by unitNumber)
     *
     * RETURNS: a schedule object
     *
     * Note: this is the "public" version, which is just a try-catch
     *       wrapper around createScheduleImpl
    */
    createSchedule: function(setspec, unitNumber, unit) {
        var schedule;

        try {
            schedule = AssessmentSession.createScheduleImpl(setspec, unitNumber, unit);
        }
        catch(e) {
            if (console && console.log) {
                console.log("Error creating a schedule from the assessment session in the TDF...");
                console.log("ERROR", displayify(e));
                console.log("unitnumber", displayify(unitNumber));
                console.log("setspec", displayify(setspec));
                console.log("unit", displayify(unit));
            }
            return null;
        }

        //Here is where we can actually throw an exception back to our caller:
        //Currently that's just if we create a schedule with null q entries
        var nullCount = 0;
        _.each(schedule.q, function(entry) {
            if (entry === null) {
                nullCount++;
            }
        });
        if (nullCount > 0) {
            console.log("About to throw exception for bad schedule", schedule);
            throw "The newly created schedule contains " + nullCount + " null question entries";
        }

        return schedule;
    },

    //"Private" implementation version of createSchedule - should really
    //be wrapped in an exception handler (see createSchedule for
    //parameter descriptions)
    createScheduleImpl: function(setspec, unitNumber, unit) {
        //First get the setting we'll use
        var settings = AssessmentSession.loadAssessmentSettings(setspec, unit);
        console.log("ASSESSMENT SESSION LOADED FOR SCHEDULE CREATION");
        console.log("settings:",settings);

        //Shuffle clusters at start
        if (settings.randomClusters) {
            shuffle(settings.clusterNumbers);
        }

        //Our question array should be pre-populated
        //Remember that addressing a javascript array index forces the
        //expansion of the array to that index
        var quests = [];
        quests[settings.scheduleSize-1] = {};

        //How you set a question
        var setQuest = function(qidx, type, clusterIndex, condition, whichStim, forceButtonTrial) {
            quests[qidx] = {
                testType: type.toLowerCase(),
                clusterIndex: clusterIndex,
                condition: condition,
                whichStim : whichStim,
                forceButtonTrial: forceButtonTrial
            };
        };

        var i, j, k, z; //Loop indices

        //For each group
        for (i = 0; i < settings.groupNames.length; ++i) {
            //Get initial info for this group
            var groupName = settings.groupNames[i];
            var group = settings.groups[i]; //group = array of strings
            var numTemplates = _.intval(settings.numTemplatesList[i]);
            var templateSize = _.intval(settings.templateSizes[i]);

            //Generate template indices
            var indices = [];
            for (z = 0; z < numTemplates; ++z) {
                indices.push(z);
            }
            if (settings.randomConditions) {
                shuffle(indices);
            }

            //For each template index
            for (j = 0; j < indices.length; ++j) {
                var index = indices[j];

                //Find in initial position
                var firstPos;
                for(firstPos = 0; firstPos < settings.initialPositions.length; ++firstPos) {
                    var entry = settings.initialPositions[firstPos];
                    //Note the 1-based assumption for initial position values
                    if (groupName === entry[0] && _.intval(entry.substring(2)) == index + 1) {
                        break; //FOUND
                    }
                }

                //Remove and use first cluster no matter what
                var clusterNum = settings.clusterNumbers.shift();

                //If we didn't find the group, move to next group
                if (firstPos >= settings.initialPositions.length) {
                    break;
                }

                //Work through the group elements
                for (k = 0; k < templateSize; ++k) {
                    //"parts" is a comma-delimited entry with 4 components:
                    // 0 - the offset (whichStim) - can be numeric or "r" for random
                    // 1 - legacy was f/b, now "b" forces a button trial
                    // 2 - trial type (t, d, s, m, n, i, f)
                    // 3 - location (added to qidx)
                    var groupEntry = group[index * templateSize + k];
                    var parts = groupEntry.split(",");

                    var forceButtonTrial = false;
                    if (parts[1].toLowerCase()[0] === "b") {
                        forceButtonTrial = true;
                    }

                    var type = parts[2].toUpperCase()[0];

                    if (type === "Z") {
                        var stud = Math.floor(Math.random() * 10);
                        if (stud === 0) {
                            type = "S";
                        } else
                        {
                            type = "D";
                        }
                    }

                    var showHint = false;
                    if (parts[2].length > 1) {
                        showHint = (parts[2].toUpperCase()[1] === "H");
                    }

                    var location = _.intval(parts[3]);

                    var offStr = parts[0].toLowerCase(); //Selects stim from cluster w/ multiple stims
                    if (offStr === "m") {
                        //Trial from model
                        setQuest(firstPos + location, type, 0, "select_"+type, offStr, forceButtonTrial);
                    }
                    else {
                        //Trial by other means
                        var offset;
                        if (offStr === "r") {
                            //See loadAssessmentSettings below - ranChoices should
                            //be populated with the possible offsets already
                            if (settings.ranChoices.length < 1)
                                throw "Random offset, but randomcchoices isn't set";
                            offset = randomChoice(settings.ranChoices);
                        }
                        else {
                            offset = _.intval(offStr);
                        }

                        var condition = groupName + "-" + index;

                        var st = settings.specType.toLowerCase();
                        if ( (st === "structuralpairs" || st === "structuralgroups") ) {
                            condition += "-" + offset + "-0";
                            offset = 0;
                        }

                        if (showHint) {
                            condition += "-" + "H";
                        }

                        var pairNum = clusterNum;
                        setQuest(firstPos + location, type, pairNum, condition, offset, forceButtonTrial);
                    } //offset is Model or something else?
                } //k (walk thru group elements)
            } //j (each template index)
        } //i (each group)

        //NOW we can create the final ordering of the questions - we start with
        //a default copy and then do any final permutation
        var finalQuests = [];
        _.each(quests, function(obj) {
            finalQuests.push(obj);
        });

        // Shuffle and swap final question mapping based on permutefinalresult
        // and swapfinalresults
        if (finalQuests.length > 0) {
            var shuffles = settings.finalPermute || [""];
            var swaps = settings.finalSwap || [""];
            var mapping = _.range(finalQuests.length);

            while(shuffles.length > 0 || swaps.length > 0) {
                mapping = createStimClusterMapping(
                    finalQuests.length,
                    shuffles.shift() || "",
                    swaps.shift() || "",
                    mapping
                );
            }

            console.log("Question swap/shuffle mapping:", displayify(
                _.map(mapping, function(val, idx) {
                    return "q[" + idx + "].cluster==" + quests[idx].clusterIndex +
                      " ==> q[" + val + "].cluster==" + quests[val].clusterIndex;
                })
            ));
            for (j = 0; j < mapping.length; ++j) {
                finalQuests[j] = quests[mapping[j]];
            }
        }

        //Note that our card.js code has some fancy permutation
        //logic, but that we don't currently use it from the assessment
        //session
        var schedule = {
            unitNumber: unitNumber,
            created: new Date(),
            permute: null,
            q: finalQuests,
            isButtonTrial: settings.isButtonTrial
        };

        console.log("Created schedule for current unit:");
        console.log(schedule);

        return schedule;
    },

    //Given a unit object loaded from a TDF, populate and return a settings
    //object with the parameters as specified by the Assessment Session
    loadAssessmentSettings: function(setspec, unit) {
        var settings = {
            specType: "unspecified",
            groupNames: [],
            templateSizes: [],
            numTemplatesList: [],
            initialPositions: [],
            groups: [],
            randomClusters: false,
            randomConditions: false,
            scheduleSize: 0,
            finalSwap: [""],
            finalPermute: [""],
            clusterNumbers: [],
            ranChoices: [],
            isButtonTrial: false,
        };

        if (!unit || !unit.assessmentsession) {
            return settings;
        }

        var rawAssess = _.safefirst(unit.assessmentsession);
        if (!rawAssess) {
            return settings;
        }

        //Everything comes from the asessment session as a single-value array,
        //so just parse all that right now
        var assess = {};
        _.each(rawAssess, function(val, name) {
            assess[name] = _.safefirst(val);
        });

        //Interpret TDF string booleans
        var boolVal = function(src) {
            return _.display(src).toLowerCase() === "true";
        };

        //Get the setspec settings first
        settings.specType = _.display(setspec.clustermodel);

        //We have a few parameters that we need in their "raw" states (as arrays)
        settings.finalSwap = _.prop(rawAssess, "swapfinalresult") || [""];
        settings.finalPermute = _.prop(rawAssess, "permutefinalresult") || [""];

        //The "easy" "top-level" settings
        extractDelimFields(assess.initialpositions, settings.initialPositions);
        settings.randomClusters = boolVal(assess.assignrandomclusters);
        settings.randomConditions = boolVal(assess.randomizegroups);
        settings.isButtonTrial = boolVal(_.safefirst(unit.buttontrial));

        //Unlike finalPermute, which is always a series of space-delimited
        //strings that represent rangeVals, ranChoices can be a single number N
        //(which is equivalent to [0,N) where N is that number) or a rangeVal
        //([X,Y] where the string is X-Y). SO - we convert this into a list of
        //all possible random choices
        var randomChoicesParts = [];
        extractDelimFields(assess.randomchoices, randomChoicesParts);
        _.each(randomChoicesParts, function(item) {
            if (item.indexOf('-') < 0) {
                //Single number - convert to range
                var val = _.intval(item);
                if (!val) {
                    throw "Invalid randomchoices paramter: " + assess.randomchoices;
                }
                item = "0-" + (val-1).toString();
            }

            _.each(rangeVal(item), function(subitem) {
                settings.ranChoices.push(subitem);
            });
        });

        //Condition by group, but remove the default single-val arrays
        //Note: since there could be 0-N group entries, we leave that as an array
        var by_group = {};
        _.each(assess.conditiontemplatesbygroup, function(val, name) {
            by_group[name] = name === "group" ? val : _.safefirst(val);
        });

        if (by_group) {
            extractDelimFields(by_group.groupnames,        settings.groupNames);
            extractDelimFields(by_group.clustersrepeated,  settings.templateSizes);
            extractDelimFields(by_group.templatesrepeated, settings.numTemplatesList);
            extractDelimFields(by_group.initialpositions,  settings.initialPositions);

            _.each(by_group.group, function(tdf_group) {
                var new_group = [];
                extractDelimFields(tdf_group, new_group);
                if (new_group.length > 0) {
                    settings.groups.push(new_group);
                }
            });

            if (settings.groups.length != settings.groupNames.length) {
                console.log("WARNING! Num group names doesn't match num groups", settings.groupNames, settings.groups);
            }
        }

        //Now that all possible changes to initial positions have been
        //done, we know our schedule size
        settings.scheduleSize = settings.initialPositions.length;

        const currentTdfFile = Session.get("currentTdfFile");
        const isMultiTdf = currentTdfFile.isMultiTdf;
        let unitClusterList;

        if(isMultiTdf){
            const curUnitNumber = Session.get("currentUnitNumber");
    
            //NOTE: We are currently assuming that multiTdfs will have only three units: an instruction unit, an assessment session with exactly one question which is the last
            //item in the stim file, and a unit with all clusters specified in the generated subtdfs array
            if(curUnitNumber == 1){
                const lastClusterIndex = getStimCount() - 1;
                unitClusterList = lastClusterIndex + "-" + lastClusterIndex;
            }else{
                const subTdfIndex = Session.get("subTdfIndex");
                unitClusterList = currentTdfFile.subTdfs[subTdfIndex].clusterList;
            }
        }else{
            unitClusterList = assess.clusterlist
        }

        //Cluster Numbers
        let clusterList = [];
        extractDelimFields(unitClusterList, clusterList);
        for (var i = 0; i < clusterList.length; ++i) {
            var nums = rangeVal(clusterList[i]);
            for (var j = 0; j < nums.length; ++j) {
                settings.clusterNumbers.push(_.intval(nums[j]));
            }
        }

        return settings;
    }
};
