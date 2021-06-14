import {meteorCallAsync} from '..';
import {displayify} from '../../common/globalHelpers';

const turkExperimentLog = new Mongo.Collection(null); // local-only - no database;

function clearTurkExpLog() {
  turkExperimentLog.remove({'temp': 1});
}

function turkLogInsert(newRec) {
  newRec.needPay = (newRec.turkpay === '?');
  newRec.needBonus = (newRec.turkbonus === '?');
  newRec.haveEmailSched = (newRec.turkEmailSchedule !== '?');
  newRec.haveEmailSend = (newRec.turkEmailSend !== '?');
  newRec.turk_username = newRec.username;

  if (newRec.maxTimestamp) {
    newRec.lastAction = new Date(newRec.maxTimestamp);
  }
  turkExperimentLog.insert(newRec);
}

function turkLogRefresh(exp) {
  $('#turkExpTitle').text('Viewing data for ' + exp);
  clearTurkExpLog();

  $('#turkModal').modal('show');

  Meteor.call('turkUserLogStatus', exp, function(error, result) {
    $('#turkModal').modal('hide');

    if (typeof error !== 'undefined') {
      const disp = 'Failed to retrieve log entries. Error:' + error;
      console.log(disp);
      alert(disp);
      return;
    }

    _.each(result, function(val, idx) {
      turkLogInsert(_.extend({
        temp: 1,
        idx: idx,
        questionsSeen: 0,
        experiment: exp,
      }, val));
    });
  });
}

function turkLogButtonToRec(element) {
  const target = $(element);
  const idx = _.intval(target.data('idx'), -1);
  console.log('Pay event for', target, 'Found index', idx);

  if (idx < 0) {
    return null;
  }

  return turkExperimentLog.findOne(
      {'idx': idx},
      {sort: [['maxTimestamp', 'desc'], ['idx', 'asc']]},
  );
}

Template.turkWorkflow.helpers({
  turkExperimentLogToShow: function() {
    return turkExperimentLog.find().count() > 0;
  },

  turkExperimentLog: function() {
    const minTrials = _.intval(Session.get('turkLogFilterTrials') || -1);
    return turkExperimentLog.find(
        {'questionsSeen': {'$gte': _.intval(minTrials)}},
        {sort: [['maxTimestamp', 'desc'], ['idx', 'asc']]},
    );
  },
});


// //////////////////////////////////////////////////////////////////////////
// Template Events

Template.turkWorkflow.rendered = async function() {
  // Init the modal dialogs
  $('#turkModal').modal({
    'backdrop': 'static',
    'keyboard': false,
    'show': false,
  });

  $('#detailsModal').modal({
    'show': false,
  });

  const allTdfs = await meteorCallAsync('getAllTdfs');
  let turkLogCount = 0; // Check all the valid TDF's

  const isAdmin = Roles.userIsInRole(Meteor.user(), ['admin']);

  allTdfs.forEach( function(tdf) {
    const tdfObject = tdf.content;
    // Make sure we have a valid TDF (with a setspec)
    const setspec = tdfObject.tdfs.tutor.setspec[0];

    if (!setspec) {
      return;
    }

    // No lesson name? that's wrong
    const name = _.chain(setspec).prop('lessonname').first().value();
    if (!name) {
      return;
    }

    const expTarget = _.chain(setspec).prop('experimentTarget').first().trim().value();

    if (expTarget.length > 0 && (isAdmin || Meteor.userId() === tdfObject.owner)) {
      $('#turkLogSelectContainer').append(
          $('<button type=\'button\' id=\'turk_'+tdfObject._id+'\' name=turk_\''+name+'\'></button>')
              .addClass('btn btn-fix btn-sm btn-success btn-log-select')
              .css('margin', '3px')
              .data('tdffilename', tdfObject.fileName)
              .html(name),
      );

      turkLogCount += 1;
    }
  });

  // Only show turk log stuff if there is anything to show
  $('#turkLogAll').toggle(turkLogCount > 0);
};


