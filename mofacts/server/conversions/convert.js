export {getNewItemFormat, getNewTdfFormat};
import {STIM_PARAMETER, KC_MULTIPLE} from '../../common/Definitions';
import {getDisplayAnswerText} from '../methods';

const fs = require('fs');

// stimIdMap = {
//   fileName: stimId
// }
const stimIdMap = {};
let stimuliSetId = 1;
function generateStims(stimsJson) {
  const jsonItems = [];
  stimsJson.forEach((stimFile) => {
    const items = getNewItemFormat(stimFile, stimFile.fileName, stimuliSetId, localResponseKCMap);
    stimIdMap[stimFile.fileName] = stimuliSetId;
    jsonItems.push(items);

    stimuliSetId++;
  });
  fs.writeFileSync(__dirname + '/outfiles/items.json', JSON.stringify(jsonItems, null, 4));
}

let tdfId = 1;
function generateTdfs(tdfsJson) {
  const jsonTdfs = [];
  const rootTdfNames = [];
  tdfsJson.forEach((tdfFile) => {
    if (tdfFile.tdfs.tutor.setspec.stimulusfile) {
      const stimuliSetId = stimIdMap[tdfFile.tdfs.tutor.setspec.stimulusfile];
      const tdfs = getNewTdfFormat(tdfFile, tdfId, stimuliSetId);
      jsonTdfs.push(tdfs);

      tdfId++;
    } else {
      rootTdfNames.push(tdfFile.fileName);
    }
  });
  fs.writeFileSync(__dirname + '/outfiles/tdfs.json', JSON.stringify(jsonTdfs, null, 4));
  fs.writeFileSync(__dirname + '/outfiles/roots.json', JSON.stringify(rootTdfNames, null, 4));
}

if (false) {// switch to true to run via node
  const rawTdfs = fs.readFileSync(__dirname + '/infiles/tdfs.json');
  const rawStims = fs.readFileSync(__dirname + '/infiles/stimuli.json');

  const tdfsJson = JSON.parse(rawTdfs);
  const stimsJson = JSON.parse(rawStims);

  generateStims(stimsJson);
  generateTdfs(tdfsJson);
}

function removeInvisibleUnicode(str) {
  if ((str===null) || (str===''))
    return str;
  else
    str = str.toString();

  return str.replace(/[\u0080-\u00FF]/g, "")
}

const localResponseKCMap = {};
let curResponseKCCtr = 1;
function getNewItemFormat(stimFile, stimulusFileName, stimuliSetId, responseKCMap) {
  const items = [];
  const responseKCs = Object.values(responseKCMap);
  for (const mapResponseKC of responseKCs) {
    if (mapResponseKC > curResponseKCCtr) {
      curResponseKCCtr = mapResponseKC;
    }
  }

  const baseKC = stimuliSetId * KC_MULTIPLE;
  let clusterKC = baseKC;
  let stimKC = baseKC;

  if (
    !stimFile ||
    !stimFile.stimuli ||
    !stimFile.stimuli.setspec ||
    !Array.isArray(stimFile.stimuli.setspec.clusters)
  ) {
    throw new Error(`Stimulus file "${stimulusFileName}" is missing or malformed (no clusters array).`);
  }

  stimFile.stimuli.setspec.clusters.forEach((cluster, clusterIdx) => {
    if (!cluster || !Array.isArray(cluster.stims)) {
      throw new Error(`Cluster ${clusterIdx} in "${stimulusFileName}" is missing or has no stims array.`);
    }
    cluster.stims.forEach((stim, stimIdx) => {
      if (!stim || typeof stim !== 'object') {
        throw new Error(`Stim ${stimIdx} in cluster ${clusterIdx} of "${stimulusFileName}" is undefined or not an object.`);
      }
      if (!stim.response || typeof stim.response !== 'object') {
        throw new Error(`Stim ${stimIdx} in cluster ${clusterIdx} of "${stimulusFileName}" missing 'response' property.`);
      }
      if (!stim.response.hasOwnProperty('correctResponse')) {
        throw new Error(`Stim ${stimIdx} in cluster ${clusterIdx} of "${stimulusFileName}" missing 'correctResponse' property in 'response'.`);
      }
      if (incorrectResponses) {
        incorrectResponses = incorrectResponses.map((ir) => removeInvisibleUnicode(ir));
      }

      let incorrectResponses = stim.response.incorrectResponses;
      if (incorrectResponses){
        if (typeof incorrectResponses === 'string') {
          incorrectResponses = incorrectResponses.split(',');
        }
        incorrectResponses = incorrectResponses.map((ir) => removeInvisibleUnicode(ir));
      }
      
      let responseKC;
      const answerText = getDisplayAnswerText(stim.response.correctResponse);

      if (responseKCMap[answerText] || responseKCMap[answerText] == 0) {
        responseKC = responseKCMap[answerText];
      } else {
        responseKC = curResponseKCCtr;
        responseKCMap[answerText] = JSON.parse(JSON.stringify(curResponseKCCtr));
        curResponseKCCtr += 1;
      }
      const item = {
        stimuliSetId: stimuliSetId,
        stimulusFileName: stimulusFileName,
        stimulusKC: stimKC,
        clusterKC: clusterKC,
        responseKC: responseKC,
        params: stim.parameter || STIM_PARAMETER,
        optimalProb: stim.optimalProb,
        correctResponse: removeInvisibleUnicode(stim.response.correctResponse),
        incorrectResponses: incorrectResponses,
        itemResponseType: cluster.responseType || 'text',
        speechHintExclusionList: stim.speechHintExclusionList,
        clozeStimulus: stim.display?.clozeText || stim.display?.clozeStimulus,
        textStimulus: stim.display?.text || stim.display?.textStimulus || "",
        audioStimulus: stim.display?.audioSrc || stim.display?.audioStimulus,
        imageStimulus: stim.display?.imgSrc || stim.display?.imageStimulus,
        videoStimulus: stim.display?.videoSrc || stim.display?.videoStimulus,
        alternateDisplays: stim.alternateDisplays,
        tags: stim.tags,
      };

      if (stimulusFileName.indexOf('test') != -1) {
        console.log('stim:', JSON.stringify(stim), item, stim.display, stim.display.text);
      }

      items.push(item);
      stimKC++;
    });
    clusterKC++;
  });
  return items;
}

function getNewTdfFormat(oldTdf, stimuliSetId, tdfId) {
  const tdfObj = {
    ownerId: oldTdf.owner || oldTdf.ownerId,
    stimuliSetId: stimuliSetId,
    content: {
      tdfs: oldTdf.tdfs,
    },
    visibility: oldTdf.visibility || 'profileOnly',
  };
  if (tdfId) tdfObj._id = tdfId;

  return tdfObj;
}
