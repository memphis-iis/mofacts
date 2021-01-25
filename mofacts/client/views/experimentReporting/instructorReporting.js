import { search, getAllCoursesForInstructor } from '../../lib/currentTestingHelpers';

Session.set("instructorReportingTdfs",[]);
Session.set("classes",[]);
Session.set("curClass",undefined);
Session.set("curClassStudentTotals",undefined);
Session.set("curInstructorReportingTdfs",[]);

const INVALID_TDF = "invalid";
curTdf = INVALID_TDF;
curClass = {_id:""};

navigateToStudentReporting = function(studentUsername){
  console.log("navigateToStudentReporting: " + studentUsername);
  Session.set("studentUsername",studentUsername);
  Session.set("curClass",curClass);
  Session.set("instructorSelectedTdf",curTdf);
  Session.set("curStudentPerformance",{});
  Router.go("/studentReporting");
}

setCurClassStudents = function(curClass,currentTdf){
  Session.set("curClassStudents",[]);
  Session.set("curClassStudentTotals",undefined);

  Session.set("performanceLoading", true);

  Meteor.call('getStudentPerformanceForClassAndTdf',curClass._id,currentTdf,function(err,res){
    Session.set("performanceLoading", false);
    if(!!err){
      console.log("error getting student performance for class and tdf: " + JSON.stringify(err));
    }else{
      console.log("getStudentPerformanceForClassAndTdf returned: " + JSON.stringify(res));
      Session.set("curClassStudents",res[0]);
      Session.set("curClassStudentTotals",res[1]);
    }
  })
}

// getStudentPerformanceForClassAndTdf: async function(classID, tdfFileName){
//   let curClass = Classes.findOne({_id:classID});
//   studentTotals = {
//     numCorrect: 0,
//     count: 0,
//     totalTime: 0,
//     percentCorrectsSum: 0,
//     numStudentsWithData: 0
//   }
//   let students = [];
//   if(!!curClass){
//     let curClassTdfs = [];
//     for(let tdf of curClass.tdfs){
//       curClassTdfs.push(tdf.fileName);
//     }
//     curClass.students.forEach(async function(studentUsername){
//       if(studentUsername.indexOf("@") == -1){
//         studentUsername = studentUsername.toUpperCase();
//       }
//       let student = Meteor.users.findOne({"username":studentUsername}) || {};
//       let studentID = student._id;
//       let count = 0;
//       let numCorrect = 0;
//       let totalTime = 0;
//       assessmentItems = {};
//       const learningSessionItems = await getLearningSessionItems(tdfFileName);
//       let tdfQueryName = tdfFileName.replace(/[.]/g,'_');
//       let usingAllTdfs = tdfFileName === ALL_TDFS ? true : false;
//       UserMetrics.find({_id: studentID}).forEach(function(entry){
//         let tdfEntries = _.filter(_.keys(entry), x => x.indexOf(tdfQueryName) != -1);
//         tdfEntries = tdfEntries.filter(x => curClassTdfs.indexOf(x.replace("_xml",".xml")) != -1);
//         for(var index in tdfEntries){
//           var key = tdfEntries[index];
//           var tdf = entry[key];
//           let tdfKey = usingAllTdfs ? key.replace('_xml', '.xml') : tdfFileName;
//           for(var index in tdf){
//             //Only count items in learning sessions
//             if(!!learningSessionItems[tdfKey] 
//                 && !!learningSessionItems[tdfKey][index]){
//               var stim = tdf[index];
//               count += stim.questionCount || 0;
//               numCorrect += stim.correctAnswerCount || 0;
//               var answerTimes = stim.answerTimes;
//               for(var index in answerTimes){
//                 var time = answerTimes[index];
//                 totalTime += (time / (1000*60)); //Covert to minutes from milliseconds
//               }
//             }
//           }
//         }
//       });
//       var percentCorrect = "N/A";
//       if(count != 0){
//         percentCorrect = ((numCorrect / count)*100);
//         studentTotals.percentCorrectsSum  += percentCorrect;
//         studentTotals.numStudentsWithData += 1;
//         percentCorrect = percentCorrect.toFixed(2) + "%";
//       }
//       totalTime = totalTime.toFixed(1);
//       var studentPerformance = {
//         "username":studentUsername,
//         "count":count,
//         "percentCorrect":percentCorrect,
//         "numCorrect":numCorrect,
//         "totalTime":totalTime
//       }
//       studentTotals.count += studentPerformance.count;
//       studentTotals.totalTime += parseFloat(studentPerformance.totalTime);
//       studentTotals.numCorrect += studentPerformance.numCorrect;
//       students.push(studentPerformance);
//     })
//   }
//   studentTotals.percentCorrect = (studentTotals.numCorrect / studentTotals.count * 100).toFixed(4) + "%";
//   studentTotals.totalTime = studentTotals.totalTime.toFixed(1);