Template.turkWorkflow.events({
  // Admin/Teachers - show details from single Turk assignment
  'click #turk-show-assign': function(event) {
    event.preventDefault();
    const assignid = $('#turk-assignid').val();
    $('#turk-assign-results').text('Working on ' + assignid);
    $('#turkModal').modal('show');
    Meteor.call('turkGetAssignment', assignid, function(error, result) {
      $('#turkModal').modal('hide');
      let disp;
      if (typeof error !== 'undefined') {
        disp = 'Failed to handle turk approval. Error:' + error;
      } else {
        disp = 'Server returned:' + JSON.stringify(result, null, 2);
      }
      $('#turk-assign-results').text(disp);
    });
  },

  // Admin/Teachers - send Turk message
  'click #turk-send-msg': function(event) {
    event.preventDefault();
    const workerid = $('#turk-workerid').val();
    const msgtext = $('#turk-msg').val();
    console.log('Sending to', workerid, 'Msg:', msgtext);
    $('#turkModal').modal('show');
    Meteor.call('turkSendMessage', workerid, msgtext, function(error, result) {
      $('#turkModal').modal('hide');
      let disp;
      if (typeof error !== 'undefined') {
        disp = 'Failed to handle turk approval. Error:' + error;
      } else {
        disp = 'Server returned:' + JSON.stringify(result, null, 2);
      }
      console.log(disp);
      alert(disp);
    });
  },

  // Admin/Teachers - show user log for a particular experiment
  'click .btn-log-select': function(event) {
    event.preventDefault();

    const target = $(event.currentTarget);
    const exp = target.data('tdffilename');

    turkLogRefresh(exp);
  },

  // Admin/Teachers - filter Turk log results by trials seen
  'keyup #turklog-filt': function(event) {
    Session.set('turkLogFilterTrials', _.intval($('#turklog-filt').val()));
    console.log('Filtering for', Session.get('turkLogFilterTrials'), 'trials');
  },

  // Admin/Teachers - approve/pay a user in the Turk log view
  'click .btn-pay-action': function(event) {
    event.preventDefault();

    const rec = turkLogButtonToRec(event.currentTarget);
    if (!rec) {
      alert('Cannot find record for that table entry?!');
      return;
    }

    const exp = _.trim(rec.experiment).replace(/\./g, '_');
    if (!exp) {
      alert('Could not determine the experiment name for this entry?!');
      return;
    }

    const msg = 'Thank you for participating';

    $('#turkModal').modal('show');

    Meteor.call('turkPay', rec.userid, exp, msg, function(error, result) {
      $('#turkModal').modal('hide');

      rec.turkpayDetails = {
        msg: 'Refresh the view to see details on server',
        details: '',
      };

      if (error) {
        rec.turkpay = 'FAIL';
        rec.turkpayDetails.details = error;
        console.log('turkPay failure:', error);
        alert('There was a server failure of some kind: ' + error);
      } else if (result) {
        console.log('turkPay error:', result);
        rec.turkpay = 'FAIL';
        rec.turkpayDetails.details = result;
        alert('There was a problem with the approval/payment: ' + result);
      } else {
        rec.turkpay = 'Complete';
        rec.turkpayDetails.details = 'None available';
        alert('Your approval succeeded');
      }

      turkExperimentLog.remove({'idx': rec.idx});
      turkLogInsert(rec);
    });
  },

  // Admin/Teachers - pay bonus to a user in the Turk log view
  'click .btn-bonus-action': function(event) {
    event.preventDefault();

    const rec = turkLogButtonToRec(event.currentTarget);
    if (!rec) {
      alert('Cannot find record for that table entry?!');
      return;
    }

    const exp = _.trim(rec.experiment).replace(/\./g, '_');
    if (!exp) {
      alert('Could not determine the experiment name for this entry?!');
      return;
    }

    $('#turkModal').modal('show');

    Meteor.call('turkBonus', rec.userid, exp, function(error, result) {
      $('#turkModal').modal('hide');

      rec.turkbonusDetails = {
        msg: 'Refresh the view to see details on server',
        details: '',
      };

      if (error) {
        rec.turkbonus = 'FAIL';
        rec.turkbonusDetails.details = error;
        console.log('turkBonus failure:', error);
        alert('There was a server failure of some kind: ' + error);
      } else if (result) {
        rec.turkbonus = 'FAIL';
        rec.turkbonusDetails.details = result;
        console.log('turkBonus error:', result);
        alert('There was a problem with the bonus: ' + result);
      } else {
        rec.turkbonus = 'Complete';
        rec.turkbonusDetails.details = 'None available';
        alert('Your bonus payment succeeded');
      }

      turkExperimentLog.remove({'idx': rec.idx});
      turkLogInsert(rec);
    });
  },

  // Admin/Teachers - show previous approve/pay for a user in the Turk log view
  'click .btn-pay-detail': function(event) {
    event.preventDefault();

    $('#detailsModal').modal('hide');

    let disp;
    try {
      disp = displayify(turkLogButtonToRec(event.currentTarget).turkpayDetails);
    } catch (e) {
      disp = 'Error finding details to display: ' + e;
    }

    $('#detailsModalListing').text(disp);
    $('#detailsModal').modal('show');
  },

  // Admin/Teachers - show previous bonus for a user in the Turk log view
  'click .btn-bonus-detail': function(event) {
    event.preventDefault();

    $('#detailsModal').modal('hide');

    let disp;
    try {
      disp = displayify(turkLogButtonToRec(event.currentTarget).turkbonusDetails);
    } catch (e) {
      disp = 'Error finding details to display: ' + e;
    }

    $('#detailsModalListing').text(disp);
    $('#detailsModal').modal('show');
  },

  // Admin/Teachers - show previous email sched detail
  'click .btn-sched-detail': function(event) {
    event.preventDefault();

    $('#detailsModal').modal('hide');

    let disp;
    try {
      disp = displayify(turkLogButtonToRec(event.currentTarget).turkEmailScheduleDetails);
    } catch (e) {
      disp = 'Error finding details to display: ' + e;
    }

    $('#detailsModalListing').text(disp);
    $('#detailsModal').modal('show');
  },

  // Admin/Teachers - show previous email send detail
  'click .btn-send-detail': function(event) {
    event.preventDefault();

    $('#detailsModal').modal('hide');

    let disp;
    try {
      disp = displayify(turkLogButtonToRec(event.currentTarget).turkEmailSendDetails);
    } catch (e) {
      disp = 'Error finding details to display: ' + e;
    }

    $('#detailsModalListing').text(disp);
    $('#detailsModal').modal('show');
  },
});
