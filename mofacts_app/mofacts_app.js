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
            Session.set('currentTemplate', 'signUpTemplate');
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
            //create the new user account here.
        }
    });
}

if (Meteor.isServer) {
    Meteor.startup(function () {
        // code to run on server at startup
    });
}
