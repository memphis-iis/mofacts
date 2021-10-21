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
function delimitedRecord(rec) {
  const vals = new Array(FIELDSDS.length);
  for (let i = 0; i < FIELDSDS.length; ++i) {
    vals[i] = _.trim(rec[FIELDSDS[i]])
        .replace(/\s+/gm, ' ') // Norm ws and remove non-space ws
        .slice(0, 255) // Respect len limits for data shop
        .replace(/\s+$/gm, ''); // Might have revealed embedded space at end
  }

  return vals.join('\t');
}

async function getValuesOfStimTagList(tdfFileName, clusterKC, stimulusKC, tagList) {
  serverConsole('getValuesOfStimTagList:', tdfFileName, clusterKC, stimulusKC, tagList);
  const tdf = await getTdfByFileName(tdfFileName);
  const stimuliSetId = tdf.stimuliSetId;
  const stimuliSet = await getStimuliSetById(stimuliSetId);
  const curStimSet = stimuliSet.find((x) => x.clusterKC==clusterKC && x.stimulusKC==stimulusKC);
  serverConsole('getValuesOfStimTagList:', typeof(curStimSet), Object.keys(curStimSet || {}));
  const valueDict = {};

  for (const tag of tagList) {
    for (const stim of curStimSet) {
      if (!valueDict[tag] && stim.tags) {
        valueDict[tag] = stim.tags[tag] || '';
      } else {
        valueDict[tag] = '';
      }
    }
  }

  return valueDict;
}

// Exported main function: call recordAcceptor with each record generated
// for expName in datashop format. We do NOT terminate our records.
// We return the number of records written
async function createExperimentExport(expName, format) {
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
    listOfDynamicStimTagsWithColumnNames.push('CF (' + tag + ')');
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

  record += delimitedRecord(header) + "\n\r";

  Meteor.call('updatePerformanceData', 'utlQuery', 'experiment_times.createExperimentExport', 'SERVER_REPORT');
  for(expName of expNames){
    const histories = await getHistoryByTDFfileName(expName);
    for (let history of histories) {
      try {
        const clusterKC = history.kc_cluster;
        const stimulusKC = history.cf_stimulus_version;
        //serverConsole('history:', clusterKC, stimulusKC, history);
        history = getHistory(history);
        const dynamicStimTagValues = await getValuesOfStimTagList(expName, clusterKC, stimulusKC, listOfDynamicStimTags);

        for (const tag of Object.keys(dynamicStimTagValues)) {
          history.dynamicTagFields['CF (' + tag + ')'] = dynamicStimTagValues[tag];
        }
        record += await delimitedRecord(history) + "\n\r";
      } catch (e) {
        serverConsole('There was an error populating the record - it will be skipped', e, e.stack);
      }
    }
  }
  return record;
}