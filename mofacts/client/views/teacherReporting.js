Session.set("tdfs",[]);
Session.set("classes",[]);

curTdf = "";
curClassName = "";

navigateToStudentReporting = function(studentUsername){
  console.log("navigateToStudentReporting: " + studentUsername);
  Session.set("studentUsername",studentUsername);
  try{
      Router.go("/studentReporting");
  }catch(e){
    console.log("error: " + e);
  }
  console.log("shouldn't see this");
}

getCurClassStudents = function(curClassName){
  var classes = Session.get("classes");
  var curClass = search(curClassName,"name",classes);
  var students = [];
  if(!!curClass){
    curClass.students.forEach(function(studentUsername){
      var studentID = translateUsernameToID(studentUsername);
      students.push(getStudentPerformance(studentUsername,studentID,curTdf));
    })
  }
  Session.set("curClassStudents",students);
}

Template.teacherReporting.helpers({
  tdfs: function(){
    return Session.get("tdfs");
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
  }
});

Meteor.subscribe('tdfs',function () {
  Session.set("tdfs",getAllTdfs());
});

Meteor.subscribe('classes',function(){
  var classes = getAllClassesForCurrentTeacher();
  Session.set("classes",classes);
});

Template.teacherReporting.events({
  "change #tdf-select": function(event, template){
    var myNavTabs = $(".myNavTab");
    for(var i=0;i<myNavTabs.length;i++){
      myNavTabs[i].setAttribute('data-toggle','tab')
    }
    curTdf = $(event.currentTarget).val();
    if(!!curClassName){
      getCurClassStudents(curClassName);
    }
  },
  "click .nav-tabs": function(event, template){
    if(curTdf === ""){
      alert("Please select a tdf");
    }else{
      //Need a timeout here to wait for the DOM to updated so we can read the active tab from it
      setTimeout(function(){
        //Need to strip newlines because chrome appends them for some reason
        curClassName = $(".nav-tabs > .active")[0].innerText.replace('\n','');
        getCurClassStudents(curClassName);
      },200);
    }
  }
});
