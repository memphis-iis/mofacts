import { curSemester, STIM_PARAMETER, MODEL_UNIT, SCHEDULE_UNIT } from '../../../common/Definitions';
import { Tracker } from 'meteor/tracker';
import { DynamicTdfGenerator } from "../../../common/DynamicTdfGenerator";
import { rangeVal } from "../../lib/currentTestingHelpers";

Session.set("curClozeSentencePairClusterKC", "");
Session.set("clozeSentencePairs", {});
Session.set("clozeHistory", []);
Session.set("selectedForDelete",[]);
Session.set("editingSentence",{});
Session.set("editingCloze",{});
Session.set("tdfOwnersMap", {});
clusterKCtoSentenceMap = {};
clusterKCtoClozesMap = {};
stimulusKCtoClozesMap = {};
speechAPIKey = undefined;
textToSpeechAPIKey = undefined;
originalClozes = undefined;
origTdfId = undefined;
clusterListMappings = {};
stimUnitMappings = {};
clozeEdits = [];
clozesComeFromTemplate = undefined;
tdfIdToTdfFileMap = {};
tdfIdToStimuliSetMap = {};

finalDidYouReadQuestion = undefined;

function recordClozeEditHistory(oldCloze,newCloze){
  var timestamp = Date.now();
  console.log(new Date(timestamp).toString() + ":" + JSON.stringify(oldCloze) + "|" + JSON.stringify(newCloze));
  clozeEdits.push({startingCloze:oldCloze,endingCloze:newCloze,timestamp:timestamp});
}

async function setAllTdfs(ownerMapCallback){
  allTdfs = [];
  let ownerIds = [];
  let stimSetIds = Session.get("allTdfs").map(x => x.stimuliSetId);
  let allStims = await meteorCallAsync('getStimuliSetsForIdSet',stimSetIds);
  Session.get("allTdfs").forEach(function(tdf){
    if(tdf.content.fileName.indexOf(curSemester) == -1) return;

    let tdfid = tdf.TDFId;
    let tdfStimSetId = tdf.stimuliSetId;
    let tdfFile = tdf.content;
    tdfIdToTdfFileMap[tdfid] = tdfFile;
    tdfIdToStimuliSetMap[tdfid] = allStims.filter(x => x.stimuliSetId == tdfStimSetId);

    var displayName = tdfFile.tdfs.tutor.setspec[0].lessonname[0];
    let displayDate = "";
    if (tdfFile.createdAt) {
      let date = new Date(tdfFile.createdAt);
      displayDate = (date.getMonth() + 1) + '/' + date.getDate() + '/' + date.getFullYear(); 
    }
    let ownerId = tdf.ownerId;
    ownerIds.push(tdf.ownerId);
    allTdfs.push({tdfid, displayName, ownerId, displayDate});
  });
  ownerMapCallback(ownerIds);
  Session.set("contentGenerationAllTdfs",allTdfs);
}

function getTdfOwnersMap(ownerIds) {
  Meteor.call('getTdfOwnersMap', ownerIds, function(err, res) {
    if (err) {
      console.log(err);
    } else {
      Session.set("tdfOwnersMap", res);
    }
  });
}

