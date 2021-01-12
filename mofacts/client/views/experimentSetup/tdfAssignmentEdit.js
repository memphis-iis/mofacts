import { curSemester } from '../../../common/Definitions';

Session.set("classes",[]);
Session.set("allTdfFilenamesAndDisplayNames",[]);
Session.set("tdfsSelected",[]);
Session.set("tdfsNotSelected",[]);

curClass = {tdfs:[]};

Template.tdfAssignmentEdit.onRendered(function(){
  console.log("tdfAssignmentEdit rendered");
  Session.set("classes",getAllClassesForCurrentInstructor(Meteor.userId()));
  curClass = {
    tdfs: []
  };

  Meteor.subscribe('tdfs',function () {
    var allTdfs = [];
    var allTdfObjects = Tdfs.find({}).fetch();
    for(var i in allTdfObjects){
      var tdf = allTdfObjects[i];
      if(tdf.owner == Meteor.userId() && tdf.fileName.indexOf(curSemester) != -1){
        allTdfs.push({fileName:tdf.fileName,displayName:tdf.tdfs.tutor.setspec[0].lessonname[0]});
      }
    }
    Session.set("allTdfFilenamesAndDisplayNames",allTdfs);
  });

  Tracker.autorun(function(){
      updateTdfsSelectedAndNotSelected();
  });
});

////////////////////////////////////////////////////////////////////////////
// Template helpers
////////////////////////////////////////////////////////////////////////////

Template.tdfAssignmentEdit.helpers({
  classes: function(){
    return Session.get("classes");
  },

  tdfsSelected: function(){
    return Session.get("tdfsSelected");
  },

  tdfsNotSelected: function(){
    return Session.get("tdfsNotSelected");
  }
});

Template.tdfAssignmentEdit.events({
  "change #class-select": function(event, template){
    console.log("change class-select");
    var curClassName = $(event.currentTarget).val();
    var classes = Session.get("classes");
    curClass = search(curClassName,"name",classes);
    curClass.tdfs = curClass.tdfs || [];
    updateTdfsSelectedAndNotSelected();
  },

  "click #selectTdf": function(event, template){
    console.log("select tdf: ");
    var selectedTdfs = getselectedItems("notSelectedTdfs");
    curClass.tdfs = curClass.tdfs.concat(selectedTdfs);
    updateTdfsSelectedAndNotSelected();
  },

  "click #unselectTdf": function(event, template){
    console.log("unselect tdf: ");
    var unselectedTdfs = getselectedItems("selectedTdfs");
    curClass.tdfs = curClass.tdfs.filter(x => unselectedTdfs.findIndex(y => y.fileName == x.fileName) == -1);
    updateTdfsSelectedAndNotSelected();
  },

  "click #saveAssignment": function(event, template){
    console.log("save assignment");

    if(!curClass.name){
      alert("Please select a class to assign Chapters to.");
    }else{
      Meteor.call('editClass',curClass, function(err,res){
        if(!!err){
          alert("Error saving class: " + err);
        }else{
          alert("Saved class successfully!");
          console.log("curClass:" + JSON.stringify(curClass));
          var classes = Session.get("classes");
          for(var i=0;i<classes.length;i++){
            if(classes[i].name == curClass.name){
              classes[i] = curClass;
            }
          }
          Session.set("classes",classes);
        }
      });
    }
  }
});

function getselectedItems(itemSelector){
  var selectedItems = [];
  var selectedOptions = $("select#" + itemSelector + " option:selected");
  selectedOptions.each(function(index){
    var selectedValue = selectedOptions[index].value;
    var selectedDisplay = selectedOptions[index].text;
    var selectedItem = {fileName:selectedValue,displayName:selectedDisplay};
    console.log(selectedItem);
    selectedItems.push(selectedItem);
  });

  return selectedItems;
}

function updateTdfsSelectedAndNotSelected(){
  console.log("updateTdfsSelectedAndNotSelected");
  Session.set("tdfsSelected",curClass.tdfs);
  Session.set("tdfsNotSelected",Session.get("allTdfFilenamesAndDisplayNames").filter(x => curClass.tdfs.findIndex(y => y.fileName == x.fileName) == -1));
}
