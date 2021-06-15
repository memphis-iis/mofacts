import {curSemester, STIM_PARAMETER, MODEL_UNIT, SCHEDULE_UNIT} from '../../../common/Definitions';
import {Tracker} from 'meteor/tracker';
import {DynamicTdfGenerator} from '../../../common/DynamicTdfGenerator';
import {rangeVal} from '../../lib/currentTestingHelpers';
import {meteorCallAsync} from '../..';

Session.set('curClozeSentencePairClusterKC', '');
Session.set('clozeSentencePairs', {});
Session.set('clozeHistory', []);
Session.set('selectedForDelete', []);
Session.set('editingSentence', {});
Session.set('editingCloze', {});
Session.set('tdfOwnersMap', {});
let clusterKCtoSentenceMap = {};
let clusterKCtoClozesMap = {};
let stimulusKCtoClozesMap = {};
let speechAPIKey = undefined;
let textToSpeechAPIKey = undefined;
let originalClozes = undefined;
let origTdfId = undefined;
let clusterListMappings = {};
let stimUnitMappings = {};
let clozeEdits = [];
let clozesComeFromTemplate = undefined;
let tdfIdToTdfFileMap = {};
let tdfIdToStimuliSetMap = {};

let finalDidYouReadQuestion = undefined;

function recordClozeEditHistory(oldCloze, newCloze) {
  const timestamp = Date.now();
  console.log(new Date(timestamp).toString() + ':' + JSON.stringify(oldCloze) + '|' + JSON.stringify(newCloze));
  clozeEdits.push({startingCloze: oldCloze, endingCloze: newCloze, timestamp: timestamp});
}

async function setAllTdfs(ownerMapCallback) {
  const allTdfs = [];
  const ownerIds = [];
  let stimSetIds = Session.get('allTdfs').map((x) => x.stimuliSetId).filter((x) => x!=null);
  stimSetIds = Array.from(new Set(stimSetIds));
  const allStims = await meteorCallAsync('getStimuliSetsForIdSet', stimSetIds);
  Session.get('allTdfs').forEach(function(tdf) {
    if (tdf.content.fileName.indexOf(curSemester) == -1) return;

    const tdfid = tdf.TDFId;
    const tdfStimSetId = tdf.stimuliSetId;
    const tdfFile = tdf.content;
    tdfIdToTdfFileMap[tdfid] = tdfFile;
    tdfIdToStimuliSetMap[tdfid] = allStims.filter((x) => x.stimuliSetId == tdfStimSetId);

    const displayName = tdfFile.tdfs.tutor.setspec[0].lessonname[0];
    let displayDate = '';
    if (tdfFile.createdAt) {
      const date = new Date(tdfFile.createdAt);
      displayDate = (date.getMonth() + 1) + '/' + date.getDate() + '/' + date.getFullYear();
    }
    const ownerId = tdf.ownerId;
    ownerIds.push(tdf.ownerId);
    allTdfs.push({tdfid, displayName, ownerId, displayDate});
  });
  ownerMapCallback(ownerIds);
  Session.set('contentGenerationAllTdfs', allTdfs);
}

function getTdfOwnersMap(ownerIds) {
  Meteor.call('getTdfOwnersMap', ownerIds, function(err, res) {
    if (err) {
      console.log(err);
    } else {
      Session.set('tdfOwnersMap', res);
    }
  });
}

