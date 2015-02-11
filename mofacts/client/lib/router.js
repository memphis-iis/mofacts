//TODO: insure all links and routes start with '/' since we can have multiple URL levels now

// Note that these three session variables aren't touched by the helpers in
// lib/sessionUtils.js. They are only set here in our client-side routing
Session.set("loginMode", "normal");
Session.set("experimentTarget", "");
Session.set("experimentXCond", "");

//TODO: test the various ways to use the new URL's
//TODO: auto-select test in profile template
//TODO: honor experimentXCond

routeToSignin = function() {
    if (Session.get("loginMode") === "experiment") {
        var routeParts = ['/experiment'];

        var target = Session.get("experimentTarget");
        if (target) {
            routeParts.push(target);
            var xcond = Session.get("experimentXCond");
            if (xcond) {
                routeParts.push(xcond);
            }
        }

        Router.go(routeParts.join('/'));
    }
    else {
        Router.go("/signin");
    }
};

Router.configure({
    layoutTemplate: 'DefaultLayout'
});

Router.route('/experiment/:target?/:xcond?', function() {
    Session.set("loginMode", "experiment");

    var target = this.params.target || "";
    var xcond = this.params.xcond || "";

    Session.set("experimentTarget", target);
    Session.set("experimentXCond", xcond);

    console.log("EXPERIMENT target:", target, "xcond", xcond);

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
