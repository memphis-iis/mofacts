import { curSemester } from '../lib/viewHelpers';
import { Tracker } from 'meteor/tracker';

Session.set("curClozeSentencePairItemId", "");
Session.set("clozeSentencePairs", {});
Session.set("clozeHistory", []);
Session.set("selectedForDelete",[]);
Session.set("editingSentence",{});
Session.set("editingCloze",{});
Session.set("tdfOwnersMap", {});
sentenceIDtoSentenceMap = {};
sentenceIDtoClozesMap = {};
clozeIDToClozeMap = {};
tdfFileNameToStimfileMap = {};
tdfFileNameToTdfFileMap = {};
speechAPIKey = undefined;
textToSpeechAPIKey = undefined;
originalClozes = undefined;
origTdfFileName = undefined;
clusterListMappings = {};
clozeEdits = [];
deletedClozeIds = [];
origClusterIndexToClozeIDsMap = {};
clozesComeFromTemplate = undefined;

let stimParameter = "0,.7";

recordClozeEditHistory = function(oldCloze,newCloze){
  var timestamp = Date.now();
  console.log(new Date(timestamp).toString() + ":" + JSON.stringify(oldCloze) + "|" + JSON.stringify(newCloze));
  clozeEdits.push({startingCloze:oldCloze,endingCloze:newCloze,timestamp:timestamp});
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
          let formattedDate = "";
          if (entry.createdAt) {
            let date = new Date(entry.createdAt);
            formattedDate = (date.getMonth() + 1) + '/' + date.getDate() + '/' + date.getFullYear(); 
          }
 
          let ownerId = entry.owner;
          ownerIds.push(entry.owner);
          var stimulusObject = Stimuli.findOne({"fileName":stimulusFile})
          allTdfs.push({'fileName':fileName,'displayName':displayName, 'ownerId': ownerId, "displayDate": formattedDate || ""});
          tdfFileNameToTdfFileMap[fileName] = entry;
          tdfFileNameToStimfileMap[fileName] = stimulusObject;
        }
      }catch(err){
        console.log("error with setting all tdfs: " + JSON.stringify(err));
      }
    });
    ownerMapCallback(ownerIds);
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

setClozesFromStimObject = function(stimObject,isMultiTdf){
  console.log("setClozesFromStimObject");
  var allClozes = [];
  var allClusters = stimObject.stimuli.setspec.clusters;
  for(var index in allClusters){
    if(isMultiTdf){
      if(index < allClusters.length -1){
        var cluster = allClusters[index];
        var fakeSentenceId = _.random(-9999999999,9999999999);
        for(var stim of cluster.stims){
          var clozeDisplay = stim.display;
          var clozeResponse = stim.response;
          var clozeId = _.random(-9999999999,9999999999);
          allClozes.push({
            unitIndex:2,
            cloze:clozeDisplay,
            clozeResponse:clozeResponse,
            clozeId:clozeId,
            itemId:fakeSentenceId,
            origStimIndex: index
          })
          if(!origClusterIndexToClozeIDsMap[index]){
            origClusterIndexToClozeIDsMap[index] = [];
          }
          origClusterIndexToClozeIDsMap[index].push(clozeId);
        }
      }
    }else{
      var inLearningSession = false;
      var clusterUnitIndex = -1;
      for(var unitIndex in clusterListMappings){
        var mapping = clusterListMappings[unitIndex];
        var clusterListIndices = mapping.orig;
        if(index >= clusterListIndices[0] && index <= clusterListIndices[1]){
          inLearningSession = mapping.sessionType === "learningsession";
          clusterUnitIndex = unitIndex;
          break;
        }
      }
  
      if (inLearningSession) {
        var cluster = allClusters[index];
        var fakeSentenceId = _.random(-9999999999,9999999999);
        for(var stim of cluster.stims){
          var clozeDisplay = stim.display;
          var clozeResponse = stim.response;
          var clozeId = _.random(-9999999999,9999999999);
          allClozes.push({
            unitIndex:clusterUnitIndex,
            cloze:clozeDisplay,
            clozeResponse:clozeResponse,
            clozeId:clozeId,
            itemId:fakeSentenceId,
            origStimIndex: index
          })
        }
      }
    }
  }
  Session.set("clozeSentencePairs", {
    "sentences":[],
    "clozes":allClozes
  });
  originalClozes = JSON.parse(JSON.stringify(allClozes));
  fillOutItemLookupMaps([],allClozes);
}