async function setClozesFromStimObject(stimObject, isMultiTdf) {
  console.log('setClozesFromStimObject');
  const MULTITDF_MAIN_CLUSTER_UNIT = 2;
  const LOWER_BOUND_RANDOM = -9999999999;
  const UPPER_BOUND_RANDOM = 9999999999;
  const allClozes = [];
  const stimuliSetId = stimObject[0].stimuliSetId;
  const sourceSentences = await meteorCallAsync('getSourceSentences', stimuliSetId);
  fillOutSentenceLookupMap(sourceSentences);
  let originalOrderIndex = 0;

  for (let index=0; index<stimObject.length; index++) { // [{},{}]
    const stim = stimObject[index];
    if (stim.clozeStimulus == 'Did you read the chapter (yes/no)?') {
      finalDidYouReadQuestion = stim;
      continue;
    }
    let clusterKC;
    let sourceSentence;
    if (stim.clusterKC) {
      clusterKC = stim.clusterKC;
    } else if (stim.tags && stim.tags.itemId) {
      clusterKC = stim.tags.itemId;
      sourceSentence = clusterKCtoSentenceMap[clusterKC].sentence;
    } else {
      clusterKC = _.random(LOWER_BOUND_RANDOM, UPPER_BOUND_RANDOM);
    }

    const clozeStimulus = stim.clozeStimulus || stim.clozeText || stim.textStimulus;

    const correctResponse = stim.correctResponse;
    const incorrectResponses = stim.incorrectResponses || undefined;
    const itemResponseType = stim.itemResponseType;
    const speechHintExclusionList = stim.speechHintExclusionList;
    const textStimulus = stim.textStimulus;
    const audioStimulus = null; // ASSUMED
    const imageStimulus = null; // ASSUMED
    const videoStimulus = null; // ASSUMED

    const stimulusKC = stim.stimulusKC ? stim.stimulusKC :
                     stim.tags && stim.tags.clozeId ? stim.tags.clozeId :
                     _.random(LOWER_BOUND_RANDOM, UPPER_BOUND_RANDOM);
    const params = stim.params;
    let paraphraseId = _.random(LOWER_BOUND_RANDOM, UPPER_BOUND_RANDOM);
    const isCoreference = !!stim.tags && !!stim.tags.clozeCorefTransformation;
    const unitIndex = isMultiTdf ? MULTITDF_MAIN_CLUSTER_UNIT : stimUnitMappings[index];
    let unitType = undefined;
    if (!stimUnitMappings[index] || _.isEmpty(stimUnitMappings[index])) {
      if (isMultiTdf) {
        // do nothing, multitdfs ignore a lot of mapping
      } else {
        console.log('no stim unit mappings for index:', index, stimUnitMappings[index]);
        continue;
      }
    } else {
      unitType = stimUnitMappings[index].unitType;
    }
    if (isMultiTdf || unitType == MODEL_UNIT) {
      allClozes.push({
        unitIndex,
        clozeStimulus,
        correctResponse,
        incorrectResponses,
        itemResponseType,
        speechHintExclusionList,
        textStimulus,
        audioStimulus,
        imageStimulus,
        videoStimulus,
        stimulusKC,
        clusterKC,
        params,
        paraphraseId,
        originalOrderIndex,
        isCoreference,
        sourceSentence,
        origStimIndex: index,
        isParaphrase: false,
        tags: stim.tags,
        originalVersion: isCoreference ? stim.tags.originalItem : 'Same',
      });
      originalOrderIndex += 1;
      if (stim.alternateDisplays) {
        for (const altDisplay of stim.alternateDisplays) {
          paraphraseId = _.random(LOWER_BOUND_RANDOM, UPPER_BOUND_RANDOM);
          const altCloze = altDisplay.clozeStimulus || altDisplay.clozeText; // clozeText is a prior schema name
          allClozes.push({
            unitIndex,
            correctResponse,
            incorrectResponses,
            itemResponseType,
            speechHintExclusionList,
            textStimulus,
            audioStimulus,
            imageStimulus,
            videoStimulus,
            stimulusKC,
            clusterKC,
            params,
            paraphraseId,
            originalOrderIndex,
            sourceSentence,
            clozeStimulus: altCloze,
            origStimIndex: index,
            isParaphrase: true,
            tags: stim.tags,
            originalVersion: clozeStimulus,
            isCoreference: false, // for now we don't layer coref resolution and paraphrasing
          });
          originalOrderIndex += 1;
        }
      }
    }
  }

  Session.set('clozeSentencePairs', {
    'sentences': sourceSentences,
    'clozes': allClozes,
  });
  originalClozes = JSON.parse(JSON.stringify(allClozes));
  fillOutItemLookupMaps(allClozes);
}

function fillOutSentenceLookupMap(sentences) {
  clusterKCtoSentenceMap = {};
  for (const sentenceIndex in sentences) {
    const sentence = sentences[sentenceIndex];
    const clusterKC = parseInt(sentence.clusterKC);
    clusterKCtoSentenceMap[clusterKC] = sentence;
  }
}

function fillOutItemLookupMaps(clozes) {
  stimulusKCtoClozesMap = {};
  clusterKCtoClozesMap = {};

  for (const cloze of clozes) {
    if (!stimulusKCtoClozesMap[cloze.stimulusKC]) {
      stimulusKCtoClozesMap[cloze.stimulusKC] = [];
    }
    stimulusKCtoClozesMap[cloze.stimulusKC].push(cloze);
    const clusterKC = cloze.clusterKC;
    if (!clusterKCtoClozesMap[clusterKC]) {
      clusterKCtoClozesMap[clusterKC] = [];
    }
    clusterKCtoClozesMap[clusterKC].push(cloze);
  }
}

function saveEditHistory(originalClozes, newClozes) {
  const history = {
    originalClozes: originalClozes,
    endingClozes: newClozes,
    clozeEdits: clozeEdits,
    user: Meteor.userId(),
    timestamp: Date.now().toString(),
    templateTdf: origTdfId,
  };
  Meteor.call('insertClozeEditHistory', history, function(err, result) {
    if (err) {
      console.log('error saving cloze edit history: ', err);
    } else {
      console.log('saving cloze edit history results: ', result);
    }
  });

  clozeEdits = [];
}

