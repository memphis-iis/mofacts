const fs = require('fs');

const rawTdfs = fs.readFileSync(__dirname + '/infiles/tdfs.json');
const rawStims = fs.readFileSync(__dirname + '/infiles/stimuli.json');

const tdfsJson = JSON.parse(rawTdfs);
const stimsJson = JSON.parse(rawStims);

// stimIdMap = {
//   fileName: stimId
// }
let stimIdMap = {};

const getNewItemFormat = (stimFile, stimuliSetId) => {
  let items = [];

  let baseKC = stimuliSetId * 10000;
  let clusterKC = baseKC + 1;
  let stimKC = baseKC + 1;
  stimFile.stimuli.setspec.clusters.forEach((cluster, idx) => {
    
    let responseKC = 0;
    cluster.stims.forEach(stim => {
        let incorrectResponses = null;
        if (stim.response.incorrectResponses) {
          incorrectResponses = stim.response.incorrectResponses.join(",");
        }

        responseKC = responseKC + 1;
        let item = {
          stimuliSetId: stimuliSetId,
          clusterKC: clusterKC,
          stimulusKC: stimKC,
          responseKC: responseKC,
          params: stim.parameter,
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
  stimIdMap[stimFile.fileName] = stimuliSetId;
  return items;
}

const getNewTdfFormat = (oldTdf, tdfId) => {
  let tdfObj = {
    TDFId: tdfId,
    ownerId: oldTdf.owner,
    stimuliSetId: stimIdMap[oldTdf.tdfs.tutor.setspec[0].stimulusfile[0]],
    content: {
      tdf: oldTdf.tdfs
    }
  };
  
  return tdfObj;
}

let stimuliSetId = 1;
const generateStims = stimsJson => {
  let jsonItems = [];
  stimsJson.forEach(stimFile => {
    const items = getNewItemFormat(stimFile, stimuliSetId);
    jsonItems.push(items);

    stimuliSetId++;
  })
  fs.writeFileSync(__dirname + '/outfiles/items.json', JSON.stringify(jsonItems, null, 4));
}

let tdfId = 1;
const generateTdfs = tdfsJson => {
  let jsonTdfs = [];
  let rootTdfNames = [];
  tdfsJson.forEach(tdfFile => {
    if (tdfFile.tdfs.tutor.setspec[0].stimulusfile) {
      let tdfs = getNewTdfFormat(tdfFile, tdfId);
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

generateStims(stimsJson);
generateTdfs(tdfsJson);