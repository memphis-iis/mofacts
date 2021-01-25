import { curSemester } from '../../common/Definitions';
export { 
  blankPassword,
  extractDelimFields,
  rangeVal,
  shuffle,
  randomChoice,
  search,
  haveMeteorUser,
  getAllCoursesForInstructor, 
  getAllCourseAssignmentsForInstructor,
  getCurrentClusterAndStimIndices,
  setStudentPerformance,
  getStimClusterCount,
  getStimCluster,
  createStimClusterMapping,
  getAllCurrentStimAnswers,
  getTestType,
  getCurrentDeliveryParams,
  getTdfByFileName
};

//Given a user ID, return the "dummy" password that stands in for a blank
//password. This is because we REALLY do want to use blanks passwords for
//some users
function blankPassword(userName) {
    return (userName + "BlankPassword").toUpperCase();
}

//Extract space-delimited fields from src and push them to dest. Note that
//dest is changed, but is NOT cleared before commencing. Also note that
//false-ish values and whitespace-only strings are silently discarded
function extractDelimFields(src, dest) {
    if (!src) {
        return;
    }
    var fields = _.trim(src).split(/\s/);
    for(var i = 0; i < fields.length; ++i) {
        var fld = _.trim(fields[i]);
        if (fld && fld.length > 0) {
            dest.push(fld);
        }
    }
}

//Given a string of format "a-b", return an array containing all
//numbers from a to b inclusive.  On errors, return an empty array
function rangeVal(src) {
    src = _.trim(src);
    var idx = src.indexOf("-");
    if (idx < 1) {
        return [];
    }

    var first = _.intval(src.substring(0, idx));
    var last  = _.intval(src.substring(idx+1));
    if (last < first) {
        return [];
    }

    var range = [];
    for (var r = first; r <= last; ++r) {
        range.push(r);
    }

    return range;
}

//Given an array, shuffle IN PLACE and then return the array
function shuffle(array) {
    if (!array || !array.length) {
        return array;
    }

    var currentIndex = array.length;

    while (currentIndex > 0) {
        var randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex -= 1;

        var tmp = array[currentIndex];
        array[currentIndex] = array[randomIndex];
        array[randomIndex] = tmp;
    }

    return array;
}

//Given an array, select and return one item at random. If the array is
//empty, then undefined is returned
function randomChoice(array) {
    var choice;
    if (array && array.length) {
        choice = array[Math.floor(Math.random() * array.length)];
    }
    return choice;
}

/* Client-side helper functions for getting current information about testing
 * and/or the current trial. Much of this functionality began in card.js
 * but has been moved here for easier use. See also lib/sessionUtils.js for
 * a better list of Session variables we currently use.
 * */

function search(key, prop, searchObj){
  for(let item of searchObj){
    if(item[prop] == key){
      return item;
    }
  }  
}

function haveMeteorUser() {
  return (!!Meteor.userId() && !!Meteor.user() && !!Meteor.user().username);
};

async function getAllCoursesForInstructor(instructorId){
  const courses = await meteorCallAsync("getAllCoursesForInstructor",instructorId)
  return courses;
}

async function getAllCourseAssignmentsForInstructor(instructorId){
  const courseAssignments = await meteorCallAsync("getAllCourseAssignmentsForInstructor",instructorId)
  return courseAssignments;
}