function generateAndSubmitTDFAndStimFiles() {
  sortClozes('originalOrderIndex'); // It's important to keep items in the same order to preserve cluster index/clusterKC relation
  const clozes = Session.get('clozeSentencePairs').clozes;
  console.log('Generating TDF with clozes: ', clozes);
  const displayName = $('#tdfDisplayNameTextBox').val();
  const curUserName = Meteor.user().username.split('@')[0].replace(/[.]/g, '_');
  const curDate = new Date();
  const curDateTime = curDate.toISOString().replace(/-/g, '_').replace(/:/g, '_').replace(/[.]/g, '_');
  const tdfFileName = displayName.replace(/ /g, '_') + '_' + curUserName + '_' + curDateTime + '_' + curSemester + '_TDF.xml';

  let stimulusFilename = undefined;
  let parentStimulusFileName = undefined;
  let isMultiTdf = false;
  if (clozesComeFromTemplate) {
    const tdfTemplateId = $('#templateTDFSelect').val();
    const originalTDF = tdfIdToTdfFileMap[tdfTemplateId];
    isMultiTdf = originalTDF.isMultiTdf;

    stimulusFilename = originalTDF.tdfs.tutor.setspec[0].stimulusfile[0];
    stimulusFilename = stimulusFilename.slice(0, stimulusFilename.length-5) + '_' + curUserName + '_' + curDateTime + '_' + curSemester + '.json';

    parentStimulusFileName = originalTDF.tdfs.tutor.setspec[0].stimulusfile[0];
  } else {
    stimulusFilename = displayName.replace(/ /g, '_') + '_' + curUserName + '_' + curDateTime + '_' + curSemester + '_autoNamed_Stim.json';
    parentStimulusFileName = null;
  }

  const newStimJSON = generateStimJSON(clozes, isMultiTdf, stimulusFilename, parentStimulusFileName);
  const newTDFJSON = generateTDFJSON(tdfFileName, displayName, stimulusFilename, newStimJSON);
  const wrappedTDF = {
    ownerId: Meteor.userId(),
    visibility: 'profileSouthwestOnly',
    content: newTDFJSON,
  };

  const sourceSentences = Session.get('clozeSentencePairs').sentences;

  // Clean up after ourselves
  for (const unitIndex in clusterListMappings) {
    clusterListMappings[unitIndex].new = undefined;
  }

  console.log('!!!generateAndSubmitTDFAndStimFiles', newStimJSON, wrappedTDF, sourceSentences);
  Meteor.call('insertStimTDFPair', newStimJSON, wrappedTDF, sourceSentences, function(err, res) {
    if (err) {
      console.log('Error inserting stim/tdf pair: ' + err);
      alert('Error creating content: ' + err);
    } else {
      const tdfid = res;
      console.log('Inserting stim/tdf pair result: ' + res);
      saveEditHistory(originalClozes, clozes);

      const displayDate = (curDate.getMonth() + 1) + '/' + curDate.getDate() + '/' + curDate.getFullYear();
      const ownerId = Meteor.userId();
      const newTdfInfo = {tdfid, displayName, ownerId, displayDate};
      Session.set('contentGenerationAllTdfs', Session.get('contentGenerationAllTdfs').concat(newTdfInfo));

      const tempTdfOwnersMap = Session.get('tdfOwnersMap');
      tempTdfOwnersMap[ownerId] = Meteor.user().username;
      Session.set('tdfOwnersMap', tempTdfOwnersMap);

      tdfIdToTdfFileMap[tdfid] = newTDFJSON;
      tdfIdToStimuliSetMap[tdfid] = newStimJSON;
      alert('Saved Successfully!');
      $('#tdfDisplayNameTextBox').val('');
      $('#save-modal').modal('hide');
    }
  });
}

function getStimForCloze(stimulusKC, stimulusFilename, parentStimulusFileName) {
  const curStimClozes = stimulusKCtoClozesMap[stimulusKC];

  const clusterKC = curStimClozes[0].clusterKC;
  const params = curStimClozes[0].params;
  const correctResponse = curStimClozes[0].correctResponse;
  const incorrectResponses = curStimClozes[0].incorrectResponses || undefined;
  const itemResponseType = curStimClozes[0].itemResponseType;
  const speechHintExclusionList = curStimClozes[0].speechHintExclusionList;
  const textStimulus = curStimClozes[0].textStimulus;
  const audioStimulus = null; // ASSUMED
  const imageStimulus = null; // ASSUMED
  const videoStimulus = null; // ASSUMED
  const tags = curStimClozes[0].tags;

  const stim = {
    stimulusFilename,
    parentStimulusFileName,
    stimulusKC,
    clusterKC,
    params: params || STIM_PARAMETER,
    correctResponse,
    incorrectResponses,
    itemResponseType,
    speechHintExclusionList,
    audioStimulus,
    imageStimulus,
    videoStimulus,
    clozeStimulus: '',
    textStimulus,
    alternateDisplays: [],
    tags,
  };

  if (curStimClozes.length > 1) { // this means there are paraphrases as they share the same cloze id
    for (const cloze2 of curStimClozes) {
      const cloze2Stimulus = cloze2.clozeStimulus || cloze2.clozeText;
      if (cloze2.isParaphrase) {
        stim.alternateDisplays.push({'clozeStimulus': cloze2Stimulus});
      } else {
        stim.clozeStimulus = cloze2Stimulus;
      }
    }
    if (!stim.clozeStimulus) {
      stim.clozeStimulus = stim.alternateDisplays.pop();
      if (stim.alternateDisplays.length == 0) {
        delete stim.alternateDisplays;
      }
    }
  } else {
    delete stim.alternateDisplays;
    stim.clozeStimulus = curStimClozes[0].clozeStimulus;
  }

  return stim;
}

