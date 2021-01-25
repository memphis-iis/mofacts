import { curSemester } from '../../../common/Definitions';
import { search, getAllCoursesForInstructor } from '../../lib/currentTestingHelpers';

Session.set("classes",[]);

var isNewClass = true;

curClass = {
  courseid: undefined,
  coursename: "",
  teacheruserid: Meteor.userId(),
  semester: curSemester,
  beginDate: new Date(),
  sections: []
};

function classSelectedSetup(curClassName){
    $("#class-select").children('[value="' + curClassName + '"]').attr('selected',true);
    $("#newClassName").val(curClassName);
    var foundClass = search(curClassName,"coursename",Session.get("classes"));
    $("#sectionNames").val(foundClass.sections.map(x => x + '\n').join(''));
    isNewClass = false;
}

function noClassSelectedSetup(){
  $("#newClassName").val("");
  $("#sectionNames").val("");
  isNewClass = true;
}

Template.classEdit.onRendered(async function(){
  const courses = await getAllCoursesForInstructor(Meteor.userId());
  console.log("classEdit.onRendered,classes:",courses);
  Session.set("classes",courses);
});

Template.classEdit.helpers({
  classes: () => Session.get("classes")
});

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

  "click #saveClass": function(event,template){
    var classes = Session.get("classes");
    if(isNewClass){
      curClassName = $("#newClassName").val();
      curClass = {
        courseid: undefined,
        coursename: curClassName,
        teacheruserid: Meteor.userId(),
        semester: curSemester,
        beginDate: new Date(),
        sections: []
      };
      classes.push(curClass);
    }else{
      curClassName = $("#class-select").val();
      curClass = search(curClassName,"coursename",classes);
      newClassName = $("#newClassName").val();
      curClass.coursename = newClassName;
    }

    var newSections = $("#sectionNames").val().trim().split('\n');
    curClass.sections = newSections;

    addEditClassCallback = function(err,res){
      if(!!err){
        alert("Error saving class: " + err);
      }else{
        alert("Saved class successfully!");
        curClass.courseid = res;
        console.log("curClass:" + JSON.stringify(curClass));
        Session.set("classes",classes);
        //Need a delay here so the reactive session var can update the template
        setTimeout(function(){
          classSelectedSetup(curClass.coursename);
        },200);
      }
    }

    if(isNewClass){
      curClass.beginDate = new Date();
      Meteor.call('addCourse',curClass,addEditClassCallback);
    }else{
      Meteor.call('editCourse',curClass,addEditClassCallback);
    }
  }
})
