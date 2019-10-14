Session.set("classes",[]);
Session.set("allTdfs",[]);
Session.set("tdfsSelected",[]);
Session.set("tdfsNotSelected",[]);

curClass = {};

Meteor.subscribe("classes",function(){
  Session.set("classes",getAllClassesForCurrentInstructor());
});

Meteor.subscribe('tdfs',function () {
  var allTdfs = [];
  var allTdfObjects = getAllTdfs();
  for(var i in allTdfObjects){
    var tdf = allTdfObjects[i];
    allTdfs.push({fileName:tdf.fileName,displayName:tdf.displayName});
  }
  Session.set("allTdfs",allTdfs);
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
  Session.set("tdfsSelected",curClass.tdfs);
  Session.set("tdfsNotSelected",Session.get("allTdfs").filter(x => curClass.tdfs.findIndex(y => y.fileName == x.fileName) == -1));
}
