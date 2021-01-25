import { blankPassword } from '../../lib/currentTestingHelpers';

Template.signIn.onRendered(function(){
  if(Session.get("loginMode") !== "experiment"){
    console.log("password signin, setting login mode");
    Session.set('loginMode','password');
  }
})

////////////////////////////////////////////////////////////////////////////
// Template Events

Template.signIn.events({
    'click #signInButton' : function (event) {
        event.preventDefault();
        $("#signInButton").prop("disabled",true);
        UserPasswordCheck();
    },

    'click #signUpButton' : function (event) {
        event.preventDefault();
        Router.go("/signup");
    },

    'focus #signInUsername' : function (event) {
        $("#invalidLogin").hide();
    },

    'focus #password' : function () {
        $("#invalidLogin").hide();
    },

    'keypress .accept-enter-key' : function (event) {
        var key = event.keyCode || event.which;
        if (key == 13) {
            event.preventDefault();
            $("#signInButton").prop("disabled",true);
            UserPasswordCheck();
        }
    }
});

////////////////////////////////////////////////////////////////////////////
// Template Heleprs

Template.signIn.helpers({
    isExperiment: function() {
        return Session.get("loginMode") === "experiment";
    },

    experimentPasswordRequired: function(){
      return Session.get("experimentPasswordRequired");
    },

    isNormal: function() {
        return Session.get("loginMode") !== "experiment";
    }
});

////////////////////////////////////////////////////////////////////////////
// Implementation functions

//Called after we have signed in
function signinNotify() {
    if (Session.get("debugging")) {
        var currentUser = Meteor.users.findOne({_id: Meteor.userId()}).username;
        console.log(currentUser + " was logged in successfully! Current route is ", Router.current().route.getName());
        Meteor.call("debugLog", "Sign in was successful");
        Meteor.call("updatePerformanceData","login","signin.signinNotify",Meteor.userId());
        Meteor.call('logUserAgentAndLoginTime',Meteor.userId(),navigator.userAgent);
    }
    Router.go("/profile");
}

function UserPasswordCheck() {
    //Hide previous errors
    $(".errcheck").hide();

    var experiment = Session.get("loginMode") === "experiment";
    var experimentPasswordRequired = Session.get("experimentPasswordRequired");
    var newUsername = _.trim($("#signInUsername").val());
    var newPassword = _.trim(experiment && !experimentPasswordRequired ? "" : $("#password").val());

    if (!!newUsername & newPassword === "") {
        newPassword = blankPassword(newUsername);
    }

    if (experiment) {
        if(experimentPasswordRequired){
          sessionCleanUp();
          Session.set('experimentPasswordRequired',true);
          console.log("username:" + newUsername + ",password:" + newPassword);
          Meteor.loginWithPassword(newUsername, newPassword, function(error) {
              if (typeof error !== 'undefined') {
                  console.log("ERROR: The user was not logged in on experiment sign in?", newUsername, "Error:", error);
                  alert("It appears that you couldn't be logged in as " + newUsername);
                  $("#signInButton").prop("disabled",false);
              }
              else {
                  signinNotify();
              }
          });

          return;
        }else{
                //Experimental ID's are assumed to be upper case
          newUsername = newUsername.toUpperCase();

          //Experiment mode - we create a user if one isn't already there. We
          //Call sign up - specifying that a duplicate user is OK
          Meteor.call("signUpUser", newUsername, newPassword, true, function(error, result) {
              var errorMsgs = [];

              if (typeof error !== "undefined") {
                  errorMsgs.push(error);
              }

              if (!!result && result.length) {
                  _.each(result, function(msg) {
                      errorMsgs.push(msg);
                  });
              }

              //If there was a call failure or server returned error message,
              //then we can't proceed
              if (errorMsgs.length > 0) {
                  console.log("Experiment user login errors:", displayify(errorMsgs));
                  $("#serverErrors")
                      .html(errorMsgs.join("<br>"))
                      .show();
                  $("#signInButton").prop("disabled",false);
                  return;
              }

              //Everything was OK if we make it here - now we init the session,
              //login, and proceed to the profile screen

              sessionCleanUp();

              Meteor.loginWithPassword(newUsername, newPassword, function(error) {
                  if (typeof error !== 'undefined') {
                      console.log("ERROR: The user was not logged in on experiment sign in?", newUsername, "Error:", error);
                      alert("It appears that you couldn't be logged in as " + newUsername);
                      $("#signInButton").prop("disabled",false);
                  }
                  else {
                      signinNotify();
                  }
              });
          });

          //No more processing
          return;
        }
    }

    //If we're here, we're NOT in experimental mode
    Meteor.loginWithPassword(newUsername, newPassword, function(error) {
        if (typeof error !== 'undefined') {
            console.log("Login error: " + error);
            $("#invalidLogin").show();
            $("#serverErrors").html(error).show();
            $("#signInButton").prop("disabled",false);
        }
        else {
            if (newPassword === blankPassword(newUsername)) {
                //So now we know it's NOT experiment mode and they've logged in
                //with a blank password. Currently this is someone who's
                //managed to figure out to use the "normal" login flow. Tell
                //them the "correct" way to use the system.
                console.log("Detected non-experimental login for turk ID", newUsername);
                alert("This login page is not for Mechanical Turk workers. Please use the link provided with your HIT");
                $("#signInButton").prop("disabled",false);
                return;
            }
            signinNotify();
        }
    });
}