async function setClozesFromStimObject(stimObject,isMultiTdf){
  console.log("setClozesFromStimObject");
  const MULTITDF_MAIN_CLUSTER_UNIT = 2;
  const LOWER_BOUND_RANDOM = -9999999999;
  const UPPER_BOUND_RANDOM = 9999999999;
  let allClozes = [];
  let stimuliSetId = stimObject[0].stimuliSetId;
  let sourceSentences = await meteorCallAsync('getSourceSentences',stimuliSetId);
  fillOutSentenceLookupMap(sourceSentences);
  let originalOrderIndex = 0;

  for(let index=0;index<stimObject.length;index++){ //[{},{}]
    let stim = stimObject[index];
    console.log("stim " + index + ", ",stim);
    if(stim.clozeStimulus == "Did you read the chapter (yes/no)?"){
      finalDidYouReadQuestion = stim;
      continue;
    }
    //cluster,clusterUnitIndex,index,originalOrderIndex)
    let clusterKC;
    let sourceSentence;
    if(stim.clusterKC){
      clusterKC = stim.clusterKC;
    }else if(stim.tags && stims.tags.itemId){
      clusterKC = cluster.stims[0].tags.itemId;
      sourceSentence = clusterKCtoSentenceMap[clusterKC].sentence;
    }else{
      clusterKC = _.random(LOWER_BOUND_RANDOM,UPPER_BOUND_RANDOM);
    }

    let cloze = stim.clozeStimulus || stim.textStimulus;
    console.log("stim " + index + ", ",cloze);

    let correctResponse = stim.correctResponse;
    let stimulusKC = stim.stimulusKC ? stim.stimulusKC :
                     stim.tags && stim.tags.clozeId ? stim.tags.clozeId : 
                     _.random(LOWER_BOUND_RANDOM,UPPER_BOUND_RANDOM);
    let paraphraseId = _.random(LOWER_BOUND_RANDOM,UPPER_BOUND_RANDOM);
    let isCoreference = !!stim.tags && !!stim.tags.clozeCorefTransformation;
    let unitIndex = isMultiTdf ? MULTITDF_MAIN_CLUSTER_UNIT : stimUnitMappings[index];
    let unitType = undefined;
    if(!stimUnitMappings[index] || _.isEmpty(stimUnitMappings[index])){
      if(isMultiTdf){
        //do nothing, multitdfs ignore a lot of mapping
      }else{
        console.log("no stim unit mappings for index:",index,stimUnitMappings[index]);
        continue;
      }
    }else{
      unitType = stimUnitMappings[index].unitType;
    }
    console.log("unitType:",unitType,isMultiTdf);
    if(isMultiTdf || unitType == MODEL_UNIT){
      allClozes.push({
        unitIndex, cloze, correctResponse, stimulusKC, clusterKC, paraphraseId, originalOrderIndex, isCoreference, sourceSentence,
        origStimIndex: index,
        isParaphrase: false,
        tags:stim.tags,
        originalVersion:  isCoreference ? stim.tags.originalItem : "Same"
      });
      originalOrderIndex += 1;
      if(stim.alternateDisplays){
        for(let altDisplay of stim.alternateDisplays){
          paraphraseId = _.random(LOWER_BOUND_RANDOM,UPPER_BOUND_RANDOM);
          let altCloze = altDisplay.clozeText;
          allClozes.push({
            unitIndex, correctResponse, stimulusKC, clusterKC, paraphraseId, originalOrderIndex, sourceSentence,
            cloze:altCloze,
            origStimIndex: index,
            isParaphrase: true,
            tags:stim.tags,
            originalVersion: cloze,
            isCoreference: false, //for now we don't layer coref resolution and paraphrasing
          });
          originalOrderIndex += 1;
        }
      }
    }
  }

  Session.set("clozeSentencePairs", {
    "sentences":sourceSentences,
    "clozes":allClozes
  });
  originalClozes = JSON.parse(JSON.stringify(allClozes));
  fillOutItemLookupMaps(allClozes);
}

function fillOutSentenceLookupMap(sentences){
  clusterKCtoSentenceMap = {};
  for(var sentenceIndex in sentences){
    var sentence = sentences[sentenceIndex];
    var clusterKC = parseInt(sentence.clusterKC);
    clusterKCtoSentenceMap[clusterKC] = sentence;
  }
}

function fillOutItemLookupMaps(clozes){
  stimulusKCtoClozesMap = {};
  clusterKCtoClozesMap = {};

  for(let cloze of clozes){
    if(!stimulusKCtoClozesMap[cloze.stimulusKC]){
      stimulusKCtoClozesMap[cloze.stimulusKC] = [];
    }
    stimulusKCtoClozesMap[cloze.stimulusKC].push(cloze);
    var clusterKC = cloze.clusterKC;
    if(!clusterKCtoClozesMap[clusterKC]){
      clusterKCtoClozesMap[clusterKC] = [];
    }
    clusterKCtoClozesMap[clusterKC].push(cloze);
  }
}

function saveEditHistory(originalClozes,newClozes){
  var history = {
    originalClozes:originalClozes,
    endingClozes:newClozes,
    clozeEdits:clozeEdits,
    user:Meteor.userId(),
    timestamp:Date.now().toString(),
    templateTdf:origTdfId
  };
  Meteor.call('insertClozeEditHistory',history,function(err,result){
    if(!!err){
      console.log("error saving cloze edit history: " + JSON.stringify(err));
    }else{
      console.log("saving cloze edit history results: " + JSON.stringify(result));
    }
  });

  clozeEdits = [];
}

