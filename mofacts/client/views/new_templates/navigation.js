Template.nav.events({
    'click #gearMenu': function(event) {
        event.preventDefault();
        Router.go('/experimentSettings');
    },
});