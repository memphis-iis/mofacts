/* client/lib/currentTestingHelpers.js
 *
 * Client-side helper functions for getting current information about testing
 * and/or the current trial. Much of this functionality began in card.js
 * but has been moved here for easier use. See also lib/sessionUtils.js for
 * a better list of Session variables we currently use.
 * */

//Return the current fontsize from the TDF
getCurrentFontSize = function () {
    return _.intval(getCurrentDeliveryParams().fontsize);
};

//Return [correctscore, incorrectscore] for our current unit.
getCurrentScoreValues = function () {
    var parms = getCurrentDeliveryParams();
    return [
        _.intval(parms.correctscore),
        _.intval(parms.incorrectscore)
    ];
};

//Returns the current cluster index with shuffles and swaps applied, NOT the original index in the stim file
getCurrentClusterIndex = function () {
    return Session.get("clusterIndex");
};

//Returns the original current cluster index, i.e. the index in the original stim file without shuffles or swaps
getOriginalCurrentClusterIndex = function () {
  var clusterMapping = Session.get("clusterMapping");
  if(clusterMapping){
    return clusterMapping[getCurrentClusterIndex()];
  }else{
    throw "no cluster mapping found";
  }
}

//Allow setting the current cluster index
setCurrentClusterIndex = function(newIdx) {
    Session.set("clusterIndex", newIdx);
};

getCurrentClusterAndStimIndices = function(){
  let curClusterIndex = null;
  let curStimIndex = null;

  console.log("getCurrentClusterAndStimIndices: " + !engine);

  if(!engine){
    console.log("getCurrentClusterAndStimIndices, no engine: " + Session.get("clusterIndex"));
    curClusterIndex = Session.get("clusterIndex");
  }else{
    let currentQuest = engine.findCurrentCardInfo();
    curClusterIndex = currentQuest.clusterIndex;
    curStimIndex = currentQuest.whichStim;
    console.log("getCurrentClusterAndStimIndices, engine: " + JSON.stringify(currentQuest));
  }

  return {curClusterIndex,curStimIndex};
}

//Return the total number of stim clusters
getStimClusterCount = function() {
    return Stimuli.findOne({fileName: getCurrentStimName()}).stimuli.setspec.clusters.length;
};

// Return the stim file cluster matching the index AFTER mapping it per the
// current sessions cluster mapping. Note that they are allowed to give us
// a cached stimuli document for optimization

//Note that the cluster mapping goes from current session index to raw index in order of the stim file
getStimCluster = function (index, cachedStimuli) {
    var clusterMapping = Session.get("clusterMapping");
    var mappedIndex;

    if(clusterMapping) {
        //Generic, normal functioning - use the previously defined mapping
        mappedIndex = clusterMapping[index];
    }
    else {
        mappedIndex = index || 0;
    }

    if (!cachedStimuli) {
        cachedStimuli = Stimuli.findOne({fileName: getCurrentStimName()});
    }
    let cluster = cachedStimuli.stimuli.setspec.clusters[mappedIndex];

    //When we log, we want to be able to record the origin index as shufIndex
    //and the mapped index as clusterIndex
    cluster.shufIndex = index;
    cluster.clusterIndex = mappedIndex;

    return cluster;
};

curStimHasSoundDisplayType = function(){
  let foundSoundDisplayType = false;
  Stimuli.find({fileName: getCurrentStimName(),"stimuli.setspec.clusters.stims.display.audioSrc":{"$exists":true}}).forEach(function(entry){
    foundSoundDisplayType = true;
  });

  return foundSoundDisplayType;
}

curStimHasAudioDisplayType = function(){
  let foundAudioDisplayType = false;
  Stimuli.find({fileName: getCurrentStimName(),"stimuli.setspec.clusters.stims.display.imgSrc":{"$exists":true}}).forEach(function(entry){
    foundAudioDisplayType = true;
  });

  return foundAudioDisplayType;
}

getCurrentStimDisplaySources = function(filterPropertyName = "clozeText"){
  let displaySrcs = [];
  let clusters = Stimuli.findOne({fileName: getCurrentStimName()}).stimuli.setspec.clusters;
  for(let cluster of clusters){
    for(let stim of cluster.stims){
      if(typeof(stim.display[filterPropertyName]) != "undefined"){
        displaySrcs.push(stim.display[filterPropertyName]);
      }
    }
  }
  return displaySrcs;
}