function generateAndSubmitTDFAndStimFiles(){
  var clozes = Session.get('clozeSentencePairs').clozes;
  console.log('Generating TDF with clozes: ',clozes);
  var displayName = $("#tdfDisplayNameTextBox").val();
  var curUserName = Meteor.user().username.split('@')[0].replace(/[.]/g,"_");
  let curDate = new Date();
  var curDateTime = curDate.toISOString().replace(/-/g,'_').replace(/:/g,'_').replace(/[.]/g,'_');
  var tdfFileName = displayName.replace(/ /g,"_") + "_" + curUserName + "_" + curDateTime + "_" + curSemester + "_TDF.xml";

  let isMultiTdf = false;
  if(clozesComeFromTemplate){
    var tdfTemplateId = $("#templateTDFSelect").val();
    var originalTDF = tdfIdToTdfFileMap[tdfTemplateId];
    isMultiTdf = originalTDF.isMultiTdf;
  }
  
  var newStimJSON = generateStimJSON(clozes,isMultiTdf);
  var newTDFJSON = generateTDFJSON(tdfFileName,displayName,newStimJSON);
  let wrappedTDF = {
    ownerId: Meteor.userId(),
    visibility: 'profileSouthwestOnly',
    content: newTDFJSON
  }
  
  let sourceSentences = Session.get("clozeSentencePairs").sentences;

  //Clean up after ourselves
  for(var unitIndex in clusterListMappings) {
    clusterListMappings[unitIndex].new = undefined;
  }

  Meteor.call("insertStimTDFPair",newStimJSON,wrappedTDF,sourceSentences,function(err,res){
    if(!!err){
      console.log("Error inserting stim/tdf pair: " + err);
      alert("Error creating content: " + err);
    }else{
      let tdfid = res;
      console.log("Inserting stim/tdf pair result: " + res);
      saveEditHistory(originalClozes,clozes);

      let displayDate = (curDate.getMonth() + 1) + '/' + curDate.getDate() + '/' + curDate.getFullYear(); 
      let ownerId = Meteor.userId();
      let newTdfInfo = {tdfid, displayName, ownerId, displayDate};
      Session.set("contentGenerationAllTdfs",Session.get("contentGenerationAllTdfs").concat(newTdfInfo));

      let tempTdfOwnersMap = Session.get("tdfOwnersMap");
      tempTdfOwnersMap[ownerId] = Meteor.user().username;
      Session.set("tdfOwnersMap", tempTdfOwnersMap);

      tdfIdToTdfFileMap[tdfid] = newTDFJSON;
      tdfIdToStimuliSetMap[tdfid] = newStimJSON;
      alert("Saved Successfully!");
      $("#tdfDisplayNameTextBox").val("");
      $("#save-modal").modal('hide');
    }
  });
  console.log("newStimJSON: " + JSON.stringify(newStimJSON));
  console.log("newTDFJSON: " + JSON.stringify(newTDFJSON));
}

function getStimForCloze(stimulusKC,cloze){
  let stim = {clozeText:"",response:{},params:STIM_PARAMETER,tags:[]};
  let curStimClozes = stimulusKCtoClozesMap[stimulusKC];
  stim.correctResponse = curStimClozes[0].correctResponse;
  stim.tags = curStimClozes[0].tags;
  if(curStimClozes.length > 1){ //this means there are paraphrases as they share the same cloze id
    stim.alternateDisplays = [];
    for(let cloze2 of curStimClozes){
      if(cloze2.isParaphrase){
        stim.alternateDisplays.push({"clozeText":cloze2.cloze});
      }else{
        stim.clozeText = cloze2.cloze;
      }
    }
    if(!stim.clozeText){
      stim.clozeText = stim.alternateDisplays.pop();
      if(stim.alternateDisplays.length == 0){
        delete stim.alternateDisplays;
      }
    }
  }else{
    stim.clozeText = cloze.cloze;
  }

  return stim;
}

function generateStimJSON(clozes,isMultiTdf){
  origStim = tdfIdToStimuliSetMap[origTdfId];
  curStim = [];

  let completedClusterKCs = {};
  let curClusterIndex = 0;
  for(let index in clozes){
    let clusterKC = clozes[index].clusterKC;
    if(!completedClusterKCs[clusterKC]){
      completedClusterKCs[clusterKC] = true;
      let curSentenceClozes = clusterKCtoClozesMap[clusterKC];
      if(curSentenceClozes.length == 0){
        continue;
      }
      if(!isMultiTdf){
        let unitIndex = clozes[index].unitIndex;
        if(!!!(clusterListMappings[unitIndex].new)){
          clusterListMappings[unitIndex].new = curClusterIndex;
        }
      }

      let completedStimulusKCs = {};
      for(let cloze of curSentenceClozes){
        let stimulusKC = cloze.stimulusKC;
        if(!completedStimulusKCs[stimulusKC]){
          let stim = getStimForCloze(stimulusKC,cloze);
          curStim.push(stim);//[{},{}]
          completedStimulusKCs[stimulusKC] = true;
        }
      }
      curClusterIndex += 1;
    }
  }

  //Add back assessment session/non learning session clusters
  if(!isMultiTdf){
    for(let unitMapping of clusterListMappings){
      if(!!!unitMapping.new){
        unitMapping.new = curClusterIndex;
        curClusterIndex += 1;
        let stimIndices = unitMapping.stimIndices;

        for(let stimIndex of stimIndices){
          let stim = origStim[stimIndex];//[{},{}]
          curStim.push(stim);//[{},{}] 
        }
      }
    }
  }

  if(finalDidYouReadQuestion){
    curStim.push(finalDidYouReadQuestion);//[{},{}]
  }

  return curStim;
}

