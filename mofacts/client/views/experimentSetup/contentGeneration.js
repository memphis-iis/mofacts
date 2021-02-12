import { curSemester, MULTITDF_MAIN_CLUSTER_UNIT } from '../../../common/Definitions';
import { Tracker } from 'meteor/tracker';
import { DynamicTdfGenerator } from "../../../common/DynamicTdfGenerator";

Session.set("curClozeSentencePairItemId", "");
Session.set("clozeSentencePairs", {});
Session.set("clozeHistory", []);
Session.set("selectedForDelete",[]);
Session.set("editingSentence",{});
Session.set("editingCloze",{});
Session.set("tdfOwnersMap", {});
sentenceIDtoSentenceMap = {};
sentenceIDtoClozesMap = {};
clozeIDToClozesMap = {};
tdfFileNameToStimfileMap = {};
tdfFileNameToTdfFileMap = {};
speechAPIKey = undefined;
textToSpeechAPIKey = undefined;
originalClozes = undefined;
origTdfFileName = undefined;
clusterListMappings = {};
clozeEdits = [];
clozesComeFromTemplate = undefined;

finalDidYouReadQuestion = undefined;

const STIM_PARAMETER = "0,.7";

recordClozeEditHistory = function(oldCloze,newCloze){
  var timestamp = Date.now();
  console.log(new Date(timestamp).toString() + ":" + JSON.stringify(oldCloze) + "|" + JSON.stringify(newCloze));
  clozeEdits.push({startingCloze:oldCloze,endingCloze:newCloze,timestamp:timestamp});
}

function sortByDisplayDate(a,b){
  let aParts = a.displayDate.split('/');//MM/DD/YYYY
  let bParts = b.displayDate.split('/');
  if(a.displayDate == b.displayDate) return 0;
  if(aParts[2] < bParts[2]) return -1;
  if(aParts[2] > bParts[2]) return 1;
  if(aParts[0] < bParts[0]) return -1;
  if(aParts[0] > bParts[0]) return 1;
  if(aParts[1] < bParts[1]) return -1;
  if(aParts[1] > bParts[1]) return 1;
}

setAllTdfs = function(ownerMapCallback){
  allTdfs = [];
  let ownerIds = [];
  Meteor.subscribe('tdfs',function(){
    Tdfs.find({}).forEach(function(entry){
      try{
        var fileName = entry.fileName;
        if(fileName.indexOf(curSemester) != -1){
          var displayName = entry.tdfs.tutor.setspec[0].lessonname[0];
          var stimulusFile = entry.tdfs.tutor.setspec[0].stimulusfile[0];
          let displayDate = "";
          if (entry.createdAt) {
            let date = new Date(entry.createdAt);
            let day = date.getDate();
            if(("" + day).length == 1) day = "0" + day;

            let month = date.getMonth() + 1;
            if(("" + month).length == 1) month = "0" + month;

            displayDate = month + '/' + day + '/' + date.getFullYear(); 
          }
 
          let ownerId = entry.owner;
          ownerIds.push(entry.owner);
          var stimulusObject = Stimuli.findOne({"fileName":stimulusFile})
          allTdfs.push({'fileName':fileName,'displayName':displayName, 'ownerId': ownerId, "displayDate": displayDate || ""});
          tdfFileNameToTdfFileMap[fileName] = entry;
          tdfFileNameToStimfileMap[fileName] = stimulusObject;
        }
      }catch(err){
        console.log("error with setting all tdfs: " + JSON.stringify(err));
      }
    });
    ownerMapCallback(ownerIds);
    allTdfs.sort(sortByDisplayDate);
    Session.set('contentGenerationAllTdfs',allTdfs);
  });
}

getTdfOwnersMap = function(ownerIds) {
  Meteor.call('getTdfOwnersMap', ownerIds, function(err, res) {
    if (err) {
      console.log(err);
    } else {
      Session.set("tdfOwnersMap", res);
    }
  });
}

