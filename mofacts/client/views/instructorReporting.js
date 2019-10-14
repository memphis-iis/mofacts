Session.set("instructorReportingTdfs",[]);
Session.set("classes",[]);
Session.set("curClassStudentTotals",null);

curTdf = "";
curClassName = "";

navigateToStudentReporting = function(studentUsername){
  console.log("navigateToStudentReporting: " + studentUsername);
  Session.set("studentUsername",studentUsername);
  Session.set("curStudentPerformance",{});
  Router.go("/studentReporting");
}

getCurClassStudents = function(curClassName,currentTdf){
  var classes = Session.get("classes");
  var curClass = search(curClassName,"name",classes);
  studentTotals = {
    numCorrect: 0,
    count: 0,
    totalTime: 0
  }
  var students = [];
  if(!!curClass){
    curClass.students.forEach(function(studentUsername){
      var studentID = translateUsernameToID(studentUsername);
      var studentPerformance = getStudentPerformance(studentUsername,studentID,currentTdf);
      studentTotals.count += studentPerformance.count;
      studentTotals.totalTime += parseFloat(studentPerformance.totalTime);
      studentTotals.numCorrect += studentPerformance.numCorrect;
      students.push(studentPerformance);
    })
  }
  studentTotals.percentCorrect = (studentTotals.numCorrect / studentTotals.count).toFixed(4) * 100 + "%";
  Session.set("curClassStudents",students);
  Session.set("curClassStudentTotals",studentTotals);
}

Template.instructorReporting.helpers({
  tdfs: function(){
    return Session.get("instructorReportingTdfs");
  },

  classes: function(){
    return Session.get("classes");
  },

//Session var index by curClassName?
  getCurClassStudents: function(curClassName){
    return Session.get("curClassStudents");
  },

  replaceSpacesWithUnderscores: function(string){
    return string.replace(" ","_");
  },

  curClassStudentTotals: function(){
    return Session.get("curClassStudentTotals");
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
      getCurClassStudents(curClassName,curTdf);
    }
  },
  "click .nav-tabs": function(event, template){
    if(curTdf === "invalid"){
      alert("Please select a tdf");
    }else{
      //Need a timeout here to wait for the DOM to updated so we can read the active tab from it
      setTimeout(function(){
        //Need to strip newlines because chrome appends them for some reason
        curClassName = $(".nav-tabs > .active")[0].innerText.replace('\n','');
        getCurClassStudents(curClassName,curTdf);
      },200);
    }
  }
});

Template.instructorReporting.onRendered(function(){
  Meteor.subscribe('tdfs',function () {
    Session.set("instructorReportingTdfs",getAllTdfs());
  });

  Meteor.subscribe('classes',function(){
    var classes = getAllClassesForCurrentInstructor(Meteor.userId());
    Session.set("classes",classes);
  });
})
