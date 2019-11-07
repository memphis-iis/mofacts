/* client/lib/currentTestingHelpers.js
 *
 * Client-side helper functions for getting current information about testing
 * and/or the current trial. Much of this functionality began in card.js
 * but has been moved here for easier use. See also lib/sessionUtils.js for
 * a better list of Session variables we currently use.
 *
 * Note that we will optionally ignore cluster mapping if ignoreClusterMapping
 * is true. See unitEngine.js for how this is set on a per unit engine basis.
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

//Return the current cluster index into the stimulus file. Note that this
//returns the "raw" or "unmapped" cluster index. If you want the properly
//mapped index that includes initial shuffles and swaps from setspec, then
//you should call getStimCluster (which will have the pre and post mapped
//indexes added as a property)
getCurrentClusterIndex = function () {
    return Session.get("clusterIndex");
};

//Allow setting the current cluster index
setCurrentClusterIndex = function(newIdx) {
    Session.set("clusterIndex", newIdx);
};

//Return the total number of stim clusters
getStimClusterCount = function() {
    return Stimuli.findOne({fileName: getCurrentStimName()})
        .stimuli.setspec.clusters[0].cluster.length;
};

// Return the stim file cluster matching the index AFTER mapping it per the
// current sessions cluster mapping. Note that they are allowed to give us
// a cached stimuli document for optimization
getStimCluster = function (index, cachedStimuli) {
    var clusterMapping = Session.get("clusterMapping");
    var mappedIndex;

    if(Session.get("ignoreClusterMapping")) {
        //No mapping performed (a model unit)
        mappedIndex = index;
    }
    else if(clusterMapping) {
        //Generic, normal functioning - use the previously defined mapping
        mappedIndex = clusterMapping[index];
    }
    else {
        //This is tricky - we may actually be called before everything is set
        //up for rendering. As a result, we just return the first cluster
        console.log("No cluster mapping available for stimulus clusters");
        mappedIndex = 0;
    }

    if (!cachedStimuli) {
        cachedStimuli = Stimuli.findOne({fileName: getCurrentStimName()});
    }
    var cluster = cachedStimuli
        .stimuli
        .setspec
        .clusters[0]
        .cluster[mappedIndex];

    //When we log, we want to be able to record the origin index as shufIndex
    //and the mapped index as clusterIndex
    cluster.shufIndex = index;
    cluster.clusterIndex = mappedIndex;

    return cluster;
};

curStimIsSoundDisplayType = function(){
  var foundSoundDisplayType = false;
  Stimuli.find({fileName: getCurrentStimName(),"stimuli.setspec.clusters.cluster.displayType":"Sound"}).forEach(function(entry){
    foundSoundDisplayType = true;
  });

  return foundSoundDisplayType;
}

getCurStimImageSrcs = function(){
  var imageSrcs = [];
  var clusters = Stimuli.findOne({fileName: getCurrentStimName()}).stimuli.setspec.clusters;
  for(var index in clusters){
    var clusterCollection = clusters[index];
    for(var clusterIndex in clusterCollection){
      var cluster = clusterCollection[clusterIndex];
      for(var dtIndex in cluster){
        var displayType = cluster[dtIndex];
        if(!!displayType.displayType && displayType.displayType[0] === "Image"){
          imageSrcs.push(displayType.display[0]);
        }
      }
    }
  }
  return imageSrcs;
}

getAllStimQuestions = function(){
  var clusters = Stimuli.findOne({fileName: getCurrentStimName()}).stimuli.setspec.clusters[0].cluster
  var allQuestions = [];
  var exclusionList = ["18-25","Male","Less than High School"];

  for(clusterIndex in clusters){
    for(displayIndex in clusters[clusterIndex].display){
      var question = clusters[clusterIndex].display[displayIndex];
      if(exclusionList.indexOf(question) == -1){
        allQuestions.push(question);
      }
    }
  }

  return allQuestions;
}

getAllCurrentStimAnswers = function(removeExcludedPhraseHints) {
  var currentClusterIndex = getCurrentClusterIndex();

  var clusters = Stimuli.findOne({fileName: getCurrentStimName()}).stimuli.setspec.clusters[0].cluster
  var allAnswers = new Set;
  var exclusionList = ["18-25","Male","Less than High School"];

  for(clusterIndex in clusters){
    //Grab the response phrases we want to exclude if this is the current cluster
    if(clusterIndex == currentClusterIndex){
      if(!!clusters[clusterIndex].speechHintExclusionList){
          exclusionList = exclusionList.concat(("" + clusters[clusterIndex].speechHintExclusionList).split(','));
      }
    }
    for(responseIndex in clusters[clusterIndex].response){
      var responseParts = clusters[clusterIndex].response[responseIndex].toLowerCase().split(";");
      var answerArray = responseParts.filter(function(entry){ return entry.indexOf("incorrect") == -1});
      if(answerArray.length > 0){
        var singularAnswer = answerArray[0].split("~")[0];
        allAnswers.add(singularAnswer);
      }
    }
  }

  allAnswers = Array.from(allAnswers);

  if(removeExcludedPhraseHints){
    //Remove the optional phrase hint exclusions
    allAnswers = allAnswers.filter( function (el){
      return exclusionList.indexOf(el) < 0;
    });
  }

  return allAnswers;
}

//Return the current question type
getQuestionType = function () {
    var type = "text"; //Default type

    //If we get called too soon, we just use the first cluster
    var clusterIndex = getCurrentClusterIndex();
    if (!clusterIndex && clusterIndex !== 0)
        clusterIndex = 0;

    var cluster = getStimCluster(clusterIndex);
    if (cluster.displayType && cluster.displayType.length) {
        type = cluster.displayType[0];
    }

    return ("" + type).toLowerCase();
};

getResponseType = function () {
  var type = "text"; //Default type

  //If we get called too soon, we just use the first cluster
  var clusterIndex = getCurrentClusterIndex();
  if (!clusterIndex && clusterIndex !== 0)
      clusterIndex = 0;

  var cluster = getStimCluster(clusterIndex);
  if (cluster.responseType && cluster.responseType.length) {
      type = cluster.responseType[0];
  }

  return ("" + type).toLowerCase();
}

findQTypeSimpified = function () {
    var QType = getQuestionType();

    if      (QType === "text")  QType = "T";    //T for Text
    else if (QType === "image") QType = "I";    //I for Image
    else if (QType === "sound") QType = "A";    //A for Audio
    else if (QType === "cloze") QType = "C";    //C for Cloze
    else if (QType === "video") QType = "V";    //V for video
    else                        QType = "NA";   //NA for Not Applicable

    return QType;
};

getTestType = function () {
    return _.trim(Session.get("testType")).toLowerCase();
};

//get the question at this index - note that the cluster index will be mapped
//in getStimCluster
getStimQuestion = function (index, whichQuestion) {
    return getStimCluster(index).display[whichQuestion];
};

//get the answer at this index - note that the cluster index will be mapped
//in getStimCluster
getStimAnswer = function (index, whichAnswer) {
    return getStimCluster(index).response[whichAnswer];
};

//get the parameter at this index - this works using the same semantics as
//getStimAnswer and getStimQuestion above. Note that we default to return 0
getStimParameter = function (index, whichParameter) {
    return _.chain(getStimCluster(index))
        .prop("parameter")
        .prop(_.intval(whichParameter))
        .floatval()
        .value();
};

//Simplified Q/A getters
getCurrentStimQuestion = function(whichQuestion) {
    return getStimQuestion(getCurrentClusterIndex(), whichQuestion);
};
getCurrentStimAnswer = function(whichAnswer) {
    return getStimAnswer(getCurrentClusterIndex(), whichAnswer);
};
getCurrentStimParameter = function(whichParameter) {
    return getStimParameter(getCurrentClusterIndex(), whichParameter);
};

//Return the list of false responses corresponding to the current question/answer
getCurrentFalseResponses = function(whichAnswer) {
  var cluster = getStimCluster(getCurrentClusterIndex());

    if (!cluster || !cluster.falseResponse || cluster.falseResponse.length < 1) {
        return []; //No false responses
    }

    //If we have the same number of response and falseResponse, then the stim file
    //is using the "new" formatted false response per display/response pair.
    //Otherwise, we assume the "old" style and they get everything
    //Additionally, if the stim file uses false response feedback, map across the false response (array of dicts)
    //to get the false response values out.
  if (cluster.response.length === cluster.falseResponse.length) {
    return _.trim(cluster.falseResponse[whichAnswer]).split(';');
  }
  else if (!!cluster.falseResponse[0]['feedback']) {
    return _.map(cluster.falseResponse, function(response){ return response['value']; });
  }
  else {
    return cluster.falseResponse;
  }
};

getFeedbackForFalseResponse = function(whichAnswer) {
  var cluster = getStimCluster(getCurrentClusterIndex());
  if(!cluster.falseResponse){
    return null;
  }
  if(!cluster.falseResponse[0]['feedback']){
    return null;
  } else {
    var response = _.filter(cluster.falseResponse, function(res){ return res['value'] == whichAnswer; })[0];
    return response['feedback'];
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
        'unitMode': 'default',
        'studyFirst':false
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
        'timeuntilstimulus': _.intval
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
