export { getNewItemFormat, getNewTdfFormat };
import { STIM_PARAMETER, KC_MULTIPLE } from '../../common/Definitions';

const fs = require('fs');

// stimIdMap = {
//   fileName: stimId
// }
let stimIdMap = {};
let stimuliSetId = 1;
function generateStims(stimsJson){
  let jsonItems = [];
  stimsJson.forEach(stimFile => {
    const items = getNewItemFormat(stimFile, stimuliSetId,localResponseKCMap);
    stimIdMap[stimFile.fileName] = stimuliSetId;
    jsonItems.push(items);

    stimuliSetId++;
  })
  fs.writeFileSync(__dirname + '/outfiles/items.json', JSON.stringify(jsonItems, null, 4));
}

let tdfId = 1;
function generateTdfs(tdfsJson){
  let jsonTdfs = [];
  let rootTdfNames = [];
  tdfsJson.forEach(tdfFile => {
    if (tdfFile.tdfs.tutor.setspec[0].stimulusfile) {
      let stimuliSetId = stimIdMap[tdfFile.tdfs.tutor.setspec[0].stimulusfile[0]];
      let tdfs = getNewTdfFormat(tdfFile, tdfId, stimuliSetId);
      jsonTdfs.push(tdfs);
  
      tdfId++;
    }
    else {
      rootTdfNames.push(tdfFile.fileName);
    }
  })
  fs.writeFileSync(__dirname + '/outfiles/tdfs.json', JSON.stringify(jsonTdfs, null, 4));
  fs.writeFileSync(__dirname + '/outfiles/roots.json', JSON.stringify(rootTdfNames, null, 4));
}

if(false){//switch to true to run via node
  const rawTdfs = fs.readFileSync(__dirname + '/infiles/tdfs.json');
  const rawStims = fs.readFileSync(__dirname + '/infiles/stimuli.json');
  
  const tdfsJson = JSON.parse(rawTdfs);
  const stimsJson = JSON.parse(rawStims);
  
  generateStims(stimsJson);
  generateTdfs(tdfsJson);
}

let localResponseKCMap = {};
let curResponseKCCtr = 0;
function getNewItemFormat(stimFile, stimuliSetId, responseKCMap){
  let items = [];
  let responseKCs = Object.values(responseKCMap);
  for(let mapResponseKC of responseKCs){
    if(mapResponseKC > curResponseKCCtr) 
      curResponseKCCtr = mapResponseKC
  }

  let baseKC = stimuliSetId * KC_MULTIPLE;
  let clusterKC = baseKC + 1;
  let stimKC = baseKC + 1;
  stimFile.stimuli.setspec.clusters.forEach((cluster, idx) => {
    cluster.stims.forEach(stim => {
        let incorrectResponses = null;
        if (stim.response.incorrectResponses) {
          incorrectResponses = stim.response.incorrectResponses.join(",");
        }

        let responseKC;
        if(responseKCMap[stim.response.correctResponse]){
          responseKC = responseKCMap[stim.response.correctResponse];
        }else{
          responseKC = curResponseKCCtr;
          responseKCMap[stim.response.correctResponse] = curResponseKCCtr;
          curResponseKCCtr += 1;
        }
        let item = {
          stimuliSetId: stimuliSetId,
          clusterKC: clusterKC,
          stimulusKC: stimKC,
          responseKC: responseKC,
          params: stim.parameter || STIM_PARAMETER,
          optimalProb: null,
          correctResponse: stim.response.correctResponse,
          incorrectResponses: incorrectResponses,
          itemResponseType: cluster.responseType || "text",
          speechHintExclusionList: stim.speechHintExclusionList || null,
          clozeStimulus: stim.display.clozeText || null,
          textStimulus: stim.display.text || null,
          audioStimulus: stim.display.audioSrc || null,
          imageStimulus: stim.display.imageSrc || null,
          videoStimulus: stim.display.videoSrc || null,
          alternateDisplays: stim.alternateDisplays,
          tags: stim.tags
        }

        items.push(item);
        stimKC++;
    });
    clusterKC++
  })
  return items;
}

function getNewTdfFormat(oldTdf, tdfId, stimuliSetId){
  let tdfObj = {
    ownerId: oldTdf.owner,
    stimuliSetId: stimuliSetId,
    content: {
      tdfs: oldTdf.tdfs
    }
  };
  if(tdfId) tdfObj.TDFId = tdfId;
  
  return tdfObj;
}