getAllCurrentStimAnswers = function(removeExcludedPhraseHints) {
  let {curClusterIndex,curStimIndex} = getCurrentClusterAndStimIndices();
  let clusters = Stimuli.findOne({fileName: getCurrentStimName()}).stimuli.setspec.clusters
  let allAnswers = new Set;

  for(cluster of clusters){
    for(stim of cluster.stims){
      var responseParts = stim.response.correctResponse.toLowerCase().split(";");
      var answerArray = responseParts.filter(function(entry){ return entry.indexOf("incorrect") == -1});
      if(answerArray.length > 0){
        var singularAnswer = answerArray[0].split("~")[0];
        allAnswers.add(singularAnswer);
      }
    }
  }

  allAnswers = Array.from(allAnswers);

  if(removeExcludedPhraseHints){
    let curSpeechHintExclusionListText = clusters[curClusterIndex].stims[curStimIndex].speechHintExclusionList || "";
    let exclusionList = curSpeechHintExclusionListText.split(',');
    //Remove the optional phrase hint exclusions
    allAnswers = allAnswers.filter( function (el){
      return exclusionList.indexOf(el) < 0;
    });
  }

  return allAnswers;
}

getResponseType = function () {

  //If we get called too soon, we just use the first cluster
  let clusterIndex = getCurrentClusterIndex();
  if (!clusterIndex)
      clusterIndex = 0;

  let cluster = getStimCluster(clusterIndex);
  let type = cluster.responseType || "text"; //Default type

  return ("" + type).toLowerCase();
}

findQTypeSimpified = function () {
  let currentDisplay = Session.get("currentDisplay");
  let QTypes = "";

  if(currentDisplay.text)       QTypes = QTypes + "T";    //T for Text
  if(currentDisplay.imgSrc)     QTypes = QTypes + "I";   //I for Image
  if(currentDisplay.audioSrc)   QTypes = QTypes + "A";   //A for Audio
  if(currentDisplay.clozeText)  QTypes = QTypes + "C";   //C for Cloze
  if(currentDisplay.videoSrc)   QTypes = QTypes + "V";   //V for video

  if(QTypes == "") QTypes = "NA"; //NA for Not Applicable

  return QTypes;
};

getTestType = function () {
    return _.trim(Session.get("testType")).toLowerCase();
};

//get the answer at this index - note that the cluster index will be mapped
//in getStimCluster
getStimAnswer = function (index, whichAnswer) {
    return getStimCluster(index).stims[whichAnswer].response.correctResponse;
};

//get the parameter at this index - this works using the same semantics as
//getStimAnswer above. Note that we default to return 0
getStimParameter = function (index, whichParameter) {
    return _.chain(getStimCluster(index))
        .prop("stims")
        .prop(_.intval(whichParameter))
        .prop("parameter")
        .floatval()
        .value();
};

//Return the list of false responses corresponding to the current question/answer
getCurrentFalseResponses = function() {
  let {curClusterIndex,curStimIndex} = getCurrentClusterAndStimIndices();
  let cluster = getStimCluster(curClusterIndex);

  if (typeof(cluster) == "undefined" || typeof(cluster.stims[curStimIndex].response.incorrectResponses) == "undefined") {
      return []; //No false responses
  }else{
    return cluster.stims[curStimIndex].response.incorrectResponses;
  }
};

getCurrentStimName = function () {
    return Session.get("currentStimName");
};

getCurrentUnitNumber = function () {
    return Session.get("currentUnitNumber");
};

getCurrentTdfName = function () {
    return Session.get("currentTdfName");
};

getCurrentTdfFile = function () {
    return Tdfs.findOne({fileName: getCurrentTdfName()});
};

//Note that unit number used can be overridden - otherwise we just use the
//currentUnitNumber
getCurrentTdfUnit = function (unitIdx) {
    var thisTdf = getCurrentTdfFile();
    if (!thisTdf) {
        return null;
    }

    var currUnit = null;
    if (typeof thisTdf.tdfs.tutor.unit !== "undefined") {
        //If they didn't override the unit idx, then use the current
        if (!unitIdx && unitIdx !== 0)
            unitIdx = getCurrentUnitNumber();
        currUnit = thisTdf.tdfs.tutor.unit[unitIdx];
    }

    return currUnit || null;
};

