import { blankPassword } from '../../lib/currentTestingHelpers';

Session.set("teachers",[]);
Session.set("curTeacher",{});
Session.set("curClass",{});
Session.set("systemOverloaded",false);
Session.set("systemDown",undefined);
Session.set("classesByInstructorId",{});

function getUrlVars(){
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

  var testPassword = blankPassword(testUserName);

  Meteor.call("signUpUser", testUserName, testPassword, true, function(error, result) {
      var errorMsgs = [];

      if (typeof error !== "undefined") {
          errorMsgs.push(error);
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

      let newUserId = result;

    Meteor.call("addUserToTeachersClass",newUserId,Session.get("curTeacher")._id,Session.get("curClass").sectionid, function(err, result){
      if(err){
        console.log("error adding user to teacher class: " + err);
        alert(err);
        return;
      }
      console.log("addUserToTeachersClass result: " + result);

      sessionCleanUp();

      // Note that we force Meteor to think we have a user name so that
      // it doesn't try it as an email - this let's you test email-like
      // users, which you can promote to admin or teacher
      Meteor.loginWithPassword({'username': testUserName}, testPassword, function(loginerror) {
          if (typeof loginerror !== 'undefined') {
              console.log("ERROR: The user was not logged in on TEST sign in?", testUserName, "Error:", loginerror);
              alert("It appears that you couldn't be logged in as " + testUserName);
              $("#signInButton").prop('disabled', false);
          }else {
              if (Session.get("debugging")) {
                  var currentUser = Meteor.users.findOne({_id: Meteor.userId()}).username;
                  console.log(currentUser + " was test logged in successfully! Current route is ", Router.current().route.getName());
              }
              Meteor.call('logUserAgentAndLoginTime',Meteor.userId(),navigator.userAgent);
              Meteor.call("updatePerformanceData","login","signinSouthwest.testLogin",Meteor.userId());
              Router.go("/profileSouthwest");
          }
      });
    });
  })
}

setTeacher = function(teacher){ //Shape: {_id:'{{this._id}}',username:'{{this.username}}'}
  console.log(teacher);
  Session.set("curTeacher",teacher);
  $("#initialInstructorSelection").prop('hidden','true');
  let curClasses = Session.get("classesByInstructorId")[teacher._id];
  console.log("setTeacher",Session.get("classesByInstructorId"),teacher._id,teacher);

  if(curClasses == undefined){
    $("#initialInstructorSelection").prop('hidden','');
    alert("Your instructor hasn't set up their classes yet.  Please contact them and check back in at a later time.");
    Session.set("curTeacher",{});
  }else{
    Session.set("curTeacherClasses",curClasses);
    $("#classSelection").prop('hidden','');
  }
}

setClass = function(curClassID){
  console.log(curClassID);
  $("#classSelection").prop('hidden','true');
  let allClasses = Session.get("curTeacherClasses");
  let curClass = allClasses.find((aClass) => aClass.sectionid == curClassID);
  Session.set("curClass",curClass);
  $(".login").prop('hidden','');
}

Template.signInSouthwest.onCreated(async function(){
  Session.set("loginMode","southwest");
  Meteor.call('isSystemDown',function(err, systemDown){
    console.log("SYSTEM_DOWN:",systemDown);
    Session.set("systemDown",systemDown);
  });
  Meteor.call("isCurrentServerLoadTooHigh",function(err,res){
    console.log("systemOverloaded?",res,err);
    Session.set("systemOverloaded",(typeof(err) != "undefined" || res));
  });
  Meteor.call("getAltServerUrl",function(err,res){
    if(!(err || !res)){
      console.log("altServerUrl: " + res);
      Session.set("altServerUrl",res);
    }else{
      console.log("can't get alt server url:",err,res);
    }
  });

  let southwestOnly=true;
  let verifiedTeachers = await meteorCallAsync("getAllTeachers",southwestOnly);
  console.log("verifiedTeachers",verifiedTeachers);

  //Hack to redirect rblaudow classes to ambanker
  var ambanker = verifiedTeachers.find(x => x.username === "ambanker@southwest.tn.edu");
  var rblaudow = verifiedTeachers.find(x => x.username === "rblaudow@southwest.tn.edu");
  if(ambanker && rblaudow) rblaudow._id = ambanker._id

  console.log("got teachers");
  var urlVars = getUrlVars();
  if(!urlVars['showTestLogins']){
    Session.set("showTestLogins",false);
    var testLogins = ['olney@southwest.tn.edu','pavlik@southwest.tn.edu','peperone@southwest.tn.edu','tackett@southwest.tn.edu'];
    verifiedTeachers = verifiedTeachers.filter(x => testLogins.indexOf(x.username) == -1);
    console.log("verifiedTeachers2",verifiedTeachers);
  }else{
    Session.set("showTestLogins",true);
  }
  Session.set("teachers",verifiedTeachers);
});

Template.signInSouthwest.onRendered(async function(){
  const allCourseSections = await meteorCallAsync("getAllCourseSections");
  let classesByInstructorId = {};
//  //sectionid, courseandsectionname
  for(let coursesection of allCourseSections){
    if(!classesByInstructorId[coursesection.teacheruserid]){
      classesByInstructorId[coursesection.teacheruserid] = [];
    }
    classesByInstructorId[coursesection.teacheruserid].push(coursesection);
  }
  Session.set("classesByInstructorId",classesByInstructorId);

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
});

Template.signInSouthwest.helpers({
    'altServerUrl': () => Session.get("altServerUrl"),

    'readingServerStatus': function(){
      return Session.get("systemDown")  == undefined;
    },

    'systemDown': function(){
      return Session.get("systemDown") && !Session.get("showTestLogins");
    },

    'systemOverloaded': () => Session.get("systemOverloaded"),

    'showTestLogins': () => Session.get("showTestLogins"),

    'teachers': () => Session.get('teachers'),

    'curTeacherClasses': () => Session.get("curTeacherClasses")
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
          Meteor.call("addUserToTeachersClass",Meteor.userId(),Session.get("curTeacher")._id,Session.get("curClass").sectionid, function(err, result){
            if(!!err){
              console.log("error adding user to teacher class: " + err);
            }
            console.log("addUserToTeachersClass result: " + result);
            Meteor.call('logUserAgentAndLoginTime',Meteor.userId(),navigator.userAgent);
            Meteor.call("updatePerformanceData","login","signinSouthwest.clickSamlLogin",Meteor.userId());
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
