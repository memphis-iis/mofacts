Router.configure({
//  autoRender: false,
    layoutTemplate: 'DefaultLayout'
});

Router.route('/signin', function () {
    this.render('signInTemplate')
});

Router.route('/signup', function () {
    this.render('signUpTemplate')
});

Router.route('/', function () {
    this.render('signInTemplate')
});

Router.route('/profile', function () {
    //TODO: add roles to user accounts instead of using AdminAccounts collection
    var useracc = UserAccounts.findOne({id: Meteor.userId()});
    if(typeof useracc !== "undefined") {
        this.render('profileTemplate');
    }
    else if (AdminAccounts.findOne({id: Meteor.userId()}) != undefined) {
        this.render('adminTemplate');
    }
});

Router.route('/card', function () {
    this.render('cardTemplate')
});

Router.route('/admin', function () {
   this.render('adminTemplate');
});

Router.route('/instructions', function () {
    this.render('instructionsTemplate')
});

Router.route('/stats', function () {
    this.render('statsPageTemplate')
});