function generateStimJSON(clozes, isMultiTdf, stimulusFilename, parentStimulusFileName) {
  console.log('generateStimJSON:', isMultiTdf, clozes, stimulusFilename);
  const origStim = tdfIdToStimuliSetMap[origTdfId];
  const curStim = [];

  const completedClusterKCs = {};
  let curClusterIndex = 0;
  for (const index in clozes) {
    const clusterKC = clozes[index].clusterKC;
    if (!completedClusterKCs[clusterKC]) {
      completedClusterKCs[clusterKC] = true;
      const curSentenceClozes = clusterKCtoClozesMap[clusterKC];
      if (curSentenceClozes.length == 0) {
        continue;
      }
      if (!isMultiTdf) {
        const unitIndex = clozes[index].unitIndex;
        if (!(clusterListMappings[unitIndex].new)) {
          clusterListMappings[unitIndex].new = curClusterIndex;
        }
      }

      const completedStimulusKCs = {};
      for (const cloze of curSentenceClozes) {
        const stimulusKC = cloze.stimulusKC;
        if (!completedStimulusKCs[stimulusKC]) {
          const stim = getStimForCloze(stimulusKC, stimulusFilename, parentStimulusFileName);
          curStim.push(stim);// [{},{}]
          completedStimulusKCs[stimulusKC] = true;
        }
      }
      curClusterIndex += 1;
    }
  }

  console.log('!!!generateStimJSON', curClusterIndex, completedClusterKCs, curStim);

  // Add back assessment session/non learning session clusters
  if (!isMultiTdf) {
    for (const unitMapping of clusterListMappings) {
      if (!unitMapping.new) {
        unitMapping.new = curClusterIndex;
        curClusterIndex += 1;
        const stimIndices = unitMapping.stimIndices;

        for (const stimIndex of stimIndices) {
          const stim = origStim[stimIndex];// [{},{}]
          curStim.push(stim);// [{},{}]
        }
      }
    }
  }

  if (finalDidYouReadQuestion) {
    if (!finalDidYouReadQuestion.parentStimulusFileName) finalDidYouReadQuestion.parentStimulusFileName = parentStimulusFileName || null;
    curStim.push(finalDidYouReadQuestion);// [{},{}]
  }

  return curStim;
}

function generateTDFJSON(tdfFileName, displayName, stimulusFilename, newStimJSON) {
  console.log('generateTDFJSON:', tdfFileName, displayName, stimulusFilename, newStimJSON);
  console.log('clusterListMappings: ', clusterListMappings);
  let curTdf = undefined;

  if (clozesComeFromTemplate) {
    const tdfTemplateFileName = $('#templateTDFSelect').val();
    const originalTDF = tdfIdToTdfFileMap[tdfTemplateFileName];
    curTdf = JSON.parse(JSON.stringify(originalTDF));
  } else {
    curTdf = JSON.parse(JSON.stringify(templateTDFJSON));
  }

  delete curTdf._id;
  const isMultiTdf = curTdf.isMultiTdf;

  if (isMultiTdf) {
    const tdfGenerator = new DynamicTdfGenerator(curTdf.tdfs, tdfFileName, Meteor.userId(), 'content_generation', newStimJSON);
    const generatedTdf = tdfGenerator.getGeneratedTdf();
    curTdf = generatedTdf;

    const lastStim = newStimJSON.length - 1; // [{},{}]
    curTdf.tdfs.tutor.unit[1].assessmentsession[0].clusterlist = [lastStim + '-' + lastStim];

    console.log('curTdf.subTdfs: ', curTdf.subTdfs);
  } else {
    for (const unitIndex in clusterListMappings) {
      const isLearningSession = clusterListMappings[unitIndex].unitType === MODEL_UNIT;
      const unit = curTdf.tdfs.tutor.unit[unitIndex];
      const clusterlist = isLearningSession ? unit.learningsession[0].clusterlist : unit.assessmentsession[0].clusterlist;
      clusterlist[0] = clusterListMappings[unitIndex].new;
    }
    curTdf.createdAt = new Date();
    curTdf.ownerId = Meteor.userId();
    curTdf.fileName = tdfFileName;
  }

  curTdf.tdfs.tutor.setspec[0].lessonname = [displayName];
  curTdf.tdfs.tutor.setspec[0].stimulusfile = [stimulusFilename];

  if (typeof(speechAPIKey) !== 'undefined') {
    curTdf.tdfs.tutor.setspec[0].speechAPIKey = [speechAPIKey];
  }
  if (typeof(speechAPIKey) !== 'undefined') {
    curTdf.tdfs.tutor.setspec[0].textToSpeechAPIKey = [textToSpeechAPIKey];
  }

  return curTdf;
}

