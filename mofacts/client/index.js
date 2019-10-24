//This will be setup for window resize, but is made global so that the
//card template page can hook it up as well
redoCardImage = function() {
    //Note that just in case we can't get the height on the window we punt
    //with a default that is reasonable a lot of the time
    var wid = $(window).width() || 640;
    var hgt = $(window).height() || 480;

    if (wid > hgt) {
        //Landscape - assume that we want the image to fit entirely along
        //with the answer box on a fairly sane screen
        hgt = _.display(Math.floor(hgt * 0.45)) + "px";
        wid = "auto";
    }
    else {
        //Portrait - set the image to be the width of the screen. They'll
        //probably need to scroll for tall images
        hgt = "auto";
        wid = "90%";
    }

    $("#cardQuestionImg")
        .css("height", hgt)
        .css("width", wid);
};

Meteor.startup(function() {
    console.logs = [];
    console.defaultLog = console.log.bind(console);
    console.log = function() {
      for(var index in arguments){
        var arg = arguments[index];
        if(typeof(arg) != "object"){
          console.logs.unshift(arg);
        }
      }
      console.logs = console.logs.slice(0,1000);
      console.defaultLog.apply(console,arguments);
      //TODO: uncomment this when log rotation is set up
      // try{
      //   Meteor.call('serverLog',JSON.stringify({"datetime":Date().toString(),"page":document.location.pathname,"value":Array.from(arguments)}));
      // }catch{
      //   console.defaultLog("couldn't stringify and convert to array: ", arguments);
      // }
    }
    Session.set("debugging", true);
    sessionCleanUp();

    //Include any special jQuery handling we need
    $(window).resize(function(evt) {
        redoCardImage();
    });
});

restartMainCardTimeoutIfNecessary = function(){
  console.log("restartMainCardTimeoutIfNecessary");
  var mainCardTimeoutStart = Session.get("mainCardTimeoutStart");
  if(!mainCardTimeoutStart){
    var numRemainingLocks = Session.get("pausedLocks")-1;
    Session.set("pausedLocks",numRemainingLocks);
    return;
  }
  var errorReportStart = Session.get("errorReportStart");
  Session.set("errorReportStart",null);
  var usedDelayTime = errorReportStart - mainCardTimeoutStart;
  var remainingDelay = timeoutDelay - usedDelayTime;
  timeoutDelay = remainingDelay;
  var rightNow = new Date();
  Session.set("mainCardTimeoutStart",rightNow);
  wrappedTimeout = function(){
    var numRemainingLocks = Session.get("pausedLocks")-1;
    Session.set("pausedLocks",numRemainingLocks);
    if(numRemainingLocks <= 0){
      timeoutFunc();
    }else{
      console.log("timeout reached but there are " + numRemainingLocks + " locks outstanding");
    }
  }
  timeoutName = Meteor.setTimeout(wrappedTimeout,remainingDelay);
}

Template.body.onRendered(function(){
  $('#errorReportingModal').on('hidden.bs.modal', function () {
    console.log("error reporting modal hidden");
    restartMainCardTimeoutIfNecessary();
  });
})

Template.body.events({
  'click #homeButton' : function (event) {
      event.preventDefault();
      if(!!window.currentAudioObj){
        window.currentAudioObj.pause();
      }
      Router.go("/profile");
  },

  'click #progressButton' : function (event) {
      event.preventDefault();
      if(!!window.currentAudioObj){
        window.currentAudioObj.pause();
      }
      //Clear out studentUsername in case we are a teacher/admin who previously
      //navigated to this page for a particular student and want to see our own progress
      Session.set("studentUsername",null);
      Router.go("/studentReporting");

      //If we have no tdf selected from a prior navigation clear out the data
      if(!curTdf){
        Session.set("curStudentPerformance",{});
      //Otherwise populate the data with the new information (for the current user
      //and not the user from instructorReporting)
      }else{
        Session.set("curStudentID",Meteor.userId());
        setCurrentStudentPerformance();
      }
  },

  'click #errorReportButton' : function (event) {
    event.preventDefault();
    Session.set("pausedLocks",Session.get("pausedLocks")+1);
    Session.set("errorReportStart",new Date());
    $("#errorReportingModal").modal('show');
  },

  'click #errorReportingSaveButton' : function (event) {
    event.preventDefault();
    console.log("save error reporting button pressed");
    var errorDescription = $("#errorDescription").val();
    var curUser = Meteor.userId();
    var curPage = document.location.pathname;
    var sessionVars = Session.all();
    var userAgent = navigator.userAgent;
    var logs = console.logs;
    Meteor.call('sendUserErrorReport',curUser,errorDescription,curPage,sessionVars,userAgent,logs);
    $("#errorReportingModal").modal('hide');
    $("#errorDescription").val("");
  },

  'click #userAdminButton': function(event){
    event.preventDefault();
    if(!!window.currentAudioObj){
      window.currentAudioObj.pause();
    }

    Router.go('/userAdmin');
  },

  'click #classEditButton': function(event){
    event.preventDefault();
    if(!!window.currentAudioObj){
      window.currentAudioObj.pause();
    }

    Router.go('/classEdit');
  },

  'click #tdfAssignmentEditButton': function(event){
    event.preventDefault();
    if(!!window.currentAudioObj){
      window.currentAudioObj.pause();
    }

    Router.go('/tdfAssignmentEdit');
  },

  'click #instructorReportingButton': function(event){
    event.preventDefault();
    if(!!window.currentAudioObj){
      window.currentAudioObj.pause();
    }

    Router.go('/instructorReporting');
  },

  'click #contentGenerationButton': function(event){
    event.preventDefault();
    if(!!window.currentAudioObj){
      window.currentAudioObj.pause();
    }

    Router.go('/contentGeneration');
  },

  'click #logoutButton' : function (event) {
      event.preventDefault();
      if(!!window.currentAudioObj){
        window.currentAudioObj.pause();
      }
      Meteor.logout( function (error) {
          if (typeof error !== "undefined") {
              //something happened during logout
              console.log("User:", Meteor.user(), "Error:", error);
          }
          else {
              sessionCleanUp();
              routeToSignin();
          }
      });
  }
});

//Global template helpers
Template.registerHelper('isLoggedIn', function (){
  return haveMeteorUser();
});

Template.registerHelper('inPracticeModule', function(){
  var curLocation = Router.current().location.get().path;
  if(curLocation == "/card" || curLocation == "/instructions"){
    return true;
  }else{
    return false;
  }
});

Template.registerHelper('currentScore', function() {
    return Session.get("currentScore");
});

Template.registerHelper('isNormal', function() {
    return Session.get("loginMode") !== "experiment";
});