function setStudentPerformance(studentID,studentUsername,tdfFileName){
  console.log("setStudentPerformance:",studentID,studentUsername);
  Meteor.subscribe('specificUserMetrics',studentID,function(){
    var count = 0;
    var numCorrect = 0;
    var totalTime = 0;

    if(tdfFileName){
      let learningSessionItems = Session.get("learningSessionItems")[tdfFileName];

      var tdfQueryName = tdfFileName.replace(/[.]/g,'_');

      console.log("usermetrics:",UserMetrics.find({_id:studentID}).fetch());

      UserMetrics.find({_id:studentID}).forEach(function(entry){
        var tdfEntries = _.filter(_.keys(entry), x => x.indexOf(tdfQueryName) != -1);
        for(var index in tdfEntries){
          var tdfUserMetricsName = tdfEntries[index];
          var tdf = entry[tdfUserMetricsName];
          for(var index in tdf){
            //Ignore assessment entries
            if(!!learningSessionItems && !!learningSessionItems[index]){
              var stim = tdf[index];
              count += stim.questionCount || 0;
              numCorrect += stim.correctAnswerCount || 0;
              var answerTimes = stim.answerTimes;
              for(var index in answerTimes){
                var time = answerTimes[index];
                totalTime += (time / (1000*60)); //Covert to minutes from milliseconds
              }
            }
          }
        }
      });
    }
    
    var percentCorrect = "N/A";
    if(count != 0){
      percentCorrect = ((numCorrect / count)*100).toFixed(2)  + "%";
      console.log('percentCorrect: ' + percentCorrect + ", numCorrect: " + numCorrect + ", count: " + count);
    }
    var studentObj = {
      "username":studentUsername,
      "count":count,
      "percentCorrect":percentCorrect,
      "numCorrect":numCorrect,
      "totalTime":totalTime,
      "totalTimeDisplay":totalTime.toFixed(1)
    }
    Session.set("curStudentPerformance",studentObj);
    console.log("setStudentPerformance,output:",studentObj);
  })
}

function getCurrentClusterAndStimIndices(){
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
function getStimClusterCount() {
    return Stimuli.findOne({fileName: Session.get("currentStimName")}).stimuli.setspec.clusters.length;
};

// Return the stim file cluster matching the index AFTER mapping it per the
// current sessions cluster mapping. Note that they are allowed to give us
// a cached stimuli document for optimization

//Note that the cluster mapping goes from current session index to raw index in order of the stim file
function getStimCluster(index, cachedStimuli) {
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
        cachedStimuli = Stimuli.findOne({fileName: Session.get("currentStimName")});
    }
    let cluster = cachedStimuli.stimuli.setspec.clusters[mappedIndex];

    //When we log, we want to be able to record the origin index as shufIndex
    //and the mapped index as clusterIndex
    cluster.shufIndex = index;
    cluster.clusterIndex = mappedIndex;

    return cluster;
};

//Given a cluster count, a shuffleclusters string, and a swapclusters string,
//create a mapping vector. The idea is that for cluster x, mapping[x] returns
//a translated index. Note that the default mapping is identity, so that
//mapping[x] = x HOWEVER, the user may submit a different default mapping.
//This is mainly so that multiple shuffle/swap pairs can be run. ALSO important
//is the fact that additional elements will be added if
//mapping.length < clusterCount
function createStimClusterMapping(clusterCount, shuffleclusters, swapclusters, startMapping) {
  if (clusterCount < 1)
      return [];

  var i;

  //Default mapping is identity - mapping[x] == x
  //We also need to make sure we have clusterCount elements
  var mapping = (startMapping || []).slice(); //they get a copy back
  while (mapping.length < clusterCount) {
      mapping.push(mapping.length);
  }

  //Shufle the given ranges of cards (like permutefinalresult)
  if (!!shuffleclusters) {
      var shuffleRanges = [];
      extractDelimFields(shuffleclusters, shuffleRanges);

      var shuffled = mapping.slice(); //work on a copy

      _.each(shuffleRanges, function(rng) {
          var targetIndexes = rangeVal(rng);
          var randPerm = targetIndexes.slice(); //clone
          shuffle(randPerm);

          for(j = 0; j < targetIndexes.length; ++j) {
              shuffled[targetIndexes[j]] = mapping[randPerm[j]];
          }
      });

      mapping = shuffled.slice();
  }

  //Swap out sections of clusters (one step up from our shuffle above)
  if (!!swapclusters) {
      //Get the chunks that we'll be swapping. Each chunk is in the format
      //of an array of integral indexes (after the map). We actually get
      //TWO lists of chunks - one in order and one that is the actual swap
      var ranges = [];
      extractDelimFields(swapclusters, ranges);
      var swapChunks = _.map(ranges, rangeVal);
      var sortChunks = _.map(ranges, rangeVal);

      //Now insure our sorted chunks are actually in order - we sort
      //numerically by the first index
      sortChunks.sort(function(lhs, rhs) {
          var lv = lhs[0], rv = rhs[0];
          if      (lv < rv) return -1;
          else if (lv > rv) return 1;
          else              return 0;
      });

      //Now get a permuted copy of our chunks
      shuffle(swapChunks);

      var swapped = [];
      i = 0;
      while (i < mapping.length) {
          if (sortChunks.length > 0 && i == sortChunks[0][0]) {
              //Swap chunk - grab the permuted chunk and add the mapped numbers
              var chunk = swapChunks.shift();
              for (var chunkIdx = 0; chunkIdx < chunk.length; ++chunkIdx) {
                  swapped.push(mapping[chunk[chunkIdx]]);
              }

              //advance to the next chunk
              i += sortChunks.shift().length;
          }
          else {
              //Not part of a swapped chunk - keep this number and just move
              //to the next number
              swapped.push(mapping[i]);
              i++;
          }
      }

      //All done
      mapping = swapped.slice();
  }

  return mapping;
};

