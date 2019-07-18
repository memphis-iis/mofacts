Session.set("tdfs",[]);
Session.set("classes",[]);

curTdf = "";
usernameToIDMap = {};
curClassName = "";

getCurClassStudents = function(curClassName){
  var classes = Session.get("classes");
  var curClass = search(curClassName,"name",classes);
  var students = [];
  if(!!curClass){
    curClass.students.forEach(function(studentUsername){
      students.push(getStudentPerformance(studentUsername));
    })
  }
  Session.set("curClassStudents",students);
}

getStudentPerformance = function(studentUsername){
  var studentID = translateUsernameToID(studentUsername);
  var tdfQueryName = curTdf.replace(".","_");
  var count = 0;
  var numCorrect = 0;
  UserMetrics.find({_id:studentID}).forEach(function(entry){
    var tdfEntry = entry[tdfQueryName];
    for(var key in tdfEntry){
      var item = tdfEntry[key];
      count += item.questionCount;
      numCorrect += item.correctAnswerCount;
    }
  });
  var percentCorrect = "N/A";
  if(count != 0){
    percentCorrect = (numCorrect / count).toFixed(4)*100  + "%";
  }
  var studentObj = {
    "username":studentUsername,
    "count":count,
    "percentCorrect":percentCorrect
  }
  return studentObj;
}

translateUsernameToID = function(username){
  if(username.indexOf("@") == -1){
    username = username.toUpperCase();
  }
  return usernameToIDMap[username];
}

function search(key, prop, array){
  for(var i=0;i<array.length;i++){
    if(array[i][prop] === key){
      return array[i];
    }
  }
}

function getAllTdfsforCurrentTeacher(){
  myTdfs = [];
  Tdfs.find({}).forEach(function(entry){
    myTdfs.push(entry);
  });
  return myTdfs;
}

function getAllClassesForCurrentTeacher(){
  var curClasses = [];
  if (Roles.userIsInRole(Meteor.user(), ["admin"])){
    Classes.find({}).forEach(function(entry){
      curClasses.push(entry);
    });
  }else{
    Classes.find({instructor:Meteor.userId()}).forEach(function(entry){
      curClasses.push(entry);
    });
  }
  return curClasses;
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
  Session.set("tdfs",getAllTdfsforCurrentTeacher());
});

Meteor.subscribe('classes',function(){
  var classes = getAllClassesForCurrentTeacher();
  Session.set("classes",classes);
  Meteor.call('usernameToIDMap',function(err,res){
    if(!!err){
      console.log("ERROR getting usernameToIDMap: " + err);
    }else{
      usernameToIDMap = res;
    }
  });
});

Template.teacherReporting.events({
  "change #tdf-select": function(event, template){
    var myNavTabs = $(".myNavTab");
    for(var i=0;i<myNavTabs.length;i++){
      myNavTabs[i].setAttribute('data-toggle','tab')
    }
    curTdf = $(event.currentTarget).val();
    console.log("change tdf-select, curTdf: " + curTdf);
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
        curClassName = $(".nav-tabs > .active")[0].innerText;
        getCurClassStudents(curClassName);
      },200);
    }
  }
});
