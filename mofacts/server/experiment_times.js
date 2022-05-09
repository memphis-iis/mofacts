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

import {
  getTdfByFileName,
  getStimuliSetById,
  getHistoryByTDFfileName,
  getListOfStimTags,
  serverConsole} from './methods';
import {outputFields} from '../common/Definitions';
import {getHistory} from '../server/orm';

export {createExperimentExport};

let FIELDSDS = JSON.parse(JSON.stringify(outputFields));

// Helper to transform our output record into a delimited record
function delimitedRecord(rec, listOfDynamicStimTags, isHeader = false) {
  const vals = new Array(FIELDSDS.length);
  for (let i = 0; i < FIELDSDS.length; ++i) {
    vals[i] = _.trim(rec[FIELDSDS[i]])
        .replace(/\s+/gm, ' ') // Norm ws and remove non-space ws
        .slice(0, 255) // Respect len limits for data shop
        .replace(/\s+$/gm, ''); // Might have revealed embedded space at end
  }
  for(let i = 0; i < listOfDynamicStimTags.length; i++){
    let record = isHeader ? `CF (${listOfDynamicStimTags[i]})` : rec[`CF (${listOfDynamicStimTags[i]})`];
    vals.push(_.trim(record)
      .replace(/\s+/gm, ' ') // Norm ws and remove non-space ws
      .slice(0, 255) // Respect len limits for data shop
      .replace(/\s+$/gm, '')); // Might have revealed embedded space at end
  }

  return vals.join('\t');
}

async function getValuesOfStimTagList(tdfFileName, clusterKC, stimulusKC, tagList) {
  serverConsole('getValuesOfStimTagList:', tdfFileName, clusterKC, stimulusKC, tagList);
  const tdf = await getTdfByFileName(tdfFileName);
  const stimuliSetId = tdf.stimuliSetId;
  const stimuliSet = await getStimuliSetById(stimuliSetId);
  const curStimSet = stimuliSet.find((x) => x.clusterKC==clusterKC && x.stimulusKC==stimulusKC);
  serverConsole('getValuesOfStimTagList:', typeof(curStimSet), Object.keys(curStimSet || {}), curStimSet);
  const valueDict = {};

  for (const tag of tagList) {
    if (!valueDict[tag] && curStimSet.tags) {
      valueDict[tag] = curStimSet.tags[tag] || '';
      console.log("valueDict[" + tag + "]: " + valueDict[tag]);
    } else {
      valueDict[tag] = '';
    }
  }
  return valueDict;
}

// Exported main function: call recordAcceptor with each record generated
// for expName in datashop format. We do NOT terminate our records.
// We return the number of records written
async function createExperimentExport(expName, isFirstInFileArray = true) {
  let record = '';
  const header = {};
  let expNames = [];

  if (_.isString(expName)) {
    expNames.push(expName);
  } else {
    expNames = expName;
  }
  
  const listOfDynamicStimTags = await getListOfStimTags(expName);
  const listOfDynamicStimTagsWithColumnNames = [];
  for (const tag of listOfDynamicStimTags) {
    let renamedField = 'CF (' + tag + ')';
    if(FIELDSDS.indexOf(renamedField) !== -1){
      listOfDynamicStimTagsWithColumnNames.push(renamedField);
    }
  }

  FIELDSDS = FIELDSDS.concat(listOfDynamicStimTagsWithColumnNames);

  FIELDSDS.forEach(async function(f) {
    const prefix = f.substr(0, 14);

    let t;
    if (prefix === 'Condition Name') {
      t = 'Condition Name';
    } else if (prefix === 'Condition Type') {
      t = 'Condition Type';
    } else {
      t = f;
    }

    header[f] = t;
  });

  if(isFirstInFileArray) {
    record += delimitedRecord(header, listOfDynamicStimTags, true) + "\n";
  }

  Meteor.call('updatePerformanceData', 'utlQuery', 'experiment_times.createExperimentExport', 'SERVER_REPORT');
  for(expName of expNames){
    const histories = await getHistoryByTDFfileName(expName);
    for (let history of histories) {
      try {
        const clusterKC = history.KCCluster;
        const stimulusKC = history.KCDefault;
        history = getHistory(history);
        const dynamicStimTagValues = await getValuesOfStimTagList(expName, clusterKC, stimulusKC, listOfDynamicStimTags);
        for (const tag of Object.keys(dynamicStimTagValues)) {
          history["CF (" + tag + ")"] = dynamicStimTagValues[tag];
        }
        record += await delimitedRecord(history, listOfDynamicStimTags, false) + "\n";
      } catch (e) {
        serverConsole('There was an error populating the record - it will be skipped', e, e.stack);
      }
    }
  }
  return record;
}