//Get units left to display/execute - note that the current unit isn't
//counted. Ex: if you have three units (0, 1, 2) and unit 1 is the current
//unit, then you have 1 unit remaining. If there are no units or there is
//we return 0
getUnitsRemaining = function() {
    var unitsLeft = 0;

    var thisTdf = getCurrentTdfFile();
    if (!!thisTdf) {
        var unitCount = 0;
        if (typeof thisTdf.tdfs.tutor.unit !== "undefined" && thisTdf.tdfs.tutor.unit.length) {
            unitCount = thisTdf.tdfs.tutor.unit.length;
        }
        if (unitCount > 0) {
            var unitIdx = getCurrentUnitNumber() || 0;
            unitsLeft = (unitCount - unitIdx) - 1;
            if (unitsLeft < 0) {
                unitsLeft = 0;
            }
        }
    }

    return unitsLeft;
};

//Return the delivery parms for the current unit. Note that we provide default
//values AND eliminate the single-value array issue from our XML-2-JSON mapping
//
//Note that the default mode is to use the current unit (thus the name), but we
//allow callers to override the unit assumed to be current
//
//IMPORTANT: we also support selecting one of multiple delivery params via
//experimentXCond (which can be specified in the URL or system-assigned)
getCurrentDeliveryParams = function (currUnit) {
    //If they didn't specify the unit, assume that current unit
    if (!currUnit) {
        currUnit = getCurrentTdfUnit();
    }

    //Note that we will only extract values that have a specified default
    //value here.
    var deliveryParams = {
        'showhistory': false,
        'forceCorrection': false,
        'purestudy': 0,
        'initialview': 0,
        'drill': 0,
        'initialview': 0,
        'reviewstudy': 0,
        'correctprompt': 0,
        'skipstudy': false,
        'lockoutminutes': 0,
        'fontsize': 3,
        'correctscore': 1,
        'incorrectscore': 0,
        'practiceseconds': 0,
        'autostopTimeoutThreshold': 0,
        'timeuntilstimulus' : 0,
        'forcecorrectprompt':'',
        'forcecorrecttimeout':0,
        'studyFirst':false,
        'enhancedFeedback':false,
        'checkOtherAnswers':false,
        'feedbackType':'',
        'falseAnswerLimit':9999999
    };

    //We've defined defaults - also define translatations for values
    var xlateBool = function(v) {
        return  v ? _.trim(v).toLowerCase() === "true" : false;
    };

    var xlations = {
        'showhistory': xlateBool,
        'forceCorrection': xlateBool,
        'purestudy': _.intval,
        'skipstudy': xlateBool,
        'reviewstudy': _.intval,
        'correctprompt': _.intval,
        'lockoutminutes': _.intval,
        'fontsize': _.intval,
        'practiceseconds': _.intval,
        'timeuntilstimulus': _.intval,
        'studyFirst':xlateBool,
        'enhancedFeedback':xlateBool,
        'checkOtherAnswers':xlateBool,
        'falseAnswerLimit': _.intval
    };

    var modified = false;
    var fieldName; //Used in loops below

    //Use the current unit specified to get the deliveryparams array. If there
    //isn't a unit then we use the top-level deliveryparams (if there are)
    var sourceDelParams = null;
    if (!!currUnit) {
        //We have a unit
        if (currUnit.deliveryparams && currUnit.deliveryparams.length) {
            sourceDelParams = currUnit.deliveryparams;
        }
    }
    else {
        //No unit - we look for the top-level deliveryparams
        var tdf = getCurrentTdfFile();
        if (tdf && typeof tdf.tdfs.tutor.deliveryparams !== "undefined") {
            sourceDelParams = tdf.tdfs.tutor.deliveryparams;
        }
    }

    if (sourceDelParams && sourceDelParams.length) {
        //Note that if there is no XCond or if they specify something
        //wacky we'll just go with index 0
        var xcondIndex = _.intval(Session.get("experimentXCond"));
        if (xcondIndex < 0 || xcondIndex >= sourceDelParams.length) {
            xcondIndex = 0; //Incorrect index gets 0
        }
        var found = sourceDelParams[xcondIndex];

        //If found del params, then use any values we find
      if (found) {
        for(fieldName in deliveryParams) {
          var fieldVal = _.first(found[fieldName]);
          if (fieldVal) {
            deliveryParams[fieldName] = fieldVal;
            modified = true;
          }
        }
      }
    }

    //If we changed anything from the default, we should make sure
    //everything is properly xlated
    if (modified) {
        for(fieldName in deliveryParams) {
            var currVal = deliveryParams[fieldName];
            var xlation = xlations[fieldName];
            if (xlation) {
                deliveryParams[fieldName] = xlation(currVal);
            }
        }
    }

    return deliveryParams;
};
