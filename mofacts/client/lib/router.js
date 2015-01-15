Router.configure({
    //autoRender: false,
    layoutTemplate: 'DefaultLayout'
});

Router.onBeforeAction(function() {
    if (!Meteor.userId()) {
        this.render('signInTemplate');
    }
    else {
        this.next();
    }
});

Router.route('/signin', function () {
    this.render('signInTemplate');
});

Router.route('/signup', function () {
    this.render('signUpTemplate');
});

Router.route('/', function () {
    this.render('signInTemplate');
});

Router.route('/profile', function () {
    this.render('profileTemplate');
});

Router.route('/card', function () {
    this.render('cardTemplate');
});

Router.route('/admin', function () {
    //TODO: check admin role
    //TODO: what about teachers?
    this.render('adminTemplate');
});

Router.route('/instructions', function () {
    this.render('instructionsTemplate');
});

Router.route('/stats', function () {
    console.log("About to render stats template"); //TODO: remove
    this.render('statsPageTemplate');
});