function generateTDFJSON(tdfFileName,displayName,stimFileName,newStimJSON){
  console.log("clusterListMappings: " + JSON.stringify(clusterListMappings));
  let curTdf = undefined;

  if(clozesComeFromTemplate){
    let tdfTemplateFileName = $("#templateTDFSelect").val();
    let originalTDF = tdfIdToTdfFileMap[tdfTemplateFileName];
    curTdf = JSON.parse(JSON.stringify(originalTDF));
  }else{
    curTdf = JSON.parse(JSON.stringify(templateTDFJSON));
  }

  delete curTdf._id;
  let isMultiTdf = curTdf.isMultiTdf;

  if(isMultiTdf){
    let tdfGenerator = new DynamicTdfGenerator(curTdf.tdfs, tdfFileName, Meteor.userId(), 'content_generation', newStimJSON);
    let generatedTdf = tdfGenerator.getGeneratedTdf();
    curTdf = generatedTdf;

    let lastStim = newStimJSON.length - 1; //[{},{}]
    curTdf.tdfs.tutor.unit[1].assessmentsession[0].clusterlist = [lastStim + "-" + lastStim];
    
    console.log("curTdf.subTdfs: " + JSON.stringify(curTdf.subTdfs));
  }else{
    for(var unitIndex in clusterListMappings){
      var isLearningSession = clusterListMappings[unitIndex].unitType === MODEL_UNIT;
      var unit = curTdf.tdfs.tutor.unit[unitIndex];
      let clusterlist = isLearningSession ? unit.learningsession[0].clusterlist : unit.assessmentsession[0].clusterlist;
      clusterlist[0] = clusterListMappings[unitIndex].new;
    }
    curTdf.createdAt = new Date();
    curTdf.ownerId = Meteor.userId();
    curTdf.fileName = tdfFileName;
  }

  curTdf.tdfs.tutor.setspec[0].lessonname = [displayName];
  curTdf.tdfs.tutor.setspec[0].stimulusfile = [stimFileName];
  
  if(typeof(speechAPIKey) !== "undefined"){
    curTdf.tdfs.tutor.setspec[0].speechAPIKey = [speechAPIKey];
  }
  if(typeof(speechAPIKey) !== "undefined"){
    curTdf.tdfs.tutor.setspec[0].textToSpeechAPIKey = [textToSpeechAPIKey];
  }

  return curTdf;
}

function updateLookupMaps(stimulusKC,clusterKC,paraphraseId,oldCloze,newCloze){
  console.log("updateLookupMaps: ",oldCloze,newCloze);
  recordClozeEditHistory(oldCloze,newCloze);
  stimulusKCtoClozesMap[stimulusKC] = stimulusKCtoClozesMap[stimulusKC].filter((clozeItem) => clozeItem.stimulusKC == stimulusKC && clozeItem.paraphraseId != paraphraseId);
  clusterKCtoClozesMap[clusterKC] = clusterKCtoClozesMap[clusterKC].filter((clozeItem) => clozeItem.stimulusKC == stimulusKC && clozeItem.paraphraseId != paraphraseId);

  let prevClozeSentencePairs = Session.get("clozeSentencePairs");
  let newSentences = prevClozeSentencePairs.sentences;
  let newClozes = prevClozeSentencePairs.clozes;
  let curClozeIndex = prevClozeSentencePairs.clozes.findIndex(function(c) {return c.stimulusKC == stimulusKC && c.paraphraseId == paraphraseId});
  
  if(newCloze && Object.keys(newCloze).length > 0){
    stimulusKCtoClozesMap[stimulusKC].push(newCloze);
    clusterKCtoClozesMap[clusterKC].push(newCloze);
    newClozes.splice(curClozeIndex,1,newCloze);
  }else{ //We've delete a cloze so we should make sure to check if a sentence no longer has a cloze
    newClozes.splice(curClozeIndex,1);
    newSentences = _.map(prevClozeSentencePairs.sentences, function(s) {
      if(s.clusterKC === clusterKC) {
        var matchingClozes = _.filter(newClozes, function(c) {
          return c.clusterKC === s.clusterKC;
        });
        if(matchingClozes.length == 0) s.hasCloze = false;
      }
      
      return s;
    });
  }

  Session.set("clozeSentencePairs", {
    'sentences':newSentences,
    'clozes':newClozes
  });
}

