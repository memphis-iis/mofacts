Session.set("instructorReportingTdfs",[]);
Session.set("classes",[]);
Session.set("curClassStudentTotals",null);

curTdf = "invalid";
curClassName = "";

navigateToStudentReporting = function(studentUsername){
  console.log("navigateToStudentReporting: " + studentUsername);
  Session.set("studentUsername",studentUsername);
  Session.set("curStudentPerformance",{});
  Router.go("/studentReporting");
}

setCurClassStudents = function(curClassName,currentTdf){
  var classes = Session.get("classes");
  var curClass = search(curClassName,"name",classes);
  var classID = curClass._id;

  Session.set("performanceLoading", true);

  Meteor.call('getStudentPerformanceForClassAndTdf',classID,currentTdf,function(err,res){
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
    return Session.get("instructorReportingTdfs");
  },

  classes: function(){
    return Session.get("classes");
  },

//Session var index by curClassName?
  getCurClassStudents: function(){
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
  "change #tdf-select": function(event, template){
    var myNavTabs = $(".myNavTab");
    for(var i=0;i<myNavTabs.length;i++){
      myNavTabs[i].setAttribute('data-toggle','tab')
    }
    curTdf = $(event.currentTarget).val();
    if(!!curClassName){
      setCurClassStudents(curClassName,curTdf);
    } else {
      alert('Please select a class');
    }
  },
  "click .nav-tabs": function(event, template){
    //Need a timeout here to wait for the DOM to updated so we can read the active tab from it
    setTimeout(function(){
      //Need to strip newlines because chrome appends them for some reason
      curClassName = $(".nav-tabs > .active")[0].innerText.replace('\n','');
      console.log("click nav tabs after timeout, curClassName: " + curClassName);
      setCurClassStudents(curClassName,curTdf);
      $("#")
    },200);
  }
});

Template.instructorReporting.onRendered(function(){
  console.log("instructorReporting rendered");
  Meteor.call('getTdfNamesAssignedByInstructor',Meteor.userId(),function (err,res) {
    if(!!err){
      console.log("error getting tdf names assigned by instructor: " + JSON.stringify(err));
    }else{
      Session.set("instructorReportingTdfs",res);
    }
  });

  var classes = getAllClassesForCurrentInstructor(Meteor.userId());
  console.log("userID: " + Meteor.userId());
  console.log("classes: " + JSON.stringify(classes));
  Session.set("classes",classes);
})
