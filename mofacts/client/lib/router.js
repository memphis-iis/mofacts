// Note that these three session variables aren't touched by the helpers in
// lib/sessionUtils.js. They are only set here in our client-side routing
Session.set("loginMode", "normal");
Session.set("experimentTarget", "");
Session.set("experimentXCond", "");
Session.set("clusterMapping", "");

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

    Session.set("clusterMapping", "");
    this.render('signIn');
});

Router.route('/signin', function () {
    this.render('signIn');
});

Router.route('/signup', function () {
    this.render('signUp');
});

Router.route('/', function () {
    this.render('signIn');
});

Router.route('/profile', function () {
    Session.set("clusterMapping", "");
    this.render('profile');
});

Router.route('/card', function () {
    this.render('card');
});

Router.route('/admin', function () {
    this.render('admin');
});

Router.route('/instructions', function () {
    this.render('instructions');
}); 

Router.route('/stats', function () {
    this.render('statsPage');
});

Router.route('/allStudents', function () {
		Meteor.subscribe('allUsers');
    this.render('allStudents');
});

// Router.route('/allStudents', {
// 		subscriptions: function () {
// 				this.subscribe('allUsers');
// 		},

// 		action: function () {
// 				this.render('allStudents');
// 		}
// });

Router.route('/allItems', function () {
    Session.set("clusterMapping", "");
    this.render('allItems');
});
