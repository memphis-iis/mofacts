import { ALL_TDFS } from "./Definitions";

function getTdfQueryNames(tdfFileName) {
    let tdfQueryNames = {};
    if (tdfFileName === ALL_TDFS) {
        tdfQueryNames = getAllTdfFileNames();
    } else if (tdfFileName){
        tdfQueryNames = [tdfFileName];
    }
    return tdfQueryNames;
}
  
function getAllTdfFileNames() {
    return Tdfs.find({}).fetch().map(x => x.fileName);
}

function getLearningSessionItems(tdfFileName) {
    let learningSessionItems = [];
    let tdfQueryNames = getTdfQueryNames(tdfFileName);
    tdfQueryNames.forEach(tdfQueryName => {
        let tdf = Tdfs.findOne({fileName: tdfQueryName});
        if (!learningSessionItems[tdfQueryName]) {
        learningSessionItems[tdfQueryName] = {};
        }
        if (tdf.isMultiTdf) {
        setLearningSessionItemsMulti(learningSessionItems[tdfQueryName], tdf);
        } else {
        setLearningSessionItems(learningSessionItems[tdfQueryName], tdf);
        }
    });
    return learningSessionItems;
}

//for multiTdfs we assume all items but the last are learning session TODO: update when this assumptions changes
function setLearningSessionItemsMulti(learningSessionItem, tdf) {
    let stimFileName = tdf.tdfs.tutor.setspec[0].stimulusfile[0];
    let lastStim = Stimuli.findOne({fileName: stimFileName}).stimuli.setspec.clusters.length - 1;
    for (let i = 0; i < lastStim - 1; i++) {
        learningSessionItem[i] = true;
    }
}

function setLearningSessionItems(learningSessionItem, tdf) {
    let units = tdf.tdfs.tutor.unit;
    if (!_.isEmpty(units)) {
        units.forEach(unit => {
            if (!!unit.learningsession) {
                let clusterList = getClusterListsFromUnit(unit);
                clusterList.forEach(clusterRange => {
                    let [start, end] = clusterRange;
                    for (let i = start; i <= end; i++) {
                        learningSessionItem[i] = true;
                    }
                });
            }
        });
    }
}

function getClusterListsFromUnit(unit) {
    let clustersToParse = unit.learningsession[0].clusterlist[0];
    return clustersToParse.split(' ').map(x => x.split('-').map(y => parseInt(y)));
}

getStudentPerformanceForUsernameAndTdf = function(studentUsername,tdfFileName){
    Meteor.call("updatePerformanceData","utlQuery","Helpers.getStudentPerformanceForUsernameAndTdf",Meteor.userId());
    if(studentUsername.indexOf("@") == -1){
        studentUsername = studentUsername.toUpperCase();
      }
      let student = Meteor.users.findOne({"username":studentUsername}) || {};
      let studentID = student._id;
      let count = 0;
      let numCorrect = 0;
      let totalTime = 0;
      let learningSessionItems = getLearningSessionItems(tdfFileName);
      let tdfQueryName = tdfFileName.replace(/[.]/g,'_');
      let usingAllTdfs = tdfFileName === ALL_TDFS ? true : false;
      UserMetrics.find({_id: studentID}).forEach(function(entry){
        let tdfEntries;
        if(usingAllTdfs){
            tdfEntries = Object.keys(entry);
        }else{
            tdfEntries = _.filter(Object.keys(entry), x => x == tdfQueryName);
        }
        
        for(var index in tdfEntries){
          let key = tdfEntries[index];
          let tdf = entry[key];
          let tdfKey = key.replace('_xml', '.xml');
          for(var index in tdf){
            //Only count items in learning sessions
            if(!!learningSessionItems[tdfKey] && !!learningSessionItems[tdfKey][index]){
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

    return { count, numCorrect, totalTime };
}

Helpers = {
    //Given a user ID, return the "dummy" password that stands in for a blank
    //password. This is because we REALLY do want to use blanks passwords for
    //some users
    blankPassword: function(userName) {
        return (userName + "BlankPassword").toUpperCase();
    },

    //Extract space-delimited fields from src and push them to dest. Note that
    //dest is changed, but is NOT cleared before commencing. Also note that
    //false-ish values and whitespace-only strings are silently discarded
    extractDelimFields: function(src, dest) {
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
    },

    //Given a string of format "a-b", return an array containing all
    //numbers from a to b inclusive.  On errors, return an empty array
    rangeVal: function(src) {
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
    },

    //Given an array, shuffle IN PLACE and then return the array
    shuffle: function(array) {
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
    },

    //Given an array, select and return one item at random. If the array is
    //empty, then undefined is returned
    randomChoice: function(array) {
        var choice;
        if (array && array.length) {
            choice = array[Math.floor(Math.random() * array.length)];
        }
        return choice;
    }
};
