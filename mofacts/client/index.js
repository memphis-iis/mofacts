import Promise from "bluebird";
import {Meteor} from "meteor/meteor";
import { dialogueContinue } from './views/experiment/dialogueUtils.js';
import { haveMeteorUser } from "./lib/currentTestingHelpers";
export { redoCardImage };

meteorCallAsync = Promise.promisify(Meteor.call);
ENTER_KEY = 13;
enterKeyLock = false;

//This will be setup for window resize, but is made global so that the
//card template page can hook it up as well
function redoCardImage() {
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

function restartMainCardTimeoutIfNecessary(){
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
  function wrappedTimeout(){
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

  //Global handler for continue buttons
  $(window).keypress(function(e) {
    let key = e.keyCode || e.which;
    if (key == ENTER_KEY && e.target.tagName != "INPUT") {
      window.keypressEvent = e;
      let curPage = document.location.pathname;
      console.log("global enter key, curPage: " + curPage);
      console.log(e);

      if(!enterKeyLock){
        enterKeyLock = true;
        console.log("grabbed enterKeyLock on global enter handler");
        switch(curPage){
          case "/instructions":
            e.preventDefault();
            instructContinue();
            break;
          case "/card":
            //TODO: add in code for enter key progressing skipstudy/continueStudy button
            dialogueContinue();
            break;
        }   
      }
    }
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
      sdfasd
      //Clear out studentUsername in case we are a teacher/admin who previously
      //navigated to this page for a particular student and want to see our own progress
      Session.set("studentUsername",null);
      Session.set("curStudentID",undefined);
      Session.set("curStudentPerformance",undefined);
      Session.set("curClass",undefined);
      Session.set("instructorSelectedTdf",undefined);
      Session.set("curClassPerformance",undefined);
      Router.go("/studentReporting");
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

Template.registerHelper('showPerformanceDetails', function(){
  return (Session.get("curModule") == "card" || Session.get("curModule") == "instructions") && Session.get("scoringEnabled");
  // var curLocation = Router.current().location.get().path;
  // if(curLocation == "/card" || curLocation == "/instructions"){
  //   return true;
  // }else{
  //   return false;
  // }
});

Template.registerHelper('currentScore', function() {
    return Session.get("currentScore");
});

Template.registerHelper('isNormal', function() {
    return Session.get("loginMode") !== "experiment";
});

Template.registerHelper('curStudentPerformance', function() {
  return Session.get("curStudentPerformance");
});