function updateLookupMaps(stimulusKC, clusterKC, paraphraseId, oldCloze, newCloze) {
  console.log('updateLookupMaps: ', oldCloze, newCloze);
  recordClozeEditHistory(oldCloze, newCloze);
  stimulusKCtoClozesMap[stimulusKC] = stimulusKCtoClozesMap[stimulusKC].filter((clozeItem) => clozeItem.stimulusKC == stimulusKC && clozeItem.paraphraseId != paraphraseId);
  clusterKCtoClozesMap[clusterKC] = clusterKCtoClozesMap[clusterKC].filter((clozeItem) => clozeItem.stimulusKC == stimulusKC && clozeItem.paraphraseId != paraphraseId);

  const prevClozeSentencePairs = Session.get('clozeSentencePairs');
  let newSentences = prevClozeSentencePairs.sentences;
  const newClozes = prevClozeSentencePairs.clozes;
  const curClozeIndex = prevClozeSentencePairs.clozes.findIndex(function(c) {
    return c.stimulusKC == stimulusKC && c.paraphraseId == paraphraseId;
  });

  if (newCloze && Object.keys(newCloze).length > 0) {
    stimulusKCtoClozesMap[stimulusKC].push(newCloze);
    clusterKCtoClozesMap[clusterKC].push(newCloze);
    newClozes.splice(curClozeIndex, 1, newCloze);
  } else { // We've delete a cloze so we should make sure to check if a sentence no longer has a cloze
    newClozes.splice(curClozeIndex, 1);
    newSentences = _.map(prevClozeSentencePairs.sentences, function(s) {
      if (s.clusterKC === clusterKC) {
        const matchingClozes = _.filter(newClozes, function(c) {
          return c.clusterKC === s.clusterKC;
        });
        if (matchingClozes.length == 0) s.hasCloze = false;
      }

      return s;
    });
  }

  Session.set('clozeSentencePairs', {
    'sentences': newSentences,
    'clozes': newClozes,
  });
}

function deleteCloze(stimulusKC, clusterKC, paraphraseId) {
  console.log('deleteCloze', stimulusKC, clusterKC, paraphraseId);
  const oldCloze = JSON.parse(JSON.stringify(stimulusKCtoClozesMap[stimulusKC].find((elem) => elem.paraphraseId == paraphraseId)));
  updateLookupMaps(stimulusKC, clusterKC, paraphraseId, oldCloze, {});
}

function sortClozes(sortingMethod) {
  console.log('sorting clozes by: ' + sortingMethod);
  const clozeSentencePairs = JSON.parse(JSON.stringify(Session.get('clozeSentencePairs')));
  let clozes = clozeSentencePairs.clozes;

  switch (sortingMethod) {
    case 'originalOrderIndex':
      clozes = clozes.sort(function(a, b) {
        if (a.originalOrderIndex == b.originalOrderIndex) return 0;
        if (a.originalOrderIndex < b.originalOrderIndex) return -1;
        return 1;
      });
      break;
    case 'sentenceWeight':
      clozes = clozes.sort(function(a, b) {
        if (a.tags.sentenceWeight == b.tags.sentenceWeight) return 0;
        if (a.tags.sentenceWeight < b.tags.sentenceWeight) return -1;
        return 1;
      });
      break;
    case 'coreference':
      clozes = clozes.sort(function(a, b) {
        if (a.tags.clozeCorefTransformation && b.tags.clozeCorefTransformation) return 0;
        if (a.tags.clozeCorefTransformation) return -1;
        if (b.tags.clozeCorefTransformation) return 1;
        return 0;
      });
      break;
    case 'paraphrase':
      clozes = clozes.sort(function(a, b) {
        if (a.isParaphrase && b.isParaphrase) return 0;
        if (a.isParaphrase) return -1;
        if (b.isParaphrase) return 1;
        return 0;
      });
      break;
  }

  clozeSentencePairs.clozes = clozes;
  Session.set('clozeSentencePairs', clozeSentencePairs);
}

Template.contentGeneration.onRendered(async function() {
  $('html,body').scrollTop(0);
  Session.set('curClozeSentencePairClusterKC', '');
  Session.set('clozeSentencePairs', {});
  Session.set('clozeHistory', []);
  Session.set('selectedForDelete', []);
  Session.set('editingSentence', {});
  Session.set('editingCloze', {});
  Session.set('tdfOwnersMap', {});
  clusterKCtoSentenceMap = {};
  clusterKCtoClozesMap = {};
  stimulusKCtoClozesMap = {};
  tdfIdToStimuliSetMap = {};
  tdfIdToTdfFileMap = {};
  speechAPIKey = undefined;
  textToSpeechAPIKey = undefined;
  originalClozes = undefined;
  origTdfId = undefined;
  clusterListMappings = {};
  stimUnitMappings = {};
  clozeEdits = [];
  clozesComeFromTemplate = undefined;
  finalDidYouReadQuestion = undefined;

  console.log('contentGeneration rendered');
  setAllTdfs(getTdfOwnersMap);

  const template = this;
  template.autorun(() => {
    Session.get('clozeSentencePairs');
    Tracker.afterFlush(() => {
      $('.cloze-checkbox').shiftSelectable();
    });
  });

  $('#templateTDFSelect').select2();
});