fillOutItemLookupMaps = function(sentences,clozes){
  sentenceIDtoSentenceMap = {};
  clozeIDToClozeMap = {};
  sentenceIDtoClozesMap = {};

  for(var sentenceIndex in sentences){
    var sentence = sentences[sentenceIndex];
    var sentenceID = parseInt(sentence.itemId);
    sentenceIDtoSentenceMap[sentenceID] = sentence;
  }

  _.map(clozes,function(cloze){
      clozeIDToClozeMap[cloze.clozeId] = cloze;
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
  var curDateTime = new Date().toISOString().replace(/-/g,'_').replace(/:/g,'_').replace(/[.]/g,'_');
  var tdfFileName = displayName.replace(/ /g,"_") + "_" + curUserName + "_" + curDateTime + "_" + curSemester + "_TDF.xml";
  var stimFileName = displayName.replace(/ /g,"_") + "_" + curUserName + "_" + curDateTime + "_" + curSemester + "_Stim.xml";

  let isMultiTdf = false;
  if(clozesComeFromTemplate){
    var tdfTemplateFileName = $("#templateTDFSelect").val();
    var originalTDF = tdfFileNameToTdfFileMap[tdfTemplateFileName];
    isMultiTdf = originalTDF.isMultiTdf;
  }else{
    isMultiTdf = false;
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
      Session.set("contentGenerationAllTdfs",Session.get("contentGenerationAllTdfs").concat(newTDFJSON));
      alert("Saved Successfully!");
      $("#tdfDisplayNameTextBox").val("");
      $("#save-modal").modal('hide');
    }
  });
  console.log("newStimJSON: " + JSON.stringify(newStimJSON));
  console.log("newTDFJSON: " + JSON.stringify(newTDFJSON));
}

