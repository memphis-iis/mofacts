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

Template.body.events({
  'click .homeLink' : function (event) {
      event.preventDefault();
      Router.go("/profile");
  },

  'click .allItemsLink' : function (event) {
      event.preventDefault();
      Router.go("/allItems");
  },

  'click .logoutLink' : function (event) {
      event.preventDefault();
      Meteor.logout( function (error) {
          if (typeof error !== "undefined") {
              //something happened during logout
              console.log("User:", Meteor.user(), "Error:", error);
          }
          else {
              Router.go("/signInOauth");
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
