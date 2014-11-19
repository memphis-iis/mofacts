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

Router.route('home', function () {
    this.render('profileTemplate')
});

Router.route('/profile', function () {
    this.render('profileTemplate')
});

Router.route('/card', function () {
    this.render('cardTemplate')
});

Router.route('/instructions', function () {
    this.render('instructionsTemplate')
});

Router.route('/stats', function () {
    this.render('statsPageTemplate')
});