generateStimJSON = function(clozes,stimFileName,isMultiTdf){
  origStim = tdfFileNameToStimfileMap[origTdfFileName];

  if(!isMultiTdf){
    curStim = JSON.parse(JSON.stringify(templateStimJSON));
    let completedSentenceIDs = {};
    for(var index in clozes){
      let sentenceID = clozes[index].itemId;
      let unitIndex = clozes[index].unitIndex;
      if(!completedSentenceIDs[sentenceID]){
        let curClusterIndex = curStim.stimuli.setspec.clusters.length;
        if(!!!(clusterListMappings[unitIndex].new)){
          clusterListMappings[unitIndex].new = [curClusterIndex];
        }
        clusterListMappings[unitIndex].new[1] = curClusterIndex;

        let cluster = {stims:[]};
        let curSentenceClozes = sentenceIDtoClozesMap[sentenceID];
        for(let cloze of curSentenceClozes){
          let stim = {display:{"clozeText":""},response:{},parameter:""};
          stim.display = cloze.cloze;
          stim.response = cloze.clozeResponse;
          stim.parameter = stimParameter;
          cluster.stims.push(stim);
        }
        curStim.stimuli.setspec.clusters.push(cluster);
        completedSentenceIDs[sentenceID] = true;
      }
    }

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
  }else{ //If it's a multiTdf, we want to just copy the entire stim file to avoid remapping subTdf clusterlists TODO: fix this
    curStim = JSON.parse(JSON.stringify(origStim));
    delete curStim._id;
    curStim.source = "content_generation";
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
  curTdf.owner = Meteor.userId();
  curTdf.fileName = tdfFileName;
  curTdf.source = "content_generation";
  curTdf.tdfs.tutor.setspec[0].lessonname = [displayName];
  curTdf.tdfs.tutor.setspec[0].stimulusfile = [stimFileName];
  let isMultiTdf = curTdf.isMultiTdf;

  if(isMultiTdf){
    let lastStim = newStimJSON.stimuli.setspec.clusters.length - 1;
    curTdf.tdfs.tutor.unit[1].assessmentsession.clusterlist = [lastStim + "-" + lastStim];

    let subTdfsToRemove = [];

    let deletedOrigIndices = [];
    for(let origIndex in origClusterIndexToClozeIDsMap){
      let allDeleted = true;
      for(let clozeId of origClusterIndexToClozeIDsMap[origIndex]){
        if(deletedClozeIds.indexOf(clozeId) == -1){
          allDeleted = false;
          break;
        }
      }
      if(allDeleted){
        deletedOrigIndices.push(parseInt(origIndex));
      }
    }
    console.log("deletedOrigIndex: " + JSON.stringify(deletedOrigIndices));

    //Clean up to make sure we aren't presenting any subtdfs whose entire clusterlists have been removed
    for(let subTdfIndex in curTdf.subTdfs){
      console.log("subTdfIndex: " + subTdfIndex);
      let subTdf = curTdf.subTdfs[subTdfIndex];
      console.log("subTdf: " + JSON.stringify(subTdf));
      let subTdfClusterIndicesStrings = subTdf.clusterList.split(/[ ]+/);
      let newSubTdfClusterIndices = [];
      for(let subTdfClusterRangeString of subTdfClusterIndicesStrings){
        console.log("subTdfClusterRangeString: " + subTdfClusterRangeString);
        let clusterRange = Helpers.rangeVal(subTdfClusterRangeString);
        console.log("clusterRange: " + JSON.stringify(clusterRange));
        let clusterRangeAltered = false;
        let clusterRangeStartVal = clusterRange[0];
        for(let subTdfClusterRangeIndex of clusterRange){
          console.log("subTdfClusterRangeIndex: " + subTdfClusterRangeIndex);
          if(deletedOrigIndices.indexOf(subTdfClusterRangeIndex) > -1){
            console.log("deletedIndex: " + subTdfClusterRangeIndex + ", clusterRangeStartVal: " + clusterRangeStartVal);
            clusterRangeAltered = true;
            if(clusterRangeStartVal != subTdfClusterRangeIndex){
              newSubTdfClusterIndices.push("" + clusterRangeStartVal + "-" + (subTdfClusterRangeIndex - 1))
            }
            clusterRangeStartVal = subTdfClusterRangeIndex + 1;
          }else if(clusterRangeAltered && (subTdfClusterRangeIndex == clusterRange[clusterRange.length-1])){
            console.log("else if subTdfClusterRangeIndex");
            newSubTdfClusterIndices.push("" + clusterRangeStartVal + "-" + subTdfClusterRangeIndex);
          }
        }

        if(!clusterRangeAltered){
          newSubTdfClusterIndices.push(subTdfClusterRangeString);
        }
      }
      console.log("newSubTdfClusterIndex: " + JSON.stringify(newSubTdfClusterIndices));
      if(newSubTdfClusterIndices.length > 0){
        subTdf.clusterList = newSubTdfClusterIndices.join(' ');
      }else{
        subTdfsToRemove.push(parseInt(subTdfIndex));
      }      
      console.log("subTdf: " + JSON.stringify(subTdf));
      console.log("subTdfsToRemove: " + JSON.stringify(subTdfsToRemove));
    }

    for(let subTdfIndex=curTdf.subTdfs.length-1;subTdfIndex > -1; subTdfIndex--){
      if(subTdfsToRemove.indexOf(subTdfIndex) > -1){
        curTdf.subTdfs.splice(subTdfIndex,1);
      }
    }
    console.log("curTdf.subTdfs: " + JSON.stringify(curTdf.subTdfs));
  }else{
    for(var unitIndex in clusterListMappings){
      var isLearningSession = clusterListMappings[unitIndex].sessionType === "learningsession";
      var unit = curTdf.tdfs.tutor.unit[unitIndex];
      let clusterlist = isLearningSession ? unit.learningsession[0].clusterlist : unit.assessmentsession[0].clusterlist;
      clusterlist[0] = clusterListMappings[unitIndex].new.join('-');
    }
  }
  
  if(typeof(speechAPIKey) !== "undefined"){
    curTdf.tdfs.tutor.setspec[0].speechAPIKey = [speechAPIKey];
  }
  if(typeof(speechAPIKey) !== "undefined"){
    curTdf.tdfs.tutor.setspec[0].textToSpeechAPIKey = [textToSpeechAPIKey];
  }

  return curTdf;
}

function deleteCloze(clozeID,itemID){
  console.log("clozeID: " + clozeID + ", itemID: " + itemID);
  console.log("delete cloze: " + JSON.stringify(sentenceIDtoClozesMap[itemID]));
  sentenceIDtoClozesMap[itemID] = sentenceIDtoClozesMap[itemID].filter(function(clozeItem){
    console.log("clozeItem.clozeId != clozeID: " + (clozeItem.clozeId != clozeID));
    console.log("clozeItem.clozeId: " + clozeItem.clozeId + ", clozeID: " + clozeID);
    return clozeItem.clozeId != clozeID;
  })
  console.log("after: " + JSON.stringify(sentenceIDtoClozesMap[itemID]));

  var prevClozeSentencePairs = Session.get("clozeSentencePairs");

  var oldCloze = _.pick(clozeIDToClozeMap[clozeID],['cloze','clozeResponse','itemId','clozeId']);
  
  recordClozeEditHistory(oldCloze,{});
  deletedClozeIds.push(oldCloze.clozeId);

  var newClozes = _.filter(prevClozeSentencePairs.clozes, function(c) {return c.clozeId != clozeID});
  var newSentences = _.map(prevClozeSentencePairs.sentences, function(s) {
    if(s.itemId === itemID) {
      var matchingClozes = _.filter(newClozes, function(c) {
        return c.itemId === s.itemId;
      });
      if(matchingClozes.length == 0) s.hasCloze = false;
      return s;
    } else {
      return s;
    }
  });
  Session.set('clozeSentencePairs', {
    'sentences':newSentences,
    'clozes':newClozes
  });
}

Template.contentGeneration.onRendered(function(){
  console.log("contentGeneration rendered");
  setAllTdfs(getTdfOwnersMap);

  let template = this;
  template.autorun(() => {
    Session.get("clozeSentencePairs");
    Tracker.afterFlush(() => {
      $('.cloze-checkbox').shiftSelectable();
    });
  });
});

Template.contentGeneration.events({
  'click #cloze': function(event){
    var cloze_uid = parseInt(event.currentTarget.getAttribute('uid'));
    Session.set("curClozeSentencePairItemId", cloze_uid);
    var parsedSentencesMatchingSentence = $("#parsed-sentences").find("[uid=" + cloze_uid + "]").get(0);
    if(!!parsedSentencesMatchingSentence){
      parsedSentencesMatchingSentence.scrollIntoView();
    }
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
        deletedClozeIds = [];
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
    if(newClozeText.indexOf("_") == -1){
      alert("Please make sure to insert underscores to indicate a missing word.");
    }else if (response.length < 1) {
      alert("Please enter a correct response");
    }else{
      let unitIndex = clozeIDToClozeMap[clozeID].unitIndex;
      let oldCloze = _.pick(clozeIDToClozeMap[clozeID],['cloze','clozeResponse','itemId','clozeId','origStimIndex']);
      let newCloze = {cloze:newClozeText,clozeResponse:response,itemId:sentenceID,clozeId:clozeID,origStimIndex:oldCloze.origStimIndex};
      recordClozeEditHistory(oldCloze,newCloze);
      newCloze = Object.assign({unitIndex:unitIndex},newCloze);
      let clozeSentencePairs = Session.get('clozeSentencePairs');
      let clozes = clozeSentencePairs.clozes;
      let clozesWithNew = [];
      for(let clozeIndex in clozes){
        let cloze = clozes[clozeIndex];
        if(cloze.clozeId === clozeID){
          clozesWithNew.push(newCloze);
        }else{
          clozesWithNew.push(cloze);
        }
      }

      clozeSentencePairs.clozes = clozesWithNew;
      Session.set("clozeSentencePairs",clozeSentencePairs);
      clozeIDToClozeMap[clozeID] = newCloze;
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
    var cloze_uid = parseInt(event.currentTarget.getAttribute('cloze-uid'));
    var curItemId = parseInt(event.currentTarget.getAttribute('uid'));
    Session.set("curClozeSentencePairItemId", curItemId);
    Session.set("editingClozeUID",cloze_uid);

    var curCloze = clozeIDToClozeMap[cloze_uid];
    var curSentence = sentenceIDtoSentenceMap[curItemId];
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
      curItemId: parseInt(event.target.getAttribute('uid'))
    }
    
    if (event.target.checked) {
      selectedForDelete.push(selectedCloze);
    } else {
      selectedForDelete = _.filter(selectedForDelete, function(c) {
        return c.clozeUid != selectedCloze.clozeUid;
      });
    }

    Session.set("selectedForDelete", selectedForDelete);
  },

  'click #delete-selected': function(event) {
    var selectedForDelete = Session.get("selectedForDelete");

    selectedForDelete.forEach(function(selectedCloze) {
      var curClozeId = selectedCloze.clozeUid;
      var curItemId = selectedCloze.curItemId;
      deleteCloze(curClozeId,curItemId);
    });

    Session.set("selectedForDelete",[]);

    $('input:checkbox').removeAttr('checked');
  },

  'click #delete-btn': function(event){
    var curClozeId = parseInt(event.currentTarget.getAttribute('cloze-uid'));
    var curItemId = parseInt(event.currentTarget.getAttribute('uid'));
    deleteCloze(curClozeId,curItemId);
  },

  "change #templateTDFSelect": function(event){
    clozesComeFromTemplate = true;
    clusterListMappings = {};
    deletedClozeIds = [];
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

  currentCloze: function() {
    var curClozeItemId = Session.get("curClozeSentencePairItemId");
    var curClozeText;
    _.map(Session.get("clozeSentencePairs").clozes, function(c) {
      if (c.itemId === curClozeItemId) { curClozeText = c.cloze }
    });
    return curClozeText;
  },

  editingCloze: function(){
    return Session.get("editingCloze").cloze.clozeText;
  },

  editingClozeResponse: function(){
    return Session.get("editingCloze").clozeResponse.correctResponse;
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