Session.set("loginMode", "normal");

routeToSignin = function() {
    if (Session.get("loginMode") === "experiment") {
        Router.go("/experiment");
    }
    else {
        Router.go("/signin");
    }
};

Router.configure({
    //autoRender: false,
    layoutTemplate: 'DefaultLayout'
});

Router.route('/experiment', function() {
    Session.set("loginMode", "experiment");
    this.render('signInTemplate');
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
    this.render('adminTemplate');
});

Router.route('/instructions', function () {
    this.render('instructionsTemplate');
});

Router.route('/stats', function () {
    this.render('statsPageTemplate');
});