Template.contentGeneration.events({
  'click #revertCoreference': function(event) {
    const stimulusKC = parseInt(event.currentTarget.getAttribute('stimulusKC'));
    const clusterKC = parseInt(event.currentTarget.getAttribute('clusterKC'));
    const curParaphraseId = parseInt(event.currentTarget.getAttribute('paraphrase-id'));
    const clozeSentencePairs = Session.get('clozeSentencePairs');

    const oldCloze = clozeSentencePairs.clozes.find((cloze) => cloze.paraphraseId == curParaphraseId);
    const newCloze = JSON.parse(JSON.stringify(oldCloze));

    const originalText = JSON.parse(JSON.stringify(newCloze.tags.originalItem));
    delete newCloze.tags.originalItem;
    newCloze.clozeStimulus = originalText;

    updateLookupMaps(stimulusKC, clusterKC, curParaphraseId, oldCloze, newCloze);
  },

  'click #redoCoreference': function(event) {
    const stimulusKC = parseInt(event.currentTarget.getAttribute('stimulusKC'));
    const clusterKC = parseInt(event.currentTarget.getAttribute('clusterKC'));
    const curParaphraseId = parseInt(event.currentTarget.getAttribute('paraphrase-id'));
    const clozeSentencePairs = Session.get('clozeSentencePairs');

    const oldCloze = JSON.parse(JSON.stringify(clozeSentencePairs.clozes.find((cloze) => cloze.paraphraseId == curParaphraseId)));
    const newCloze = JSON.parse(JSON.stringify(oldCloze));

    const originalText = JSON.parse(JSON.stringify(newCloze.clozeStimulus));
    newCloze.tags.originalItem = originalText;
    newCloze.clozeStimulus = JSON.parse(JSON.stringify(newCloze.tags.clozeCorefTransformation));

    updateLookupMaps(stimulusKC, clusterKC, curParaphraseId, oldCloze, newCloze);
  },

  'click #cloze': function(event) {
    const clusterKC = parseInt(event.currentTarget.getAttribute('clusterKC'));
    Session.set('curClozeSentencePairClusterKC', clusterKC);
    const parsedSentencesMatchingSentence = $('#parsed-sentences').find('[clusterKC=' + clusterKC + ']').get(0);
    if (parsedSentencesMatchingSentence) {
      parsedSentencesMatchingSentence.scrollIntoView();
    }
  },

  'click .sortingBtn': function(event) {
    const sortProperty = event.currentTarget.getAttribute('sortProperty');
    sortClozes(sortProperty);
  },

  'click .sentence-with-cloze': function(event) {
    const clusterKC = parseInt(event.currentTarget.getAttribute('clusterKC'));
    Session.set('curClozeSentencePairClusterKC', clusterKC);
    $('#extracted-clozes').find('[clusterKC=' + clusterKC + ']').get(0).scrollIntoView();
  },

  'click #submit-btn': function(event) {
    clozesComeFromTemplate = false;
    const inputText = $('#source-text').val();
    console.log('inputText: ' + inputText);
    Meteor.call('getClozesFromText', inputText, function(err, result) {
      if (typeof(err) !== 'undefined') {
        console.log('Error getting clozes, mofacts side: ', err);
        alert('Couldn\'t generate clozes from source material: ', err);
      } else if (result.tag != 0) {
        const error = result.fields[0];
        console.log('Error getting clozes, content gen side: ' + error);
        alert('Couldn\'t generate clozes from source material: ' + error);
      } else {
        console.log(result);
        alert('Successfully generated clozes!');
        origTdfId = '';
        const sentences = result.fields[0].sentences;
        const clozes = result.fields[0].clozes;
        for (const cloze of clozes) {
          cloze.unitIndex = 0;
        }
        clusterListMappings = {
          0: {
            orig: 0,
          },
        };
        Session.set('clozeSentencePairs', {
          'sentences': sentences,
          'clozes': clozes,
        });
        originalClozes = JSON.parse(JSON.stringify(clozes));
        fillOutItemLookupMaps(sentences, clozes);
        clozeEdits = [];
      }
    });
    alert('Depending on the length of text inputted, this operation may take a while.  Another popup will inform you once it has completed.');
  },

  'click #editClozeSaveButton': function(event) {
    console.log(event);
    const newClozeText = $('#clozeTextEdit').val();
    const correctResponse = $('#clozeResponseEdit').val();
    const editingCloze = Session.get('editingCloze');

    const clusterKC = editingCloze.clusterKC;
    const stimulusKC = editingCloze.stimulusKC;
    const paraphraseId = editingCloze.paraphraseId;

    if (newClozeText.indexOf('_') == -1) {
      alert('Please make sure to insert underscores to indicate a missing word.');
    } else if (correctResponse.length < 1) {
      alert('Please enter a correct response');
    } else {
      const oldCloze = stimulusKCtoClozesMap[stimulusKC].find((elem) => elem.paraphraseId == paraphraseId);
      const originalVersion = oldCloze.originalVersion === 'Same' ? oldCloze.clozeStimulus : oldCloze.originalVersion;

      const newCloze = {...oldCloze, originalVersion, clozeStimulus: newClozeText, correctResponse, clusterKC, stimulusKC, origStimIndex: oldCloze.origStimIndex};
      recordClozeEditHistory(oldCloze, newCloze);

      stimulusKCtoClozesMap[stimulusKC] = stimulusKCtoClozesMap[stimulusKC].filter((clozeItem) => clozeItem.paraphraseId != paraphraseId);
      stimulusKCtoClozesMap[stimulusKC].push(newCloze);

      const clozeSentencePairs = Session.get('clozeSentencePairs');
      const editingClozeIndex = clozeSentencePairs.clozes.findIndex( (cloze) => cloze.stimulusKC == stimulusKC && cloze.paraphraseId == paraphraseId);
      clozeSentencePairs.clozes.splice(editingClozeIndex, 1, newCloze);
      // clozeSentencePairs.clozes = clozeSentencePairs.clozes.filter((cloze) => cloze.stimulusKC != stimulusKC);
      // clozeSentencePairs.clozes.push(newCloze);
      Session.set('clozeSentencePairs', clozeSentencePairs);

      $('#edit-modal').modal('hide');
      $('#clozeResponseEdit').val('');
    }
  },

  'click #save-btn-final': function(event) {
    generateAndSubmitTDFAndStimFiles();
  },

  'click #save-btn': function(event) {
    $('#save-modal').modal('show');
  },

  'click #edit-btn': function(event) {
    const stimulusKC = parseInt(event.currentTarget.getAttribute('stimulusKC'));
    const clusterKC = parseInt(event.currentTarget.getAttribute('clusterKC'));
    const curParaphraseId = parseInt(event.currentTarget.getAttribute('paraphrase-id'));

    console.log('stimulusKC: ', stimulusKC, ', clusterKC: ', clusterKC, ', curParaphraseId: ', curParaphraseId);

    Session.set('curClozeSentencePairClusterKC', clusterKC);
    Session.set('editingClozeUID', stimulusKC);

    let curCloze;

    for (const cloze of stimulusKCtoClozesMap[stimulusKC]) {
      if (cloze.paraphraseId == curParaphraseId) {
        curCloze = cloze;
        console.log('edit cloze:', curCloze);
        break;
      }
    }

    const curSentence = clusterKCtoSentenceMap[clusterKC];
    Session.set('editingCloze', curCloze);
    if (curSentence) {
      Session.set('editingSentence', curSentence);
    } else {
      $('#clozeTextEdit').val('');
      Session.set('editingSentence', {});
    }
    $('#edit-modal').modal('show');
  },

  'change #select-delete': function(event) {
    let selectedForDelete = Session.get('selectedForDelete') || [];

    const selectedCloze = {
      stimulusKC: parseInt(event.target.getAttribute('stimulusKC')),
      clusterKC: parseInt(event.target.getAttribute('clusterKC')),
      paraphraseId: parseInt(event.target.getAttribute('paraphrase-id')),
    };

    if (event.target.checked) {
      selectedForDelete.push(selectedCloze);
    } else {
      selectedForDelete = _.filter(selectedForDelete, function(c) {
        return c.paraphraseId != selectedCloze.paraphraseId;
      });
    }

    Session.set('selectedForDelete', selectedForDelete);
  },

  'click #delete-selected': function(event) {
    const selectedForDelete = Session.get('selectedForDelete');

    selectedForDelete.forEach(function(selectedCloze) {
      const stimulusKC = selectedCloze.stimulusKC;
      const clusterKC = selectedCloze.clusterKC;
      const curParaphraseId = selectedCloze.paraphraseId;
      deleteCloze(stimulusKC, clusterKC, curParaphraseId);
    });

    Session.set('selectedForDelete', []);

    $('input:checkbox').removeAttr('checked');
  },

  'click #delete-btn': function(event) {
    const stimulusKC = parseInt(event.currentTarget.getAttribute('stimulusKC'));
    const clusterKC = parseInt(event.currentTarget.getAttribute('clusterKC'));
    const curParaphraseId = parseInt(event.currentTarget.getAttribute('paraphrase-id'));
    deleteCloze(stimulusKC, clusterKC, curParaphraseId);
  },

  'change #templateTDFSelect': async function(event) {
    finalDidYouReadQuestion = undefined;
    clozesComeFromTemplate = true;
    clusterListMappings = {};
    stimUnitMappings = {};
    origTdfId = $(event.currentTarget).val();
    console.log('origTdfId: ' + origTdfId);
    const stimObject = tdfIdToStimuliSetMap[origTdfId];
    console.log('stimObject: ', stimObject);
    const tdfObject = tdfIdToTdfFileMap[origTdfId];
    const units = tdfObject.tdfs.tutor.unit;
    // NOTE: We are currently assuming that multiTdfs will have only three units: an instruction unit, an assessment session with exactly one question which is the last
    // item in the stim file, and a unit with all clusters specified in the generated subtdfs array
    if (tdfObject.isMultiTdf) {
      // Do nothing, multiTdfs will be processed without clusterlistmappings, elsewhere
    } else {
      for (const unitIndex in units) {
        const unit = units[unitIndex];
        if (!!unit.learningsession || !!unit.assessmentsession) {
          const session = unit.learningsession || unit.assessmentsession;
          const unitType = unit.learningsession ? MODEL_UNIT : SCHEDULE_UNIT;
          const stimIndices = rangeVal(session[0].clusterlist[0]);
          clusterListMappings[unitIndex] = {
            orig: unitIndex,
            new: undefined,
            stimIndices,
          };
          for (const stimIndex of stimIndices) {
            stimUnitMappings[stimIndex] = {
              unitIndex,
              unitType,
            };
          }
        }
      }
    }

    if (!!tdfObject.tdfs.tutor.setspec[0].speechAPIKey && !!tdfObject.tdfs.tutor.setspec[0].speechAPIKey[0]) {
      speechAPIKey = tdfObject.tdfs.tutor.setspec[0].speechAPIKey[0];
    } else {
      speechAPIKey = null;
    }
    if (!!tdfObject.tdfs.tutor.setspec[0].textToSpeechAPIKey && !!tdfObject.tdfs.tutor.setspec[0].textToSpeechAPIKey[0]) {
      textToSpeechAPIKey = tdfObject.tdfs.tutor.setspec[0].textToSpeechAPIKey[0];
    } else {
      textToSpeechAPIKey = null;
    }
    setClozesFromStimObject(stimObject, tdfObject.isMultiTdf);
    clozeEdits = [];
  },
});