function deleteCloze(stimulusKC,clusterKC,paraphraseId){
  let oldCloze = JSON.parse(JSON.stringify(stimulusKCtoClozesMap[stimulusKC].find((elem) => elem.paraphraseId == paraphraseId)));
  updateLookupMaps(stimulusKC,clusterKC,paraphraseId,oldCloze,{});
}

function sortClozes(sortingMethod){
  console.log("sorting clozes by: " + sortingMethod);
  let clozeSentencePairs = JSON.parse(JSON.stringify(Session.get("clozeSentencePairs")));
  let clozes = clozeSentencePairs.clozes;

  switch(sortingMethod){
    case "originalOrderIndex":
      clozes = clozes.sort(function(a,b){
        if(a.originalOrderIndex == b.originalOrderIndex) return 0;
        if(a.originalOrderIndex < b.originalOrderIndex) return -1;
        return 1;
      });
      break;
    case "sentenceWeight":
      clozes = clozes.sort(function(a,b){
        if(a.tags.sentenceWeight == b.tags.sentenceWeight) return 0;
        if(a.tags.sentenceWeight < b.tags.sentenceWeight) return -1;
        return 1;
      });
      break;
    case "coreference":
      clozes = clozes.sort(function(a,b){
        if(a.tags.clozeCorefTransformation && b.tags.clozeCorefTransformation) return 0;
        if(a.tags.clozeCorefTransformation) return -1;
        if(b.tags.clozeCorefTransformation) return 1;
        return 0;
      });
      break;
    case "paraphrase":
      clozes = clozes.sort(function(a,b){
        if(a.isParaphrase && b.isParaphrase) return 0;
        if(a.isParaphrase) return -1;
        if(b.isParaphrase) return 1;
        return 0;
      });
      break;
  }

  clozeSentencePairs.clozes = clozes;
  Session.set("clozeSentencePairs",clozeSentencePairs);
}

Template.contentGeneration.onRendered(async function(){
  $('html,body').scrollTop(0);
  Session.set("curClozeSentencePairClusterKC", "");
  Session.set("clozeSentencePairs", {});
  Session.set("clozeHistory", []);
  Session.set("selectedForDelete",[]);
  Session.set("editingSentence",{});
  Session.set("editingCloze",{});
  Session.set("tdfOwnersMap", {});
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

  console.log("contentGeneration rendered");
  setAllTdfs(getTdfOwnersMap);

  let template = this;
  template.autorun(() => {
    Session.get("clozeSentencePairs");
    Tracker.afterFlush(() => {
      $('.cloze-checkbox').shiftSelectable();
    });
  });

  $("#templateTDFSelect").select2();
});

