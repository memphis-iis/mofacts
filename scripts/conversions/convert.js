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
          optimalProb: "",
          correctResponse: stim.response.correctResponse,
          incorrectResponses: incorrectResponses,
          itemResponseType: cluster.responseType || "text",
          speechHintExclusionList: "",
          clozeStimulus: stim.display.clozeText || "",
          textStimulus: stim.display.text || "",
          audioStimulus: stim.display.audioSrc || "",
          imageStimulus: stim.display.imageSrc || "",
          videoStimulus: stim.display.videoSrc || "",
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
    stimuliSetId: stimuliSetId,
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
  tdfsJson.forEach(tdfFile => {
    let tdfs = getNewTdfFormat(tdfFile, tdfId);
    jsonTdfs.push(tdfs);

    tdfId++;
  })
  fs.writeFileSync(__dirname + '/outfiles/tdfs.json', JSON.stringify(jsonTdfs, null, 4));
}

generateStims(stimsJson);
generateTdfs(tdfsJson);