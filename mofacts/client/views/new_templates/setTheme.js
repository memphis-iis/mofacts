Template.setTheme.events({
    'click .selectTheme': function(event) {
        event.preventDefault();
        //get data-id of the selected option
        var theme = $(event.target).data('id');
        //append /stylesheets/ to the theme name
        theme = '/styles/' + theme;
        console.log("Theme changed to: " + theme);
        //change the link with id theme to the new theme
        $('#theme').attr('href', theme);
        Meteor.call('setUserTheme', theme);
    }
});