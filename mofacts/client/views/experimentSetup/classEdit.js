import { curSemester } from '../../../common/Definitions';
import { search } from '../../lib/currentTestingHelpers';

Session.set("classes",[]);

var isNewClass = true;

curClass = {
  courseId: undefined,
  courseName: "",
  teacherUserId: Meteor.userId(),
  semester: curSemester,
  beginDate: new Date(),
  sections: []
};

function classSelectedSetup(curClassName){
    $("#class-select").children('[value="' + curClassName + '"]').attr('selected',true);
    $("#newClassName").val(curClassName);
    var foundClass = search(curClassName,"courseName",Session.get("classes"));
    $("#sectionNames").val(foundClass.sections.map(x => x + '\n').join(''));
    isNewClass = false;
}

function noClassSelectedSetup(){
  $("#newClassName").val("");
  $("#sectionNames").val("");
  isNewClass = true;
}

Template.classEdit.onRendered(async function(){
  const courseSections = await meteorCallAsync("getAllCourseSections");
  let classes = {};
  for(let courseSection of courseSections){
    if(courseSection.teacheruserid != Meteor.userId()) continue;
    if(!classes[courseSection.courseid]){
      classes[courseSection.courseid] = {
        courseId: courseSection.courseid,
        courseName: courseSection.coursename,
        teacherUserId: courseSection.teacheruserid,
        semester: courseSection.semester,
        beginDate: courseSection.begindate,
        sections: [courseSection.sectionname]
      };
    }else{
      classes[courseSection.courseid].sections.push(courseSection.sectionname);
    }
  }
  console.log("classesFromCourseSections:",classes,courseSections)

  Session.set("classes",Object.values(classes));
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
        courseId: undefined,
        courseName: curClassName,
        teacherUserId: Meteor.userId(),
        semester: curSemester,
        beginDate: new Date(),
        sections: []
      };
      classes.push(curClass);
    }else{
      curClassName = $("#class-select").val();
      curClass = search(curClassName,"courseName",classes);
      newClassName = $("#newClassName").val();
      curClass.courseName = newClassName;
    }

    var newSections = $("#sectionNames").val().trim().split('\n');
    curClass.sections = newSections;

    addEditClassCallback = function(err,res){
      if(!!err){
        alert("Error saving class: " + err);
      }else{
        alert("Saved class successfully!");
        curClass.courseId = res;
        console.log("curClass:" + JSON.stringify(curClass));
        Session.set("classes",classes);
        //Need a delay here so the reactive session var can update the template
        setTimeout(function(){
          classSelectedSetup(curClass.courseName);
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