//   studentTotals.averageCount = studentTotals.count / studentTotals.numStudentsWithData;
//   studentTotals.averageTotalTime = (studentTotals.totalTime / studentTotals.numStudentsWithData).toFixed(1);
//   studentTotals.averagePercentCorrect = (studentTotals.percentCorrectsSum / studentTotals.numStudentsWithData).toFixed(4) + "%";

//   return [students,studentTotals];
// },

Template.instructorReporting.helpers({
  tdfs: function(){
    return Session.get("curInstructorReportingTdfs");
  },

  classes: function(){
    return Session.get("classes");
  },

//Session var index by curClassName?
  curClassStudents: function(){
    return Session.get("curClassStudents");
  },

  replaceSpacesWithUnderscores: function(string){
    return string.replace(" ","_");
  },

  curClassStudentTotals: function(){
    return Session.get("curClassStudentTotals");
  },

  performanceLoading: function() {
    return Session.get("performanceLoading");
  }
});

Template.instructorReporting.events({

  "click .nav-tabs": function(event, template){
    Session.set("curClassStudents",[]);
    Session.set("curClassStudentTotals",undefined);

    //Need a timeout here to wait for the DOM to updated so we can read the active tab from it
    setTimeout(function(){
      //Need to strip newlines because chrome appends them for some reason
      let curClassName = $(".nav-tabs > .active")[0].innerText.replace('\n','');
      var classes = Session.get("classes");
      curClass = search(curClassName,"name",classes);
      let curClassTdfs = Session.get("instructorReportingTdfs")[curClass._id];
      Session.set("curInstructorReportingTdfs",curClassTdfs);
      console.log("click nav tabs after timeout, curClass: ", curClass);
      curTdf = INVALID_TDF;
      $("#tdf-select").val(INVALID_TDF);
    },200);
  },
  
  "change #tdf-select": function(event, template){
    curTdf = $(event.currentTarget).val();
    console.log("tdf change: " + curTdf);
    if(curClass){
      setCurClassStudents(curClass,curTdf);
    }else {
      alert('Please select a class');
    }
  }
});

Template.instructorReporting.onRendered(function(){
  curClass = {_id:""};
  Session.set("curClass",undefined);
  Session.set("studentUsername",undefined);
  Session.set("instructorSelectedTdf",undefined);
  Session.set("instructorReportingTdfs",[]);
  Session.set("classes",[]);
  Session.set("curClassStudents",[]);
  Session.set("curClassStudentTotals",undefined);
  Session.set("curInstructorReportingTdfs",[]);

  console.log("instructorReporting rendered");
  Meteor.call('getTdfNamesAssignedByInstructor',Meteor.userId(),function (err,res) {
    if(!!err){
      console.log("error getting tdf names assigned by instructor: " + JSON.stringify(err));
    }else{
      Session.set("instructorReportingTdfs",res);
    }
  });
  
  let classes = getAllCoursesForInstructor(Meteor.userId()); //getAllClassesForCurrentInstructor
  console.log("userID: " + Meteor.userId());
  console.log("classes: " + JSON.stringify(classes));
  Session.set("classes",classes);
})