Template.contentGeneration.helpers({
  sentences: () => Session.get('clozeSentencePairs').sentences,
  clozes: () => Session.get('clozeSentencePairs').clozes,
  clozesSelected: () => Session.get('selectedForDelete').length > 0,
  editingCloze: () => Session.get('editingCloze').clozeStimulus,
  editingClozeResponse: () => Session.get('editingCloze').correctResponse,
  editingSentence: () => Session.get('editingSentence').sentence,
  contentGenerationAllTdfs: () => Session.get('contentGenerationAllTdfs'),
  tdfOwnersMap: (ownerId) => Session.get('tdfOwnersMap')[ownerId],

  isCurrentPair: function(clusterKC) {
    return clusterKC === Session.get('curClozeSentencePairClusterKC');
  },

  isCoreference: function(paraphraseId) {
    const cloze = !!Session.get('clozeSentencePairs') && Session.get('clozeSentencePairs').clozes ? Session.get('clozeSentencePairs').clozes.find((cloze) => cloze.paraphraseId == paraphraseId) : undefined;
    if (!cloze) console.log('isCoreference, not found: ' + paraphraseId);
    return cloze ? cloze.isCoreference : false;
  },

  isCorefReverted: function(paraphraseId) {
    const cloze = Session.get('clozeSentencePairs').clozes.find((cloze) => cloze.paraphraseId == paraphraseId);
    if (!cloze) console.log('isCorefReverted, not found: ' + paraphraseId);
    return cloze ? !(cloze.tags.originalItem) : false;
  },

  convertBoolToYesNo: function(mybool) {
    return mybool ? 'Yes' : 'No';
  },

  currentCloze: function() {
    const curClozeClusterKC = Session.get('curClozeSentencePairClusterKC');
    let curClozeText;
    _.map(Session.get('clozeSentencePairs').clozes, function(c) {
      if (c.clusterKC === curClozeClusterKC) {
        curClozeText = c.clozeStimulus;
      }
    });
    return curClozeText;
  },
});

const templateTDFJSON = {
  'fileName': '',
  'tdfs': {
    'tutor': {
      'setspec': [
        {
          'lessonname': [
            '',
          ],
          'userselect': [
            'true',
          ],
          'stimulusfile': [
            '',
          ],
          'lfparameter': [
            '.85',
          ],
        },
      ],
      'unit': [
        {
          'unitinstructions': [
            '\n          <center><h3>Practice Instructions</h3></center><br>\nPractice the clozes by entering the missing fill-in word.',
          ],
          'unitname': [
            'Content Generated from text extract',
          ],
          'learningsession': [
            {
              'clusterlist': [
                '',
              ],
              'unitMode': [
                'thresholdCeiling',
              ],
            },
          ],
          'deliveryparams': [
            {
              'drill': [
                '30000',
              ],
              'purestudy': [
                '16000',
              ],
              'skipstudy': [
                'false',
              ],
              'reviewstudy': [
                '16000',
              ],
              'correctprompt': [
                '750',
              ],
              'fontsize': [
                '3',
              ],
              'correctscore': [
                '1',
              ],
              'incorrectscore': [
                '0',
              ],
            },
          ],
        },
      ],
    },
  },
  'ownerId': '',
  'source': 'content_generation',
};