getStimsFromCluster = function(cluster,clusterUnitIndex,index,originalOrderIndex){
  const LOWER_BOUND_RANDOM = -9999999999;
  const UPPER_BOUND_RANDOM = 9999999999;
  let stimsForCluster = [];
  let sentenceId;
  let sourceSentence;
  if(cluster.stims && cluster.stims[0] && cluster.stims[0].tags && cluster.stims[0].tags.itemId){
    sentenceId = cluster.stims[0].tags.itemId;
    sourceSentence = sentenceIDtoSentenceMap[sentenceId].sentence;
  }else{
    sentenceId = _.random(LOWER_BOUND_RANDOM,UPPER_BOUND_RANDOM);
  }

  for(let stim of cluster.stims){
    let cloze = stim.display.clozeText;
    let correctResponse = stim.response.correctResponse;
    let clozeId = stim.tags && stim.tags.clozeId ? stim.tags.clozeId : _.random(LOWER_BOUND_RANDOM,UPPER_BOUND_RANDOM);
    let paraphraseId = _.random(LOWER_BOUND_RANDOM,UPPER_BOUND_RANDOM);
    let isCoreference = !!(stim.tags.clozeCorefTransformation);
    stimsForCluster.push({
      unitIndex:clusterUnitIndex,
      cloze:cloze,
      correctResponse:correctResponse,
      clozeId:clozeId,
      itemId:sentenceId,
      origStimIndex: index,
      isParaphrase: false,
      paraphraseId: paraphraseId,
      tags:stim.tags,
      sourceSentence:sourceSentence,
      originalOrderIndex:originalOrderIndex,
      originalVersion:  isCoreference ? stim.tags.originalItem : "Same",
      isCoreference: isCoreference 
    });
    originalOrderIndex += 1;
    if(stim.alternateDisplays){
      for(let altDisplay of stim.alternateDisplays){
        paraphraseId = _.random(LOWER_BOUND_RANDOM,UPPER_BOUND_RANDOM);
        let altCloze = altDisplay.clozeText;
        stimsForCluster.push({
          unitIndex:clusterUnitIndex,
          cloze:altCloze,
          correctResponse:correctResponse,
          clozeId:clozeId,
          itemId:sentenceId,
          origStimIndex: index,
          isParaphrase: true,
          paraphraseId: paraphraseId,
          tags:stim.tags,
          sourceSentence:sourceSentence,
          originalOrderIndex:originalOrderIndex,
          originalVersion: cloze,
          isCoreference: false, //for now we don't layer coref resolution and paraphrasing
        });
        originalOrderIndex += 1;
      }
    }
  }

  return stimsForCluster;
}

findClusterUnitData = function(index){
  let inLearningSession = false;
  let clusterUnitIndex = -1;
  for(let unitIndex in clusterListMappings){
    let mapping = clusterListMappings[unitIndex];
    let clusterListIndices = mapping.orig;
    if(index >= clusterListIndices[0] && index <= clusterListIndices[1]){
      inLearningSession = (mapping.sessionType === "learningsession");
      clusterUnitIndex = unitIndex;
      break;
    }
  }

  return {inLearningSession,clusterUnitIndex};
}

