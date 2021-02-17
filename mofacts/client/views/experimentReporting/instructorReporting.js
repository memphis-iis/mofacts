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
    if($(".nav-tabs > .active")[0]){
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
    }
  },
  
  "change #tdf-select": function(event, template){
    if(curClass._id){
      curTdf = $(event.currentTarget).val();
      console.log("tdf change: " + curTdf);
      setCurClassStudents(curClass,curTdf);
    }else {
      $("#tdf-select").val(INVALID_TDF);
      alert('Please select a class first');
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

  let classes = getAllClassesForCurrentInstructor(Meteor.userId());
  console.log("userID: " + Meteor.userId());
  console.log("classes: " + JSON.stringify(classes));
  Session.set("classes",classes);
})
