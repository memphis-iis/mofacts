Session.set("studentReportingTdfs",[]);
Session.set("curStudentPerformance",{});

Template.studentReporting.helpers({
  studentReportingTdfs: () => Session.get("studentReportingTdfs"),
  curClassPerformance: () => Session.get("curClassPerformance"),
  curClass: () => Session.get("curClass"),
  curStudentPerformance: () => Session.get("curStudentPerformance"),
  studentUsername: () => Session.get("studentUsername")
});

Template.studentReporting.rendered = async function(){
  window.onpopstate = function(event){
    console.log("window popstate student reporting");
    if(document.location.pathname == "/studentReporting" && Session.get("loginMode") === "southwest"){
      Router.go("/profileSouthwest");
    }else{
      Router.go("/profile");
    }
  }
  console.log("studentReporting rendered!!!");

  Session.set("studentReportingTdfs",[]);
  Tracker.afterFlush(function(){
    console.log("afterFlush");

    let studentUsername = Session.get("studentUsername") || Meteor.user().username;
    let studentID = Session.get("curStudentID") || Meteor.userId();
    console.log("student,",studentUsername,studentID);

    const tdfsAttempted = await meteorCallAsync('getTdfIDsAndDisplaysAttemptedByUserId',studentID);
    Session.set("studentReportingTdfs",tdfsAttempted);
    console.log("studentReportingTdfs",tdfsAttempted);

    let dataAlreadyInCache = false;
    if (Roles.userIsInRole(Meteor.user(), ["admin","teacher"])){
      console.log("admin/teacher");
      dataAlreadyInCache = true;
    }else{
      Session.set("curStudentID",studentID);
      Session.set("studentUsername",studentUsername);
    }
    Tracker.afterFlush(function(){
      let tdfToSelect = Session.get("instructorSelectedTdf") || Session.get("studentReportingTdfs")[0].tdfid;
      $("#tdf-select").val(tdfToSelect);
      if($("#tdf-select").val() != null){
        let selectedTdfId = $("#tdf-select").val();
        if(!dataAlreadyInCache){
          setStudentPerformance(studentID,studentUsername,selectedTdfId);
        }
      }
    });
  });
};

Template.studentReporting.events({
  "change #tdf-select": function(event){
    let selectedTdfId = $(event.currentTarget).val();
    console.log("change tdf select",selectedTdfId);
    setStudentPerformance(Session.get("curStudentID"),Session.get("studentUsername"),selectedTdfId);
  }
});