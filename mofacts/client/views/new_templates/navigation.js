Template.nav.events({
    'click #gearMenu': function(event) {
        event.preventDefault();
        Router.go('/experimentSettings');
    },
    'click #progressButton': function(event) {
        event.preventDefault();
        //check current users role, if admin or teacher
        //then go to progress page
        //else go to profile page
        if (Roles.userIsInRole(Meteor.userId(), ['admin', 'teacher'])) {
            Router.go('/studentReporting');
        } else {
          if (window.currentAudioObj) {
            window.currentAudioObj.pause();
          }
          // Clear out studentUsername in case we are a teacher/admin who previously
          // navigated to this page for a particular student and want to see our own progress
          Session.set('studentUsername', null);
          Session.set('curStudentID', undefined);
          Session.set('curStudentPerformance', undefined);
          Session.set('curClass', undefined);
          Session.set('instructorSelectedTdf', undefined);
          Session.set('curClassPerformance', undefined);
          $('#full-menu').hide();
          Router.go('/profile');
        }
      },
      'click #lessonSelectButton': function(event) {
        $('#full-menu').hide();
        Router.go('/lessonSelect');
    },
});