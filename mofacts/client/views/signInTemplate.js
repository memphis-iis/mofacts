////////////////////////////////////////////////////////////////////////////
// Template Events

Template.signInTemplate.events({
    'click #signInButton' : function (event) {
        event.preventDefault();
        if (typeof console !== 'undefined' && Session.get("debugging")) {
            console.log("You are trying to sign in!");
        }
        UserPasswordCheck();
    },

    'click #signUpButton' : function (event) {
        event.preventDefault();
        Router.go("signup");
    },

    'focus #signInUsername' : function (event) {
        $("#invalidLogin").hide();
    },

    'focus #password' : function () {
        $("#invalidLogin").hide();
    },

    'keypress #password' : function (e) {
        var key=e.keyCode || e.which;
        if (key == 13) {
            UserPasswordCheck();
        }
    }
});

////////////////////////////////////////////////////////////////////////////
// Template Heleprs

Template.signInTemplate.helpers({
    isExperiment: function() {
        return Session.get("loginMode") === "experiment";
    },

    isNormal: function() {
        return Session.get("loginMode") !== "experiment";
    }
});

////////////////////////////////////////////////////////////////////////////
// Implementation functions

function UserPasswordCheck() {
    var experiment = Session.get("loginMode") === "experiment";
    var newUsername = signInUsername.value;
    var newPassword = (experiment ? "" : password.value);

    if (!!newUsername & newPassword === "") {
        newPassword = Helpers.blankPassword(newUsername);
    }

    if (experiment) {
        //Experiment mode - we create a user if one isn't already there
        var userRec= Meteor.users.findOne({username: newUsername});
        if (!userRec) {
            //No user - must create one
            Accounts.createUser({username: newUsername, password: newPassword}, function (error) {
                if(typeof error !== "undefined") {
                    console.log("Error creating the user account for user:", newUsername, error);
                    alert("Unfortunately, a user account for " + newUsername + " could not be created: " + error);
                    return;
                }

                //Clean up and init the session
                sessionCleanUp();

                var newUserID = Meteor.userId();
                if(newUserID === null) {
                    //This means that we have an issue of some kind - but there's
                    //nothing that we can do? We'll just fall thru for now since
                    //we don't have a good way to fix this
                    console.log("ERROR: The user was not logged in on account creation?", newUsername);
                    alert("It appears that you couldn't be logged in as " + newUsername);
                }

                Router.go("profile");
            });

            //No more processing
            return;
        }
    }

    //If we're here, either we're in experimental mode and we know the user
    //exists **OR** it's a "normal" login
    Meteor.loginWithPassword(newUsername, newPassword, function(error) {
        if (typeof error !== 'undefined') {
            console.log("Login error: " + error);
            $("#invalidLogin").show();
        }
        else {
            $("#invalidLogin").hide();
            if (Session.get("debugging")) {
                var currentUser = Meteor.users.findOne({_id: Meteor.userId()}).username;
                console.log(currentUser + " was logged in successfully!");
                Meteor.call("debugLog", "Sign in was successful");
            }
            Router.go("profile");
        }
    });
}
