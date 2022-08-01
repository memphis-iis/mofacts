Template.profileDebugToggles.rendered = function() {
    debugParms = Session.get('debugParms');
    $('#debugProbParmsDisplay').prop('checked', debugParms.probParmsDisplay);
}
Template.profileDebugToggles.helpers({
    debugParms: () => {
        return Session.get('debugParms');
    }
});

Template.profileDebugToggles.events({
    'click #debugProbParmsDisplay': function(event) {
        debugParms = Session.get('debugParms') || {};
        debugParms.probParmsDisplay = !debugParms.probParmsDisplay;
        $('#debugProbParmsDisplay').prop('checked', debugParms.probParmsDisplay);
        Session.set('debugParms', debugParms);
        console.log('debugParms: ' + JSON.stringify(debugParms));
    },
});