
usernameToIDMap = {};
Meteor.call('usernameToIDMap',function(err,res){
  if(!!err){
    console.log("ERROR getting usernameToIDMap: " + err);
  }else{
    usernameToIDMap = res;
  }
});
translateUsernameToID = function(username){
  if(username.indexOf("@") == -1){
    username = username.toUpperCase();
  }
  return usernameToIDMap[username];
}

search = function(key, prop, array){
  for(var i=0;i<array.length;i++){
    if(array[i][prop] === key){
      return array[i];
    }
  }
}

getAllClassesForCurrentTeacher = function(){
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

getAllTdfs = function(){
  myTdfs = [];
  Tdfs.find({}).forEach(function(entry){
    myTdfs.push(entry);
  });
  return myTdfs;
}

getStudentPerformance = function(studentUsername,studentID,curTdf){
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
