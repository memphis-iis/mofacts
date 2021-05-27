/* experiment_times.js
 *
 * This script exports all user trial information in the DataShop tab-delimited
 * format a given experiment in.
 *
 * A note concerning indexes
 * ***************************
 *
 * It can be confusing to keep track of what is 0-indexed and what is
 * 1-indexed in this system. The two main things to watch out for are
 * questionIndex and schedule item (question condition).
 *
 * questionIndex refers to the 0-based array of questions in the schedule
 * and is treated as a zero-based index while trials are being conducted
 * (see card.js). However, when it is written to the userTimes log
 * as a field (for question/action/[timeout] actions) it is written as a
 * 1-based field.
 *
 * When a schedule is created from an assessment session, there is a condition
 * field written which corresponds the entry in the "initialpositions" section
 * of the assessment session. In the TDF, these positions are given by group
 * name and 1-based index (e.g. A_1, A_2, B_1). However, the condition in the
 * schedule item is written 0-based (e.g. A-0).
 * */

import { getTdfByFileName, getStimuliSetById, getHistoryByTDFfileName, getListOfStimTags } from "./methods";
import { outputFields } from "../common/Definitions";
import { getHistory } from "../server/orm";

(async function () { //Begin IIFE pattern
    let FIELDSDS = JSON.parse(JSON.stringify(outputFields));
    
    //Helper to transform our output record into a delimited record
    function delimitedRecord(rec) {
        var vals = new Array(FIELDSDS.length);
        for (var i = 0; i < FIELDSDS.length; ++i) {
            vals[i] = _.trim(rec[FIELDSDS[i]])
                .replace(/\s+/gm, ' ')   //Norm ws and remove non-space ws
                .slice(0, 255)           //Respect len limits for data shop
                .replace(/\s+$/gm, '');  //Might have revealed embedded space at end
        }

        return vals.join('\t');
    }

    getValuesOfStimTagList = async function(tdfFileName, clusterKC,stimulusKC,tagList){
        console.log("getValuesOfStimTagList:",tdfFileName,clusterIndex,stimIndex,tagList);
        const tdf = await getTdfByFileName(tdfFileName);
        const stimuliSetId = tdf.stimuliSetId;
        const stimuliSet = await getStimuliSetById(stimuliSetId);
        let curStimSet = stimuliSet.find(x => x.clusterKC==clusterKC && x.stimulusKC==stimulusKC);
        console.log("getValuesOfStimTagList:",typeof(curStimSet),Object.keys(curStimSet || {}));
        let valueDict = {};

        for(var tag of tagList){
            for(let stim of curStimSet){
                if(!valueDict[tag] && stim.tags){
                    valueDict[tag] = stim.tags[tag] || "";
                }else{
                    valueDict[tag] = "";
                }
            }
        }

        return valueDict;
    }

    // Exported main function: call recordAcceptor with each record generated
    // for expName in datashop format. We do NOT terminate our records.
    // We return the number of records written
    createExperimentExport = async function (expName, format, recordAcceptor) {
        var header = {};
        var expNames = [];
        
        if (_.isString(expName)) {
            expNames.push(expName);
        } else {
            expNames = expName;
        }

        const listOfDynamicStimTags = await getListOfStimTags(expName);
        let listOfDynamicStimTagsWithColumnNames = [];
        for(let tag of listOfDynamicStimTags){
            listOfDynamicStimTagsWithColumnNames.push("CF (" + tag + ")");
        }

        FIELDSDS = FIELDSDS.concat(listOfDynamicStimTagsWithColumnNames);

        FIELDSDS.forEach(async function (f) {
            var prefix = f.substr(0, 14);

            var t;
            if (prefix === 'Condition Name') {
                t = 'Condition Name';
            }else if (prefix === 'Condition Type') {
                t = 'Condition Type';
            }else {
                t = f;
            }

            header[f] = t;
        });

        recordAcceptor(delimitedRecord(header));
        var recordCount = 1;

        Meteor.call("updatePerformanceData","utlQuery","experiment_times.createExperimentExport","SERVER_REPORT");

        expNames.forEach(async function(expName) {
            const histories = await getHistoryByTDFfileName(expName);
            for(let history of histories){
                try {
                    let clusterKC = history.kc_cluster;
                    let stimulusKC = history.cf_stimulus_version;
                    console.log("history:",history.kc_cluster,clusterKC,stimulusKC,history);
                    history = getHistory(history);
                    const dynamicStimTagValues = await getValuesOfStimTagList(expName, clusterKC, stimulusKC, listOfDynamicStimTags);
        
                    for(let tag of Object.keys(dynamicStimTagValues)){
                        history.dynamicTagFields["CF (" + tag + ")"] = dynamicStimTagValues[tag];
                    }
                    recordCount++;
                    recordAcceptor(delimitedRecord(history));
                }catch (e) {
                    serverConsole("There was an error populating the record - it will be skipped", e, e.stack);
                }
            }
        });

        return recordCount;
    };
})(); //end IIFE