Template.contentGeneration.events({
  'click #revertCoreference': function(event){
    let stimulusKC = parseInt(event.currentTarget.getAttribute('stimulusKC'));
    let clusterKC = parseInt(event.currentTarget.getAttribute('clusterKC'));
    let curParaphraseId = parseInt(event.currentTarget.getAttribute('paraphrase-id'));
    let clozeSentencePairs = Session.get("clozeSentencePairs");

    let oldCloze = clozeSentencePairs.clozes.find((cloze) => cloze.paraphraseId == curParaphraseId);
    let newCloze = JSON.parse(JSON.stringify(oldCloze));

    let originalText = JSON.parse(JSON.stringify(newCloze.tags.originalItem));
    delete newCloze.tags.originalItem;
    newCloze.cloze = originalText;

    updateLookupMaps(stimulusKC,clusterKC,curParaphraseId,oldCloze,newCloze);
  },

  'click #redoCoreference': function(event){
    let stimulusKC = parseInt(event.currentTarget.getAttribute('stimulusKC'));
    let clusterKC = parseInt(event.currentTarget.getAttribute('clusterKC'));
    let curParaphraseId = parseInt(event.currentTarget.getAttribute('paraphrase-id'));
    let clozeSentencePairs = Session.get("clozeSentencePairs");

    let oldCloze = JSON.parse(JSON.stringify(clozeSentencePairs.clozes.find((cloze) => cloze.paraphraseId == curParaphraseId)));
    let newCloze = JSON.parse(JSON.stringify(oldCloze));

    let originalText = JSON.parse(JSON.stringify(newCloze.cloze));
    newCloze.tags.originalItem = originalText;
    newCloze.cloze = JSON.parse(JSON.stringify(newCloze.tags.clozeCorefTransformation));

    updateLookupMaps(stimulusKC,clusterKC,curParaphraseId,oldCloze,newCloze);
  },

  'click #cloze': function(event){
    var clusterKC = parseInt(event.currentTarget.getAttribute('clusterKC'));
    Session.set("curClozeSentencePairClusterKC", clusterKC);
    var parsedSentencesMatchingSentence = $("#parsed-sentences").find("[clusterKC=" + clusterKC + "]").get(0);
    if(!!parsedSentencesMatchingSentence){
      parsedSentencesMatchingSentence.scrollIntoView();
    }
  },

  'click .sortingBtn': function(event){
    let sortProperty = event.currentTarget.getAttribute('sortProperty');
    sortClozes(sortProperty);
  },

  'click .sentence-with-cloze': function(event){
    var clusterKC = parseInt(event.currentTarget.getAttribute('clusterKC'));
    Session.set("curClozeSentencePairClusterKC", clusterKC);
    $("#extracted-clozes").find("[clusterKC=" + clusterKC + "]").get(0).scrollIntoView();
  },

  'click #submit-btn': function(event){
    clozesComeFromTemplate = false;
    let inputText = $("#source-text").val();
    console.log("inputText: " + inputText);
    Meteor.call('getClozesFromText',inputText,function(err,result){
      if(typeof(err) !== "undefined"){
        console.log("Error getting clozes, mofacts side: " + JSON.stringify(err));
        alert("Couldn't generate clozes from source material: " + JSON.stringify(err));
      }else if(result.tag != 0){
        let error = result.fields[0];
        console.log("Error getting clozes, content gen side: " + error);
        alert("Couldn't generate clozes from source material: " + error);
      }else{
        console.log(JSON.stringify(result));
        alert("Successfully generated clozes!");
        origTdfId = "";
        let sentences = result.fields[0].sentences;
        let clozes = result.fields[0].clozes;
        for(let cloze of clozes){
          cloze.unitIndex = 0;
        }
        clusterListMappings = {
          0:{
            orig:0
          }
        };
        Session.set("clozeSentencePairs", {
          "sentences":sentences,
          "clozes":clozes
        });
        originalClozes = JSON.parse(JSON.stringify(clozes));
        fillOutItemLookupMaps(sentences,clozes);
        clozeEdits = [];
      }
    });
    alert("Depending on the length of text inputted, this operation may take a while.  Another popup will inform you once it has completed.")
  },

  'click #editClozeSaveButton': function(event){
    console.log(event);
    let newClozeText = $("#clozeTextEdit").val();
    let correctResponse = $("#clozeResponseEdit").val();
    let editingCloze = Session.get("editingCloze");

    let clusterKC = editingCloze.clusterKC;
    let stimulusKC = editingCloze.stimulusKC;
    let paraphraseId = editingCloze.paraphraseId;
    
    if(newClozeText.indexOf("_") == -1){
      alert("Please make sure to insert underscores to indicate a missing word.");
    }else if (correctResponse.length < 1) {
      alert("Please enter a correct response");
    }else{
      let oldCloze = stimulusKCtoClozesMap[stimulusKC].find((elem) => elem.paraphraseId == paraphraseId);
      let originalVersion = oldCloze.originalVersion === "Same" ? oldCloze.cloze : oldCloze.originalVersion;

      let newCloze = {...oldCloze,originalVersion,cloze:newClozeText,correctResponse,clusterKC,stimulusKC,origStimIndex:oldCloze.origStimIndex};
      recordClozeEditHistory(oldCloze,newCloze);

      stimulusKCtoClozesMap[stimulusKC] = stimulusKCtoClozesMap[stimulusKC].filter((clozeItem) => clozeItem.paraphraseId != paraphraseId);
      stimulusKCtoClozesMap[stimulusKC].push(newCloze);

      let clozeSentencePairs = Session.get('clozeSentencePairs');
      clozeSentencePairs.clozes = clozeSentencePairs.clozes.filter((cloze) => cloze.stimulusKC != stimulusKC);
      clozeSentencePairs.clozes.push(newCloze);
      Session.set("clozeSentencePairs",clozeSentencePairs);

      $('#edit-modal').modal('hide');
      $("#clozeResponseEdit").val("");
    }
  },

  'click #save-btn-final': function(event){
    generateAndSubmitTDFAndStimFiles();
  },

  'click #save-btn': function(event){
    $('#save-modal').modal('show');
  },

  'click #edit-btn': function(event){
    let stimulusKC = parseInt(event.currentTarget.getAttribute('stimulusKC'));
    let clusterKC = parseInt(event.currentTarget.getAttribute('clusterKC'));
    let curParaphraseId = parseInt(event.currentTarget.getAttribute('paraphrase-id'));

    console.log("stimulusKC: ",stimulusKC,", clusterKC: ",clusterKC,", curParaphraseId: ",curParaphraseId);

    Session.set("curClozeSentencePairClusterKC", clusterKC);
    Session.set("editingClozeUID",stimulusKC);

    let curCloze;

    for(let cloze of stimulusKCtoClozesMap[stimulusKC]){
      if(cloze.paraphraseId == curParaphraseId){
        curCloze = cloze;
        break;
      }
    }

    let curSentence = clusterKCtoSentenceMap[clusterKC];
    Session.set("editingCloze",curCloze);
    if(!!curSentence){
      Session.set("editingSentence",curSentence);
    }else{
      $("#clozeTextEdit").val("");
      Session.set("editingSentence",{});
    }
    $('#edit-modal').modal('show');
  },

  'change #select-delete': function(event) {
    var selectedForDelete = Session.get("selectedForDelete") || [];

    var selectedCloze = {
      stimulusKC: parseInt(event.target.getAttribute('stimulusKC')),
      clusterKC: parseInt(event.target.getAttribute('clusterKC')),
      paraphraseId: parseInt(event.target.getAttribute('paraphrase-id'))
    }
    
    if (event.target.checked) {
      selectedForDelete.push(selectedCloze);
    } else {
      selectedForDelete = _.filter(selectedForDelete, function(c) {
        return c.paraphraseId != selectedCloze.paraphraseId;
      });
    }

    Session.set("selectedForDelete", selectedForDelete);
  },

  'click #delete-selected': function(event) {
    let selectedForDelete = Session.get("selectedForDelete");

    selectedForDelete.forEach(function(selectedCloze) {
      let stimulusKC = selectedCloze.stimulusKC;
      let clusterKC = selectedCloze.clusterKC;
      let curParaphraseId = selectedCloze.paraphraseId;
      deleteCloze(stimulusKC,clusterKC,curParaphraseId);
    });

    Session.set("selectedForDelete",[]);

    $('input:checkbox').removeAttr('checked');
  },

  'click #delete-btn': function(event){
    let stimulusKC = parseInt(event.currentTarget.getAttribute('stimulusKC'));
    let clusterKC = parseInt(event.currentTarget.getAttribute('clusterKC'));
    let curParaphraseId = parseInt(event.currentTarget.getAttribute('paraphrase-id'));
    deleteCloze(stimulusKC,clusterKC,curParaphraseId);
  },

  "change #templateTDFSelect": async function(event){
    finalDidYouReadQuestion = undefined;
    clozesComeFromTemplate = true;
    clusterListMappings = {};
    stimUnitMappings = {};
    origTdfId = $(event.currentTarget).val();
    console.log("origTdfId: " + origTdfId);
    var stimObject = tdfIdToStimuliSetMap[origTdfId];
    console.log("stimObject: ",stimObject);
    var tdfObject = tdfIdToTdfFileMap[origTdfId];
    var units = tdfObject.tdfs.tutor.unit;
    //NOTE: We are currently assuming that multiTdfs will have only three units: an instruction unit, an assessment session with exactly one question which is the last
    //item in the stim file, and a unit with all clusters specified in the generated subtdfs array
    if(tdfObject.isMultiTdf){
      //Do nothing, multiTdfs will be processed without clusterlistmappings, elsewhere
    }else{
      for(var unitIndex in units){
        var unit = units[unitIndex];
        if(!!unit.learningsession || !!unit.assessmentsession){
          var session = unit.learningsession || unit.assessmentsession;
          var unitType = !!unit.learningsession ? MODEL_UNIT : SCHEDULE_UNIT;
          let stimIndices = rangeVal(session[0].clusterlist[0]);
          clusterListMappings[unitIndex] = {
            orig:unitIndex,
            new: undefined,
            stimIndices
          };
          for(let stimIndex of stimIndices){
            stimUnitMappings[stimIndex] = {
              unitIndex,
              unitType
            }
          }
        }
      }
    }
    
    if(!!tdfObject.tdfs.tutor.setspec[0].speechAPIKey && !!tdfObject.tdfs.tutor.setspec[0].speechAPIKey[0]){
      speechAPIKey = tdfObject.tdfs.tutor.setspec[0].speechAPIKey[0];
    }else{
      speechAPIKey = null;
    }
    if(!!tdfObject.tdfs.tutor.setspec[0].textToSpeechAPIKey && !!tdfObject.tdfs.tutor.setspec[0].textToSpeechAPIKey[0]){
      textToSpeechAPIKey = tdfObject.tdfs.tutor.setspec[0].textToSpeechAPIKey[0];
    }else{
      textToSpeechAPIKey = null;
    }
    setClozesFromStimObject(stimObject,tdfObject.isMultiTdf);
    clozeEdits = [];
  }
});

