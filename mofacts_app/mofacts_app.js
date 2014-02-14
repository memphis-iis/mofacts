if (Meteor.isClient) {

    Session.setDefault('currentTemplate', 'signInTemplate');
    
    Template.baseTemplate.currentTemplate = Session.get('currentTemplate');
    Template.baseTemplate.signInTemplate = 'signInTemplate';
    Template.baseTemplate.signUpTemplate = 'signUpTemplate';

    Handlebars.registerHelper('equals', function (v1, v2, options) {
        if (v1 === v2) {
            return true;
        } else {
            return false;
        }
    });

    Template.hello.greeting = function () {
        return "Welcome to mofacts_app.";
    };

    Template.hello.events({
        'click input' : function () {
            // template data, if any, is available in 'this'
            if (typeof console !== 'undefined')
                console.log("You pressed the button");
        }
    });

    Template.signInTemplate.events({
        'click #signInButton' : function () {
            if (typeof console !== 'undefined') {
                console.log("You are trying to sign in!");
            }
            //sign the user in here.
        },
        'click #signUpButton' : function () {
            if (typeof console !== 'undefined') {
                console.log("You are trying to sign up!");
            }
            //switch the template to the signUpTemplate.
        }
    });

    Template.signUpTemplate.events({
        'click #signInButton' : function () {
            if (typeof console !== 'undefined') {
                console.log("You are trying to sign in!");
            }
            Session.set('currentTemplate', 'signInTemplate');
        },
        'click #createAccountButton' : function () {
            var newUsername = username.value;
            var newPassword1 = password1.value;
            var newPassword2 = password2.value;
            
            //we need to check if the newUsername is already in use.
            //this requires that the DB already exists.

            if (password1 !== password2) {
                //we need to let them know that their passwords must be the same.
                console.log("Please make sure the passwords you typed in are the same.");
                return;
            }

            //once the above checks have been completed, we can add the user to the DB.

        }
    });
}

if (Meteor.isServer) {
    Meteor.startup(function () {
        // code to run on server at startup
    });
}
