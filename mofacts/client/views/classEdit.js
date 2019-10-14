Session.set("classes",[]);

var isNewClass = true;
const lengthOfNewGeneratedIDs = 6;

function classSelectedSetup(curClassName){
    //$("#newClassName").prop('disabled',true);
    $("#newClassName").val(curClassName);
    $("#deleteClass").prop('disabled',false);
    isNewClass = false;

    var classes = Session.get("classes");
    var curClass = search(curClassName,"name",classes);
    $("#classStudents").val(curClass.students.map(x => x + '\n').join(''));
    $("#class-select").children('[value="' + curClass.name + '"]').attr('selected',true);
}

function noClassSelectedSetup(){
  //$("#newClassName").prop('disabled',false);
  $("#newClassName").val("");
  $("#deleteClass").prop('disabled',true);
  $("#classStudents").val("");
  isNewClass = true;
}

genID = function(length){
  return Math.random().toString(36).substring(2, (2+length));
}

////////////////////////////////////////////////////////////////////////////
// Template helpers
////////////////////////////////////////////////////////////////////////////

Template.classEdit.onRendered(function(){
  Meteor.subscribe("classes",function(){
    Session.set("classes",getAllClassesForCurrentInstructor());
  });
});

Template.classEdit.helpers({
  classes: function(){
    return Session.get("classes");
  }
});

////////////////////////////////////////////////////////////////////////////
// Template events
////////////////////////////////////////////////////////////////////////////

Template.classEdit.events({
  "change #class-select": function(event, template){
    console.log("change class-select");
    var curClassName = $(event.currentTarget).val();
    if(!!curClassName){
      classSelectedSetup(curClassName);
    }else{
      //Creating a new class with name from $textBox
      noClassSelectedSetup();
    }
  },

  "click #generateIDs": function(event, template){
    var numIDsToGen = parseInt($("#numIDs").val());
    if(isNaN(numIDsToGen)){
      alert("Please enter a numeric value");
    }else{
      var newIDs = [];
      var idMap = {};
      for(var id in Object.keys(usernameToIDMap)){
        idMap[id] = true;
      }
      for(var i=0;i<numIDsToGen;i++){
        var newID = genID(lengthOfNewGeneratedIDs);
        while(idMap[newID]){
          newID = genID(lengthOfNewGeneratedIDs);
        }
        newIDs.push(newID);
        idMap[newID] = true;
      }
      var students = $("#classStudents").val().trim().split('\n').filter(x => x !== "");
      students = students.concat(newIDs);
      $("#classStudents").val(students.map(x => x + '\n').join(''));
    }
  },

  "click #saveClass": function(event,template){
    var classes = Session.get("classes");

    if(isNewClass){
      curClass = {};
      curClassName = $("#newClassName").val();
      curClass.name = curClassName;
      curClass.instructor = Meteor.userId();
      classes.push(curClass);
    }else{
      curClassName = $("#class-select").val();
      curClass = search(curClassName,"name",classes);
      newClassName = $("#newClassName").val();
      curClass.name = newClassName;
    }

    var newStudents = $("#classStudents").val().trim().split('\n');
    curClass.students = newStudents;

    addEditClassCallback = function(err,res){
      if(!!err){
        alert("Error saving class: " + err);
      }else{
        alert("Saved class successfully!");
        curClass._id = res;
        console.log("curClass:" + JSON.stringify(curClass));
        Session.set("classes",classes);
        //Need a delay here so the reactive session var can update the template
        setTimeout(function(){
          classSelectedSetup(curClass.name);
        },200);
      }
    }

    if(isNewClass){
      Meteor.call('addClass',curClass,addEditClassCallback);
    }else{
      Meteor.call('editClass',curClass, addEditClassCallback);
    }
  },

  "click #deleteClass": function(event, template){
    var curClassName = $("#class-select").val();
    var classes = Session.get("classes");
    var curClass = search(curClassName,"name",classes);
    Meteor.call('deleteClass',curClass,function(err,res){
      if(!!err){
        alert("Error deleting class: " + err);
      }else{
        for(var i=0;i<classes.length;i++){
          if(classes[i].name === curClassName){
            classes.splice(i,1)
            break;
          }
        }
        Session.set("classes",classes);
        $("#class-select").val($("#class-select option:first").val());
        noClassSelectedSetup();
      }
    });
  }
})