function getAllCurrentStimAnswers(removeExcludedPhraseHints) {
  let {curClusterIndex,curStimIndex} = getCurrentClusterAndStimIndices();
  let clusters = Stimuli.findOne({fileName: Session.get("currentStimName")}).stimuli.setspec.clusters
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

function getTestType() {
    return _.trim(Session.get("testType")).toLowerCase();
};

async function getTdfByFileName(tdfFileName){
  const tdf = await meteorCallAsync("getTdfByFileName",tdfFileName);
  return tdf.content;
}

//Return the delivery parms for the current unit. Note that we provide default
//values AND eliminate the single-value array issue from our XML-2-JSON mapping
//
//Note that the default mode is to use the current unit (thus the name), but we
//allow callers to override the unit assumed to be current
//
//IMPORTANT: we also support selecting one of multiple delivery params via
//experimentXCond (which can be specified in the URL or system-assigned)
function getCurrentDeliveryParams(){
    //If they didn't specify the unit, assume that current unit
    let currUnit = Session.get("currentTdfUnit");

    let isLearningSession = Session.get("sessionType") == "learningsession";

    //Note that we will only extract values that have a specified default
    //value here.
    var deliveryParams = {
        'showhistory': false,
        'forceCorrection': false,
        'scoringEnabled':isLearningSession,
        'purestudy': 0,
        'initialview': 0,
        'drill': 0,
        'reviewstudy': 0,
        'correctprompt': 0,
        'skipstudy': false,
        'lockoutminutes': 0,
        'fontsize': 3,
        'numButtonListImageColumns': 2,
        'correctscore': 1,
        'incorrectscore': 0,
        'practiceseconds': 0,
        'autostopTimeoutThreshold': 0,
        'autostopTranscriptionAttemptLimit': 3,
        'timeuntilaudio' : 0,
        'timeuntilaudiofeedback' : 0,
        'prestimulusdisplaytime' : 0,
        'forcecorrectprompt':'',
        'forcecorrecttimeout':0,
        'studyFirst':false,
        'enhancedFeedback':false,
        'checkOtherAnswers':false,
        'feedbackType':'',
        'falseAnswerLimit':9999999
    };

    //We've defined defaults - also define translatations for values
    function xlateBool(v) {
        return  v ? _.trim(v).toLowerCase() === "true" : false;
    };

    var xlations = {
        'showhistory': xlateBool,
        'forceCorrection': xlateBool,
        'scoringEnabled': xlateBool,
        'purestudy': _.intval,
        'skipstudy': xlateBool,
        'reviewstudy': _.intval,
        'correctprompt': _.intval,
        'lockoutminutes': _.intval,
        'fontsize': _.intval,
        'numButtonListImageColumns': _.intval,
        'practiceseconds': _.intval,
        'timeuntilaudio': _.intval,
        'timeuntilaudiofeedback': _.intval,
        'prestimulusdisplaytime': _.intval, 
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
    if(!!currUnit){
        //We have a unit
        if (currUnit.deliveryparams && currUnit.deliveryparams.length) {
            sourceDelParams = currUnit.deliveryparams;
        }
    }else{
        //No unit - we look for the top-level deliveryparams
        let tdf = Session.get("currentTdfFile");
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