Template.contentGeneration.helpers({
  sentences: () => Session.get("clozeSentencePairs").sentences,
  clozes: () => Session.get("clozeSentencePairs").clozes,
  clozesSelected: () => Session.get("selectedForDelete").length > 0,
  editingCloze: () => Session.get("editingCloze").cloze,
  editingClozeResponse: () => Session.get("editingCloze").correctResponse,
  editingSentence: () => Session.get("editingSentence").sentence,
  contentGenerationAllTdfs: () => Session.get("contentGenerationAllTdfs"),
  tdfOwnersMap: ownerId => Session.get("tdfOwnersMap")[ownerId],

  isCurrentPair: function(clusterKC) {
    return clusterKC === Session.get("curClozeSentencePairClusterKC");
  },

  isCoreference: function(paraphraseId){
    let cloze = !!Session.get("clozeSentencePairs") && Session.get("clozeSentencePairs").clozes ? Session.get("clozeSentencePairs").clozes.find((cloze) => cloze.paraphraseId == paraphraseId) : undefined;
    if(!cloze) console.log("isCoreference, not found: " + paraphraseId)
    return !!(cloze) ? cloze.isCoreference : false;
  },

  isCorefReverted: function(paraphraseId){
    let cloze = Session.get("clozeSentencePairs").clozes.find((cloze) => cloze.paraphraseId == paraphraseId);
    if(!cloze) console.log("isCorefReverted, not found: " + paraphraseId)
    return !!(cloze) ? !(cloze.tags.originalItem) : false;
  },

  convertBoolToYesNo: function(mybool){
    return mybool ? "Yes" : "No";
  },

  currentCloze: function() {
    var curClozeClusterKC = Session.get("curClozeSentencePairClusterKC");
    var curClozeText;
    _.map(Session.get("clozeSentencePairs").clozes, function(c) {
      if (c.clusterKC === curClozeClusterKC) { curClozeText = c.cloze }
    });
    return curClozeText;
  }
});

