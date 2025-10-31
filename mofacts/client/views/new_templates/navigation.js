import {Roles} from 'meteor/alanning:roles';
Template.nav.events({
    'click #gearMenu': function(event) {
        event.preventDefault();
        Router.go('/experimentSettings');
    },
    'click #learningDashboardButton': function(event) {
        event.preventDefault();
        $('#full-menu').hide();
        if (window.currentAudioObj) {
          window.currentAudioObj.pause();
        }
        // Instantly hide offcanvas to prevent layout shift during page transition
        const offcanvas = bootstrap.Offcanvas.getInstance(document.getElementById('navOffcanvas'));
        if (offcanvas) {
          offcanvas.hide();
        }
        // Clear out session variables for clean state
        Session.set('studentUsername', null);
        Session.set('curStudentID', undefined);
        Session.set('curStudentPerformance', undefined);
        Session.set('instructorSelectedTdf', undefined);
        Session.set('curClassPerformance', undefined);
        Router.go('/learningDashboard');
    },
    // Keep old handlers commented out for reference
    // 'click #progressButton': function(event) {
    //     event.preventDefault();
    //     //hide the menu
    //     $('#full-menu').hide();
    //     //check current users role, if admin or teacher
    //     //then go to progress page
    //     //else go to profile page
    //     if ((Meteor.userId() && Meteor.userId().roles && (['admin', 'teacher']).some(role => Meteor.userId().roles.includes(role)))) {
    //         Router.go('/studentReporting');
    //     } else {
    //       if (window.currentAudioObj) {
    //         window.currentAudioObj.pause();
    //       }
    //       // Clear out studentUsername in case we are a teacher/admin who previously
    //       // navigated to this page for a particular student and want to see our own progress
    //       Session.set('studentUsername', null);
    //       Session.set('curStudentID', undefined);
    //       Session.set('curStudentPerformance', undefined);
    //       Session.set('curClass', undefined);
    //       Session.set('instructorSelectedTdf', undefined);
    //       Session.set('curClassPerformance', undefined);
    //       $('#full-menu').hide();
    //       Router.go('/profile');
    //     }
    //   },
    //   'click #lessonSelectButton': function(event) {
    //     $('#full-menu').hide();
    //     Router.go('/lessonSelect');
    //   },
      'click #profileButton': function(event) {
        $('#full-menu').hide();
        Router.go('/profile');
      }
});