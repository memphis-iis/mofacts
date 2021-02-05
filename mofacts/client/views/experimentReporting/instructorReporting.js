import { ReactiveDict } from 'meteor/reactive-dict';

const _state = new ReactiveDict('instructorReportingState');

const INVALID_TDF = "invalid";
curTdf = INVALID_TDF;

async function navigateToStudentReporting(studentUsername){
  console.log("navigateToStudentReporting:",studentUsername);
  Session.set("studentUsername",studentUsername);
  Session.set("instructorSelectedTdf",curTdf);

  if(studentUsername.indexOf("@") == -1) studentUsername = studentUsername.toUpperCase();
  let userIdRet = await meteorCallAsync('getUserIdforUsername',studentUsername);
  console.log("student,",studentUsername,userIdRet);
  Session.set("curStudentID",userIdRet);
  Session.set("curStudentPerformance",Session.get("studentPerformanceForClassAndTdfIdMap")[userIdRet]);
  Router.go("/studentReporting");
}

function setCurClassStudents(curClass,currentTdf){
  Session.set("curClassStudentPerformance",Session.get("studentPerformanceForClassAndTdfIdMap")[curClass.courseid][currentTdf]);//PER STUDENT
  Session.set("curClassPerformance",Session.get("studentPerformanceForClass")[curClass.courseid]);//AGGREGATED BY CLASS
}

const generateUserMetThresholdMap = threshold => {
  const practiceTimeIntervalsMap = _state.get("practiceTimeIntervalsMap")
  let userMetThresholdMap = {};
  practiceTimeIntervalsMap.forEach(m => {
    if (m.duration < threshold) {
      userMetThresholdMap[m.userId] = `NO - ${m.duration}`;
    } else {
      userMetThresholdMap[m.userId] = `YES - ${m.duration}`;
    }
  });

  _state.set("userMetThresholdMap", userMetThresholdMap);
}

const getPracticeTimeIntervalsMap = async (date, tdfId) => {
  try {
    Meteor.call('getPracticeTimeIntervalsMap', date, tdfId, (err, res) => {
      if (err)
        throw 'Error fetching practice time intervals ->' + err;
      
      _state.set("practiceTimeIntervalsMap", res);
    });
  } catch (err) {
    console.log(err);
  }
}

Template.instructorReporting.helpers({
  curClassStudentPerformance: () => Session.get("curClassStudentPerformance"),
  curInstructorReportingTdfs: () => Session.get("curInstructorReportingTdfs"),
  classes: () => Session.get("classes"),
  curClassPerformance: () => Session.get("curClassPerformance"),
  performanceLoading: () => Session.get("performanceLoading"),
  replaceSpacesWithUnderscores: (string) => string.replace(" ","_"),
  getUserMetThresholdStatus: userId => {
    return _state.get("userMetThresholdMap")[userId];
  }
});

Template.instructorReporting.events({
  "click .nav-tabs": function(){
    Session.set("curClassStudentPerformance",[]);
    Session.set("curClassPerformance",undefined);

    //Need a timeout here to wait for the DOM to updated so we can read the active tab from it
    Tracker.afterFlush(function(){
      //Need to strip newlines because chrome appends them for some reason
      let curClassId = $(".nav-tabs > .active")[0].innerText.replace('\n','');
      let curClass = Session.get("classes").find(x => x.courseid == curClassId);
      Session.set("curClass",curClass);
      let curClassTdfs = Session.get("instructorReportingTdfs")[curClassId];
      console.log("click nav tabs after timeout, curClass: ", curClass, curClassTdfs);
      Session.set("curInstructorReportingTdfs",curClassTdfs);

      curTdf = INVALID_TDF;
      $("#tdf-select").val(INVALID_TDF);
    });
  },
  
  "change #tdf-select": function(event){
    curTdf = $(event.currentTarget).val();
    _state.set("currentSelectedTdf", curTdf);
    console.log("tdf change: " + curTdf);
    if(Session.get("curClass")){
      setCurClassStudents(curClass,curTdf);
    }else {
      alert('Please select a class');
    }
  },

  "change #practice-deadline-date": async event => {
    const date = event.currentTarget.value;
    getPracticeTimeIntervalsMap(date, _state.get("currentTdf"));
  },

  "change #practice-time-select": event => {
    const threshold = event.currentTarget.value;
    generateUserMetThresholdMap(threshold);
  }
});

Template.instructorReporting.onRendered(async function(){
  console.log("instructorReporting rendered",Meteor.userId());
  Session.set("curClass",undefined);
  Session.set("curStudentID",undefined);
  Session.set("studentUsername",undefined);
  Session.set("curStudentPerformance",undefined);
  Session.set("instructorSelectedTdf",undefined);
  Session.set("instructorReportingTdfs",[]);
  Session.set("classes",[]);
  Session.set("curClassStudentPerformance",[]);
  Session.set("curClassPerformance",undefined);
  Session.set("curInstructorReportingTdfs",[]);

  Session.set("performanceLoading", true);

  const studentPerformance = await meteorCallAsync('getStudentPerformanceForClassAndTdfId',Meteor.userId());
  [studentPerformanceForClass,studentPerformanceForClassAndTdfIdMap] = studentPerformance;
  Session.set("studentPerformanceForClass",studentPerformanceForClass);
  Session.set("studentPerformanceForClassAndTdfIdMap",studentPerformanceForClassAndTdfIdMap);

  const instructorReportingTdfs = await meteorCallAsync('getTdfAssignmentsByCourseIdMap',Meteor.userId());
  Session.set("instructorReportingTdfs",instructorReportingTdfs);
  
  const courses = await meteorCallAsync("getAllCoursesForInstructor",Meteor.userId());
  console.log("classes: " + JSON.stringify(courses));
  Session.set("classes",courses);

  Session.set("performanceLoading", false);
})
