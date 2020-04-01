Session.set("teachers",[]);
Session.set("curTeacher",{});
Session.set("curClass","");

function getUrlVars()
{
    var vars = [], hash;
    if(window.location.href.indexOf('?') > 0){
      var hashes = window.location.href.slice(window.location.href.indexOf('?') + 1).split('&');
      for(var i = 0; i < hashes.length; i++)
      {
          hash = hashes[i].split('=');
          vars.push(hash[0]);
          vars[hash[0]] = hash[1];
      }
    }
    return vars;
}

function testLogin(){
  console.log("SW Login");

  var testUserName = _.trim($("#username").val()).toUpperCase();
  if (!testUserName) {
      console.log("No user name specified");
      alert("No user name specified");
      $("#signInButton").prop('disabled', false);
      return;
  }

  var testPassword = Helpers.blankPassword(testUserName);


  Meteor.call("addUserToTeachersClass",testUserName,Session.get("curTeacher").username,Session.get("curClass"), function(err, result){
    if(!!err){
      console.log("error adding user to teacher class: " + err);
    }
    console.log("addUserToTeachersClass result: " + result);
    Meteor.call("signUpUser", testUserName, testPassword, true, function(error, result) {
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
            var errorText = displayify(errorMsgs);
            console.log("SW user login errors:", errorText);
            alert("User login errors:", errorText);
            $("#signInButton").prop('disabled', false);
            return;
        }

        sessionCleanUp();

        // Note that we force Meteor to think we have a user name so that
        // it doesn't try it as an email - this let's you test email-like
        // users, which you can promote to admin or teacher
        Meteor.loginWithPassword({'username': testUserName}, testPassword, function(error) {
            if (typeof error !== 'undefined') {
                console.log("ERROR: The user was not logged in on TEST sign in?", testUserName, "Error:", error);
                alert("It appears that you couldn't be logged in as " + testUserName);
                $("#signInButton").prop('disabled', false);
            }
            else {
                if (Session.get("debugging")) {
                    var currentUser = Meteor.users.findOne({_id: Meteor.userId()}).username;
                    console.log(currentUser + " was test logged in successfully! Current route is ", Router.current().route.getName());
                }
                Meteor.call('logUserAgentAndLoginTime',Meteor.userId(),navigator.userAgent);
                Router.go("/profileSouthwest");
            }
        });
    });
  })
}

import { curSemester } from '../lib/viewHelpers';
setTeacher = function(teacher){
  console.log(teacher);
  Session.set("curTeacher",teacher);
  $("#initialInstructorSelection").prop('hidden','true');

  Meteor.subscribe('classesForInstructor',teacher._id,function(){
    var curClasses = Classes.find({"instructor":Session.get("curTeacher")._id,"curSemester":curSemester}).fetch();

    console.log("classesForInstructor returned");

    if(curClasses.length == 0){
      $("#initialInstructorSelection").prop('hidden','');
      alert("Your instructor hasn't set up their classes yet.  Please contact them and check back in at a later time.");
      Session.set("curTeacher",{});
    }else{
      Session.set("curTeacherClasses",curClasses);
      $("#classSelection").prop('hidden','');
    }
  });
}

setClass = function(curClass){
  $("#classSelection").prop('hidden','true');
  Session.set("curClass",curClass);
  $(".login").prop('hidden','');
}

Template.signInSouthwest.onRendered(function(){
  Session.set("loginMode","southwest");
  window.onpopstate = function(event){
    console.log("window popstate signin southwest");
    if(document.location.pathname == "/signInSouthwest"){
      Session.set("curTeacher",{});
      Session.set("curClass",{});
      $("#initialInstructorSelection").prop('hidden','');
      $("#classSelection").prop('hidden','true');
      $(".login").prop('hidden','true');
    }
  }
  Meteor.subscribe('allTeachers',function () {
    var teachers = Meteor.users.find({}).fetch();
    var verifiedTeachers = teachers.filter(x => x.username.indexOf("southwest") != -1);

    //Hack to redirect rblaudow classes to ambanker
    var ambanker = verifiedTeachers.find(x => x.username === "ambanker@southwest.tn.edu");
    if(!!ambanker){
      var rblaudow = verifiedTeachers.find(x => x.username === "rblaudow@southwest.tn.edu");
      if(!!rblaudow){
        rblaudow._id = ambanker._id;
      }
    }
    console.log("got teachers");
    var urlVars = getUrlVars();
    if(!urlVars['showTestLogins']){
      Session.set("showTestLogins",false);
      var testLogins = ['olney@southwest.tn.edu','pavlik@southwest.tn.edu','peperone@southwest.tn.edu','tackett@southwest.tn.edu'];
      verifiedTeachers = verifiedTeachers.filter(x => testLogins.indexOf(x.username) == -1);
    }else{
      Session.set("showTestLogins",true);
    }
    Session.set("teachers",verifiedTeachers);
  });
});

Template.signInSouthwest.helpers({
    'showTestLogins': function(){
      return Session.get("showTestLogins");
    },

    'teachers': function() {
        return Session.get('teachers');
    },

    'curTeacherClasses': function(){
      return Session.get("curTeacherClasses");
    }
});

Template.signInSouthwest.events({
    'click .saml-login': function(event) {
      event.preventDefault();
      console.log("saml login");
      var provider = event.target.getAttribute('data-provider');
      console.log("provider: " + JSON.stringify(provider));
      Meteor.loginWithSaml({
        provider
      }, function(data,data2) {
        console.log("callback");
        //handle errors and result
        console.log("data: " + JSON.stringify(data));
        console.log("data2: " + JSON.stringify(data2));
        if(!!data && !!data.error){
          alert("Problem logging in: " + data.error);
        }else{
          Meteor.call("addUserToTeachersClass",testUserName,Session.get("curTeacher").username,Session.get("curClass"), function(err, result){
            if(!!err){
              console.log("error adding user to teacher class: " + err);
            }
            console.log("addUserToTeachersClass result: " + result);
            Meteor.call('logUserAgentAndLoginTime',Meteor.userId(),navigator.userAgent);
            Router.go("/profileSouthwest");
          });
        }
      });
    },

    'keypress .accept-enter-key' : function (event) {
        var key = event.keyCode || event.which;
        if (key == 13) {
            event.preventDefault();
            $("#signInButton").prop("disabled",true);
            testLogin();
        }
    },

    'click #signInButton': function(event) {
        $("#signInButton").prop('disabled', true);
        event.preventDefault();
        testLogin();
    }
});