setClozesFromStimObject = function(stimObject,isMultiTdf){
  console.log("setClozesFromStimObject");
  let allClozes = [];
  let sourceSentences = stimObject.sourceSentences || [];
  fillOutSentenceLookupMap(sourceSentences);
  let originalOrderIndex = 0;

  let allClusters = stimObject.stimuli.setspec.clusters;
  for(let index in allClusters){
    let cluster = allClusters[index];
    if(cluster.stims[0].display.clozeText == "Did you read the chapter (yes/no)?"){
      finalDidYouReadQuestion = cluster;
      continue;
    }

    if(isMultiTdf){
      let curClusterClozes = getStimsFromCluster(cluster,MULTITDF_MAIN_CLUSTER_UNIT,index,originalOrderIndex);
      originalOrderIndex += curClusterClozes.length;
      allClozes = allClozes.concat(curClusterClozes);
    }else{
      let {inLearningSession, clusterUnitIndex} = findClusterUnitData(index);
  
      if (inLearningSession) {        
        let curClusterClozes = getStimsFromCluster(cluster,clusterUnitIndex,index,originalOrderIndex);
        originalOrderIndex += curClusterClozes.length;
        allClozes = allClozes.concat(curClusterClozes);
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

fillOutSentenceLookupMap = function(sentences){
  sentenceIDtoSentenceMap = {};
  for(var sentenceIndex in sentences){
    var sentence = sentences[sentenceIndex];
    var sentenceID = parseInt(sentence.itemId);
    sentenceIDtoSentenceMap[sentenceID] = sentence;
  }
}

fillOutItemLookupMaps = function(clozes){
  clozeIDToClozesMap = {};
  sentenceIDtoClozesMap = {};

  _.map(clozes,function(cloze){
      if(!clozeIDToClozesMap[cloze.clozeId]){
        clozeIDToClozesMap[cloze.clozeId] = [];
      }
      clozeIDToClozesMap[cloze.clozeId].push(cloze);
      var sentenceID = cloze.itemId;
      if(!sentenceIDtoClozesMap[sentenceID]){
        sentenceIDtoClozesMap[sentenceID] = [];
      }
      sentenceIDtoClozesMap[sentenceID].push(cloze);
  });
}

saveEditHistory = function(originalClozes,newClozes){
  var history = {
    originalClozes:originalClozes,
    endingClozes:newClozes,
    clozeEdits:clozeEdits,
    user:Meteor.userId(),
    timestamp:Date.now().toString(),
    templateTdf:origTdfFileName
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

generateAndSubmitTDFAndStimFiles = function(){
  var clozes = Session.get('clozeSentencePairs').clozes;
  console.log('Generating TDF with clozes: ' + JSON.stringify(clozes));
  var displayName = $("#tdfDisplayNameTextBox").val();
  var curUserName = Meteor.user().username.split('@')[0].replace(/[.]/g,"_");
  let curDate = new Date();
  var curDateTime = curDate.toISOString().replace(/-/g,'_').replace(/:/g,'_').replace(/[.]/g,'_');
  var tdfFileName = displayName.replace(/ /g,"_") + "_" + curUserName + "_" + curDateTime + "_" + curSemester + "_TDF.xml";
  var stimFileName = displayName.replace(/ /g,"_") + "_" + curUserName + "_" + curDateTime + "_" + curSemester + "_Stim.json";

  let isMultiTdf = false;
  if(clozesComeFromTemplate){
    var tdfTemplateFileName = $("#templateTDFSelect").val();
    var originalTDF = tdfFileNameToTdfFileMap[tdfTemplateFileName];
    isMultiTdf = originalTDF.isMultiTdf;
  }
  
  var newStimJSON = generateStimJSON(clozes,stimFileName,isMultiTdf);
  var newTDFJSON = generateTDFJSON(tdfFileName,displayName,stimFileName,newStimJSON);

  //Clean up after ourselves
  for(var unitIndex in clusterListMappings) {
    clusterListMappings[unitIndex].new = undefined;
  }

  Meteor.call("insertStimTDFPair",newStimJSON,newTDFJSON,function(err,res){
    if(!!err){
      console.log("Error inserting stim/tdf pair: " + err);
      alert("Error creating content: " + err);
    }else{
      console.log("Inserting stim/tdf pair result: " + res);
      saveEditHistory(originalClozes,clozes);
      //Update session variable used in tdfAssignmentEdit so that we can assign a tdf immediately after generation without reloading the page
      Session.set("allTdfFilenamesAndDisplayNames",Session.get("allTdfFilenamesAndDisplayNames").concat({fileName:tdfFileName,displayName:displayName}));
      
      let day = curDate.getDate();
      if(("" + day).length == 1) day = "0" + day;

      let month = curDate.getMonth() + 1;
      if(("" + month).length == 1) month = "0" + month;

      let displayDate = month + '/' + day + '/' + curDate.getFullYear(); 
      let ownerId = Meteor.userId();
      let newTdfInfo = {'fileName':tdfFileName,'displayName':displayName, 'ownerId': ownerId, "displayDate": displayDate};
      let allTdfs = Session.get("contentGenerationAllTdfs");
      allTdfs.concat(newTdfInfo);
      allTdfs.sort(sortByDisplayDate);
      Session.set("contentGenerationAllTdfs",allTdfs);

      let tempTdfOwnersMap = Session.get("tdfOwnersMap");
      tempTdfOwnersMap[ownerId] = Meteor.user().username;
      Session.set("tdfOwnersMap", tempTdfOwnersMap);

      tdfFileNameToTdfFileMap[tdfFileName] = newTDFJSON;
      tdfFileNameToStimfileMap[tdfFileName] = newStimJSON;
      alert("Saved Successfully!");
      $("#tdfDisplayNameTextBox").val("");
      $("#save-modal").modal('hide');
    }
  });
  console.log("newStimJSON: " + JSON.stringify(newStimJSON));
  console.log("newTDFJSON: " + JSON.stringify(newTDFJSON));
}

getStimForCloze = function(clozeID,cloze){
  let stim = {display:{"clozeText":""},response:{},parameter:STIM_PARAMETER,tags:[]};
  let curStimClozes = clozeIDToClozesMap[clozeID];
  stim.response = {"correctResponse":curStimClozes[0].correctResponse};
  stim.tags = curStimClozes[0].tags;
  if(curStimClozes.length > 1){ //this means there are paraphrases as they share the same cloze id
    stim.alternateDisplays = [];
    for(let cloze2 of curStimClozes){
      if(cloze2.isParaphrase){
        stim.alternateDisplays.push({"clozeText":cloze2.cloze});
      }else{
        stim.display.clozeText = cloze2.cloze;
      }
    }
    if(!stim.display.clozeText){
      stim.display.clozeText = stim.alternateDisplays.pop();
      if(stim.alternateDisplays.length == 0){
        delete stim.alternateDisplays;
      }
    }
  }else{
    stim.display.clozeText = cloze.cloze;
  }

  return stim;
}

generateStimJSON = function(clozes,stimFileName,isMultiTdf){
  origStim = tdfFileNameToStimfileMap[origTdfFileName];
  curStim = JSON.parse(JSON.stringify(templateStimJSON));

  let completedSentenceIDs = {};
  for(var index in clozes){
    let sentenceID = clozes[index].itemId;
    if(!completedSentenceIDs[sentenceID]){
      let curClusterIndex = curStim.stimuli.setspec.clusters.length;
      if(!isMultiTdf){
        let unitIndex = clozes[index].unitIndex;
        if(!!!(clusterListMappings[unitIndex].new)){
          clusterListMappings[unitIndex].new = [curClusterIndex];
        }
        clusterListMappings[unitIndex].new[1] = curClusterIndex;
      }

      let cluster = {stims:[]};
      let curSentenceClozes = sentenceIDtoClozesMap[sentenceID];
      completedSentenceIDs[sentenceID] = true;
      if(curSentenceClozes.length == 0){
        continue;
      }
      let completedClozeIDs = {};
      for(let cloze of curSentenceClozes){
        let clozeID = cloze.clozeId;
        if(!completedClozeIDs[clozeID]){
          let stim = getStimForCloze(clozeID,cloze);
          cluster.stims.push(stim);
          completedClozeIDs[clozeID] = true;
        }
      }
      curStim.stimuli.setspec.clusters.push(cluster);
    }
  }

  //Add back assessment session/non learning session clusters
  if(!isMultiTdf){
    for(var index in clusterListMappings){
      let unitMapping = clusterListMappings[index];
      let curClusterIndex = curStim.stimuli.setspec.clusters.length;
      if(!!!unitMapping.new){
        let curUnitStart = unitMapping.orig[0];
        let curUnitEnd = unitMapping.orig[1];
        let numInUnit = curUnitEnd - curUnitStart;
        let newUnitStart = curClusterIndex;
        let newUnitEnd = newUnitStart + numInUnit;
        unitMapping.new = [newUnitStart,newUnitEnd];
        for(var i=curUnitStart;i<=curUnitEnd;i++){
          let cluster = origStim.stimuli.setspec.clusters[i];
          curStim.stimuli.setspec.clusters.push(cluster);
        }
      }
    }
  }

  if(finalDidYouReadQuestion){
    curStim.stimuli.setspec.clusters.push(finalDidYouReadQuestion);
  }

  let sourceSentences = Session.get("clozeSentencePairs").sentences;
  if(sourceSentences && sourceSentences.length > 0){
    curStim.sourceSentences = sourceSentences;
  }

  curStim.fileName = stimFileName;
  curStim.owner = Meteor.userId();
  return curStim;
}

generateTDFJSON = function(tdfFileName,displayName,stimFileName,newStimJSON){
  console.log("clusterListMappings: " + JSON.stringify(clusterListMappings));
  let curTdf = undefined;

  if(clozesComeFromTemplate){
    let tdfTemplateFileName = $("#templateTDFSelect").val();
    let originalTDF = tdfFileNameToTdfFileMap[tdfTemplateFileName];
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

    let lastStim = newStimJSON.stimuli.setspec.clusters.length - 1;
    curTdf.tdfs.tutor.unit[1].assessmentsession.clusterlist = [lastStim + "-" + lastStim];
    
    console.log("curTdf.subTdfs: " + JSON.stringify(curTdf.subTdfs));
  }else{
    for(var unitIndex in clusterListMappings){
      var isLearningSession = clusterListMappings[unitIndex].sessionType === "learningsession";
      var unit = curTdf.tdfs.tutor.unit[unitIndex];
      let clusterlist = isLearningSession ? unit.learningsession[0].clusterlist : unit.assessmentsession[0].clusterlist;
      clusterlist[0] = clusterListMappings[unitIndex].new.join('-');
    }
    curTdf.createdAt = new Date();
    curTdf.owner = Meteor.userId();
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

function updateLookupMaps(clozeID,itemID,paraphraseId,oldCloze,newCloze){
  console.log("updateLookupMaps: ",oldCloze,newCloze);
  recordClozeEditHistory(oldCloze,newCloze);
  clozeIDToClozesMap[clozeID] = clozeIDToClozesMap[clozeID].filter((clozeItem) => clozeItem.clozeId == clozeID && clozeItem.paraphraseId != paraphraseId);
  sentenceIDtoClozesMap[itemID] = sentenceIDtoClozesMap[itemID].filter((clozeItem) => clozeItem.clozeId == clozeID && clozeItem.paraphraseId != paraphraseId);

  let prevClozeSentencePairs = Session.get("clozeSentencePairs");
  let newSentences = prevClozeSentencePairs.sentences;
  let newClozes = prevClozeSentencePairs.clozes;
  let curClozeIndex = prevClozeSentencePairs.clozes.findIndex(function(c) {return c.clozeId == clozeID && c.paraphraseId == paraphraseId});
  
  if(newCloze && Object.keys(newCloze).length > 0){
    clozeIDToClozesMap[clozeID].push(newCloze);
    sentenceIDtoClozesMap[itemID].push(newCloze);
    newClozes.splice(curClozeIndex,1,newCloze);
  }else{ //We've delete a cloze so we should make sure to check if a sentence no longer has a cloze
    newClozes.splice(curClozeIndex,1);
    newSentences = _.map(prevClozeSentencePairs.sentences, function(s) {
      if(s.itemId === itemID) {
        var matchingClozes = _.filter(newClozes, function(c) {
          return c.itemId === s.itemId;
        });
        if(matchingClozes.length == 0) s.hasCloze = false;
      }
      
      return s;
    });
  }

  Session.set('clozeSentencePairs', {
    'sentences':newSentences,
    'clozes':newClozes
  });
}

function deleteCloze(clozeID,itemID,paraphraseId){
  let oldCloze = JSON.parse(JSON.stringify(clozeIDToClozesMap[clozeID].find((elem) => elem.paraphraseId == paraphraseId)));
  updateLookupMaps(clozeID,itemID,paraphraseId,oldCloze,{});
}

sortClozes = function(sortingMethod){
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

Template.contentGeneration.onRendered(function(){
  $('html,body').scrollTop(0);
  Session.set("curClozeSentencePairItemId", "");
  Session.set("clozeSentencePairs", {});
  Session.set("clozeHistory", []);
  Session.set("selectedForDelete",[]);
  Session.set("editingSentence",{});
  Session.set("editingCloze",{});
  Session.set("tdfOwnersMap", {});
  sentenceIDtoSentenceMap = {};
  sentenceIDtoClozesMap = {};
  clozeIDToClozesMap = {};
  tdfFileNameToStimfileMap = {};
  tdfFileNameToTdfFileMap = {};
  speechAPIKey = undefined;
  textToSpeechAPIKey = undefined;
  originalClozes = undefined;
  origTdfFileName = undefined;
  clusterListMappings = {};
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
  $('#templateTDFSelect').one('select2:open', function(e) {
    $('input.select2-search__field').prop('placeholder', 'Search Here');
  });
  $('#templateTDFSelect').on('select2:open', function (e) {
    var container = $(this).select('select2-container');
    var position = container.offset().top;
    var availableHeight = $(window).height() - position - container.outerHeight();
    var bottomPadding = 50; // Set as needed
    $('ul.select2-results__options').css('max-height', (availableHeight - bottomPadding) + 'px');
  });
  $("#templateTDFSelect").select2();
});

Template.contentGeneration.events({
  'click #revertCoreference': function(event){
    let cloze_uid = parseInt(event.currentTarget.getAttribute('cloze-uid'));
    let curItemId = parseInt(event.currentTarget.getAttribute('uid'));
    let curParaphraseId = parseInt(event.currentTarget.getAttribute('paraphrase-id'));
    let clozeSentencePairs =Session.get("clozeSentencePairs");

    let oldCloze = clozeSentencePairs.clozes.find((cloze) => cloze.paraphraseId == curParaphraseId);
    let newCloze = JSON.parse(JSON.stringify(oldCloze));

    let originalText = JSON.parse(JSON.stringify(newCloze.tags.originalItem));
    delete newCloze.tags.originalItem;
    newCloze.cloze = originalText;

    updateLookupMaps(cloze_uid,curItemId,curParaphraseId,oldCloze,newCloze);
  },

  'click #redoCoreference': function(event){
    let cloze_uid = parseInt(event.currentTarget.getAttribute('cloze-uid'));
    let curItemId = parseInt(event.currentTarget.getAttribute('uid'));
    let curParaphraseId = parseInt(event.currentTarget.getAttribute('paraphrase-id'));
    let clozeSentencePairs = Session.get("clozeSentencePairs");

    let oldCloze = JSON.parse(JSON.stringify(clozeSentencePairs.clozes.find((cloze) => cloze.paraphraseId == curParaphraseId)));
    let newCloze = JSON.parse(JSON.stringify(oldCloze));

    let originalText = JSON.parse(JSON.stringify(newCloze.cloze));
    newCloze.tags.originalItem = originalText;
    newCloze.cloze = JSON.parse(JSON.stringify(newCloze.tags.clozeCorefTransformation));

    updateLookupMaps(cloze_uid,curItemId,curParaphraseId,oldCloze,newCloze);
  },

  'click #cloze': function(event){
    var cloze_uid = parseInt(event.currentTarget.getAttribute('uid'));
    Session.set("curClozeSentencePairItemId", cloze_uid);
    var parsedSentencesMatchingSentence = $("#parsed-sentences").find("[uid=" + cloze_uid + "]").get(0);
    if(!!parsedSentencesMatchingSentence){
      parsedSentencesMatchingSentence.scrollIntoView();
    }
  },

  'click .sortingBtn': function(event){
    let sortProperty = event.currentTarget.getAttribute('sortProperty');
    sortClozes(sortProperty);
  },

  'click .sentence-with-cloze': function(event){
    var sentence_uid = parseInt(event.currentTarget.getAttribute('uid'));
    Session.set("curClozeSentencePairItemId", sentence_uid);
    $("#extracted-clozes").find("[uid=" + sentence_uid + "]").get(0).scrollIntoView();
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
        origTdfFileName = "";
        let sentences = result.fields[0].sentences;
        let clozes = result.fields[0].clozes;
        for(let cloze of clozes){
          cloze.unitIndex = 0;
        }
        let origEnd = clozes.length - 1;
        clusterListMappings = {
          0:{
            sessionType:"learningsession",
            orig:[0,origEnd]
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
    let response = $("#clozeResponseEdit").val();
    let editingCloze = Session.get("editingCloze");

    let sentenceID = editingCloze.itemId;
    let clozeID = editingCloze.clozeId;
    let paraphraseId = editingCloze.paraphraseId;
    
    if(newClozeText.indexOf("_") == -1){
      alert("Please make sure to insert underscores to indicate a missing word.");
    }else if (response.length < 1) {
      alert("Please enter a correct response");
    }else{
      let oldCloze = clozeIDToClozesMap[clozeID].find((elem) => elem.paraphraseId == paraphraseId);
      let originalVersion = oldCloze.originalVersion === "Same" ? oldCloze.cloze : oldCloze.originalVersion;

      let newCloze = {...oldCloze,originalVersion:originalVersion,cloze:newClozeText,correctResponse:response,itemId:sentenceID,clozeId:clozeID,origStimIndex:oldCloze.origStimIndex};
      recordClozeEditHistory(oldCloze,newCloze);

      clozeIDToClozesMap[clozeID] = clozeIDToClozesMap[clozeID].filter((clozeItem) => clozeItem.paraphraseId != paraphraseId);
      clozeIDToClozesMap[clozeID].push(newCloze);

      let clozeSentencePairs = Session.get('clozeSentencePairs');
      clozeSentencePairs.clozes = clozeSentencePairs.clozes.filter((cloze) => cloze.clozeId != clozeID);
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
    let cloze_uid = parseInt(event.currentTarget.getAttribute('cloze-uid'));
    let curItemId = parseInt(event.currentTarget.getAttribute('uid'));
    let curParaphraseId = parseInt(event.currentTarget.getAttribute('paraphrase-id'));

    console.log("cloze_uid: " + cloze_uid + ", curItemId: " + curItemId + ", curParaphraseId: " + curParaphraseId);

    Session.set("curClozeSentencePairItemId", curItemId);
    Session.set("editingClozeUID",cloze_uid);

    let curCloze;

    for(let cloze of clozeIDToClozesMap[cloze_uid]){
      if(cloze.paraphraseId == curParaphraseId){
        curCloze = cloze;
        break;
      }
    }

    let curSentence = sentenceIDtoSentenceMap[curItemId];
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
      clozeUid: parseInt(event.target.getAttribute('cloze-uid')),
      curItemId: parseInt(event.target.getAttribute('uid')),
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
      let curClozeId = selectedCloze.clozeUid;
      let curItemId = selectedCloze.curItemId;
      let curParaphraseId = selectedCloze.paraphraseId;
      deleteCloze(curClozeId,curItemId,curParaphraseId);
    });

    Session.set("selectedForDelete",[]);

    $('input:checkbox').removeAttr('checked');
  },

  'click #delete-btn': function(event){
    let curClozeId = parseInt(event.currentTarget.getAttribute('cloze-uid'));
    let curItemId = parseInt(event.currentTarget.getAttribute('uid'));
    let curParaphraseId = parseInt(event.currentTarget.getAttribute('paraphrase-id'));
    deleteCloze(curClozeId,curItemId,curParaphraseId);
  },

  "change #templateTDFSelect": function(event){
    finalDidYouReadQuestion = undefined;
    clozesComeFromTemplate = true;
    clusterListMappings = {};
    origTdfFileName = $(event.currentTarget).val();
    console.log("origTdfFileName: " + origTdfFileName);
    var stimObject = tdfFileNameToStimfileMap[origTdfFileName];
    console.log("stimObject: " + JSON.stringify(stimObject));
    var tdfObject = tdfFileNameToTdfFileMap[origTdfFileName];
    var units = tdfObject.tdfs.tutor.unit;
    //NOTE: We are currently assuming that multiTdfs will have only three units: an instruction unit, an assessment session with exactly one question which is the last
    //item in the stim file, and a unit with all clusters specified in the generated subtdfs array
    if(tdfObject.isMultiTdf){
      //Do nothing, multiTdfs will be processed without clusterlistmappings, elsewhere
    }else{
      for(var index in units){
        var unit = units[index];
        if(!!unit.learningsession || !!unit.assessmentsession){
          var session = unit.learningsession || unit.assessmentsession;
          var sessionType = !!unit.learningsession ? "learningsession" : "assessmentsession";
          clusterListMappings[index] = {
            sessionType:sessionType,
            orig:session[0].clusterlist[0].split('-').map(x => parseInt(x))
          };
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
  sentences: function() {
    return Session.get("clozeSentencePairs").sentences;
  },

  clozes: function() {
    return Session.get("clozeSentencePairs").clozes;
  },

  clozesSelected: function() {
    return Session.get("selectedForDelete").length > 0;
  },

  isCurrentPair: function(itemId) {
    return itemId === Session.get("curClozeSentencePairItemId");
  },

  isCoreference: function(paraphraseId){
    let cloze = Session.get("clozeSentencePairs").clozes.find((cloze) => cloze.paraphraseId == paraphraseId);
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
    var curClozeItemId = Session.get("curClozeSentencePairItemId");
    var curClozeText;
    _.map(Session.get("clozeSentencePairs").clozes, function(c) {
      if (c.itemId === curClozeItemId) { curClozeText = c.cloze }
    });
    return curClozeText;
  },

  editingCloze: function(){
    return Session.get("editingCloze").cloze;
  },

  editingClozeResponse: function(){
    return Session.get("editingCloze").correctResponse;
  },

  editingSentence: function(){
    return Session.get("editingSentence").sentence;
  },

  tdfs: function(){
    return Session.get("contentGenerationAllTdfs");
  },

  tdfOwnersMap: ownerId => {
    return Session.get("tdfOwnersMap")[ownerId];
  }
});

let templateStimJSON = {
    "fileName" : "",
    "stimuli" : {
        "setspec" : {
            "clusters" : []
        }
    },
    "owner" : "",
    "source" : "content_generation"
}

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
  "owner" : "",
  "source" : "content_generation"
}