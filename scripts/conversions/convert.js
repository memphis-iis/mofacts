const getNewItemFormat = (stim, stimuliSetId) => {
  let items = [];

  stim.setspec.clusters.forEach((cluster, idx) => {
    const clusterKC = idx + 1;
    let responseKC = 0;
    let stimulusKC = 0;

    cluster.stims.forEach(stim => {
        stimulusKC = stimulusKC + 1;
        responseKC = responseKC + 1;

        let item = {
          stimuliSetId: stimuliSetId,
          stimulusKC: stimulusKC,
          clusterKC: clusterKC,
          responseKC: responseKC,
          params: stim.parameter,
          optimalProb: "",
          correctResponse: stim.response.correctResponse,
          incorrectResponses: stim.response.incorrectResponses.join(","),
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
    });
  })

  return items;
}

const getNewTdfFormat = (oldTdf, stimuliSetId) => {
  let tdfObj = {
    TDFId: oldTdf._id,
    ownerId: oldTdf.owner,
    stimuliSetId: stimuliSetId,
    content: {
      tdf: oldTdf.tdfs
    }
  };

  return tdfObj;
}

const generateNewFormattedPairs = (oldStim, oldTdf, stimuliSetId) => {
  const items = getNewItemFormat(oldStim, stimuliSetId);
  const newTdf = getNewTdfFormat(oldTdf, stimuliSetId);

  return [items, newTdf];
}

const getNewFormattedPairs = (oldStims, oldTdfs) => {
  let stimuliSetId = 1;
  let newItems = [];
  let newTdfs = [];
  oldTdfs.forEach((oldTdf, idx) => {
    const [newItem, newTdf] = 
      generateNewFormattedPairs(oldStims[idx], oldTdf, stimuliSetId);
    newItems.push(newItem);
    newTdfs.push(newTdf);
    stimuliSetId++;
  })

  return [newItems, newTdfs];
}