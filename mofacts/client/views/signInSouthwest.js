Session.set("teachers",[]);
Session.set("curTeacher","");

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

      Meteor.call("addUserToTeachersClass",testUserName,Session.get("curTeacher"), function(err, result){
        if(!!err){
          console.log("error adding user to teacher class: " + err);
        }
        console.log("addUserToTeachersClass result: " + result);
      })

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
              Router.go("/profileSouthwest");
          }
      });
  });
}

setTeacher = function(teacher){
  console.log(teacher);
  Session.set("curTeacher",teacher);
  $("#initialInstructorSelection").prop('hidden','true');
  $("#loginDiv").prop('hidden','');
}

Meteor.subscribe('allTeachers',function () {
  var teachers = Meteor.users.find({}).fetch();
  var curUserIndex = teachers.findIndex(function(user){return user._id == Meteor.userId();})
  if(curUserIndex > -1){
    teachers.splice(curUserIndex,1);
  }
  console.log(JSON.stringify(teachers));
  Session.set("teachers",teachers);
});

Template.signInSouthwest.onRendered(function(){
  Session.set("loginMode","southwest");
});

Template.signInSouthwest.helpers({
    'teachers': function() {
        return Session.get('teachers');
    },
});

Template.signInSouthwest.events({
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
