Template.signInTemplate.events({
    'click #signInButton' : function () {
        if (typeof console !== 'undefined') {
            console.log("You are trying to sign in!");
            console.log(Stimuli.findOne({fileName: "EEGstims.xml"}).stimuli.setspec.clusters[0].cluster[0]);
            console.log(Stimuli.findOne({fileName: "Music.xml"}).stimuli.setspec.clusters[0].cluster[0]);
        }
        var newUsername = signInUsername.value;
        var newPassword = password.value;
        
        Meteor.loginWithPassword(newUsername, newPassword, function(error) {
            if (typeof error !== 'undefined') {
                // console.log(error);
                $("#invalidLogin").show();
                return;
            } else {
                $("#invalidLogin").hide();
                var currentUser = Meteor.users.findOne({_id: Meteor.userId()}).username;
                console.log(currentUser + " was logged in successfully!");
                Router.go("profile");
            }
        });
    },
    'click #signUpButton' : function () {
		Router.go("signup");
    },
    'focus #signInUsername' : function () {
        $("#invalidLogin").hide();
    },
    'focus #password' : function () {
        $("#invalidLogin").hide();
    }
});
