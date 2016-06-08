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
    this.render('profile');
});

Router.route('/card', function () {
    this.render('card');
});

Router.route('/admin', function () {
    this.render('admin');
});

//Sends the user to the choose page where the user can choose
//between viewing all of the items or all of the students for the system.
Router.route('/choose', function () {
    if (Roles.userIsInRole(Meteor.user(), ["admin", "teacher"])) {
        this.render('/choose');
    }
    else {
        this.redirect('/student');
    }
});

Router.route('/instructions', function () {
    this.render('instructions');
});

Router.route('/stats', function () {
    this.render('statsPage');
});

//Graph pages
Router.route('/itemStats', function () {
    this.render('itemStats');
});

//Used for all of the students on the system
Router.route('/allStudents', function(){
    this.subscribe('allUsers').wait();
    if (this.ready()){
        this.render('allStudents');
    }
    else{
        this.render('');
    }
});

//Individual student page
Router.route('/student', function () {
    this.render('student');
});

//The item page that houses all the items for a system
Router.route('/Items', function () {
    this.render('Items');
});

//A listing of all of the systems/tests
Router.route('/allItems', function () {
    Session.set("clusterMapping", "");
    this.render('allItems');
});

Router.route('/testpage', function() {
    this.render('tester');
});
