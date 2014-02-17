Template.signInTemplate.events({
    'click #signInButton' : function () {
        if (typeof console !== 'undefined') {
            console.log("You are trying to sign in!");
        }
        var newUsername = username.value;
        var newPassword = password.value;
        //IWB 2/14/2014 - sign the user in here.
    },
    'click #signUpButton' : function () {
        if (typeof console !== 'undefined') {
            console.log("You are trying to sign up!");
        }
        //IWB 2/14/2014 - switch the template to the signUpTemplate.
    }
});