let templateTDFJSON = {
  "fileName" : "",
  "tdfs" : {
      "tutor" : {
          "setspec" : [ 
              {
                  "lessonname" : [ 
                      ""
                  ],
                  "userselect" : [ 
                      "true"
                  ],
                  "stimulusfile" : [ 
                      ""
                  ],
                  "lfparameter" : [ 
                      ".85"
                  ]
              }
          ],
          "unit" : [ 
              {
                  "unitinstructions" : [ 
                      "\n          <center><h3>Practice Instructions</h3></center><br>\nPractice the clozes by entering the missing fill-in word."
                  ],
                  "unitname" : [ 
                      "Content Generated from text extract"
                  ],
                  "learningsession" : [ 
                      {
                          "clusterlist" : [ 
                              ""
                          ],
                          "unitMode" : [ 
                              "thresholdCeiling"
                          ]
                      }
                  ],
                  "deliveryparams" : [ 
                      {
                          "drill" : [ 
                              "30000"
                          ],
                          "purestudy" : [ 
                              "16000"
                          ],
                          "skipstudy" : [ 
                              "false"
                          ],
                          "reviewstudy" : [ 
                              "16000"
                          ],
                          "correctprompt" : [ 
                              "750"
                          ],
                          "fontsize" : [ 
                              "3"
                          ],
                          "correctscore" : [ 
                              "1"
                          ],
                          "incorrectscore" : [ 
                              "0"
                          ]
                      }
                  ]
              }
          ]
      }
  },
  "ownerId" : "",
  "source" : "content_generation"
}