import {Roles} from 'meteor/alanning:roles';
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
    newRec.lastAction = new Date(newRec.maxTimestamp).toLocaleString();
  }
  turkExperimentLog.insert(newRec);
}

async function turkLogRefresh(exp) {
  $('#turkExpTitle').text('Viewing data for ' + exp);
  clearTurkExpLog();

  $('#turkModal').modal('show');

  try {
    const result = await Meteor.callAsync('turkUserLogStatus', exp);
    $('#turkModal').modal('hide');

    _.each(result, function(val, idx) {
      turkLogInsert(_.extend({
        temp: 1,
        idx: idx,
        questionsSeen: 0,
        experiment: exp,
      }, val));
    });
  } catch (error) {
    $('#turkModal').modal('hide');

    const disp = 'Failed to retrieve log entries. Error:' + error;
    console.log(disp);
    alert(disp);
  }
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
    ).fetch();
  },
  experiments: function() {
    const experiments = Tdfs.find({"ownerId": Meteor.userId(), "content.tdfs.tutor.setspec.experimentTarget": {$ne: null}}).fetch()
    return experiments
  },
  use_sandbox: function() {
    return getProfileField('use_sandbox') ? 'checked' : false;
  },
  saveComplete: function() {
    return Session.get('saveComplete');
  },
  profileWorkModalMessage: function() {
    return Session.get('profileWorkModalMessage');
  },
  have_aws_id: function() {
    return getProfileField('have_aws_id');
  },

  have_aws_secret: function() {
    return getProfileField('have_aws_secret');
  },
  turkIds: () => Session.get('turkIds')
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
  $('#profileWorkModal').modal({
    'backdrop': 'static',
    'keyboard': false,
    'show': false,
  });

  $('#detailsModal').modal({
    'show': false,
  });

  const allTdfs = await meteorCallAsync('getAllTdfs');
  let turkLogCount = 0; // Check all the valid TDF's

  const isAdmin = (Meteor.user() && Meteor.user().roles && (['admin']).some(role => Meteor.user().roles.includes(role)));

  allTdfs.forEach( function(tdf) {
    const tdfObject = tdf.content;
    // Make sure we have a valid TDF (with a setspec)
    const setspec = tdfObject.tdfs.tutor.setspec;

    if (!setspec) {
      return;
    }

    // No lesson name? that's wrong
    const name = setspec.lessonname;
    if (!name) {
      return;
    }

    const expTarget = setspec.experimentTarget ? setspec.experimentTarget.trim() : '';

    if (expTarget.length > 0 && (isAdmin || Meteor.userId() === tdfObject.ownerId)){
      $('#tdf-select').append(
          $(`<option id=turk_${tdfObject._id} name=turk_${name} value=${tdfObject.fileName}></option>`)
              .addClass('btn btn-fix btn-primary btn-xs btn-sched-detail btn-log-select')
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
  'click #turk-show-assign': async function(event) {
    event.preventDefault();
    const assignid = $('#turk-assignid').val();
    $('#turk-assign-results').text('Working on ' + assignid);
    $('#turkModal').modal('show');
    try {
      const result = await Meteor.callAsync('turkGetAssignment', assignid);
      $('#turkModal').modal('hide');
      const disp = 'Server returned:' + JSON.stringify(result, null, 2);
      $('#turk-assign-results').text(disp);
    } catch (error) {
      $('#turkModal').modal('hide');
      const disp = 'Failed to handle turk approval. Error:' + error;
      $('#turk-assign-results').text(disp);
    }
  },

  'click #profileWorkModalDissmiss': function(event) {
    event.preventDefault();
    $('#profileWorkModal').modal('hide');
  },

  'click #saveProfile': async function(event) {
    Session.set('saveComplete', false)
    Session.set('profileWorkModalMessage', 'Please wait while we save your information and contact Mechanical Turk.')
    event.preventDefault();

    const data = {
      aws_id: $('#profileAWSID').val(),
      aws_secret_key: $('#profileAWSSecret').val(),
      use_sandbox: $('#profileUseSandbox').prop('checked'),
    };

    $('#profileWorkModal').modal('show');

    const {error, saveResult} = await meteorCallAsync('saveUserAWSData', data);
    console.log(saveResult);

    if (error) {
      console.log('Error saving user profile', error);
      Session.set('profileWorkModalMessage', 'Your changes were not saved! The server said: ' + JSON.stringify(error.message, null, 2));
    } else if (!saveResult) {
      console.log('Server failure while saving profile', saveResult);
      Session.set('profileWorkModalMessage', 'Your changes were not saved! The server said: ' + JSON.stringify(saveResult.error.message, null, 2));
    } else {
      console.log('Profile saved:', saveResult);
      // Clear any controls that shouldn't be kept around
      $('.clearOnSave').val('');
      Session.set('profileWorkModalMessage','Your profile changes have been saved. Save details follow: ' + JSON.stringify(saveResult, null, 2));
    }
    Session.set('saveComplete', true)
  },
  'change #experiment-select': async function(event) {
    event.preventDefault()
    const TDFId = $("#experiment-select").val()
    const users = await meteorCallAsync('getUsersByExperimentId', TDFId)
    $('#user-select').prop('disabled', false);
    Session.set('turkIds', users)
  },

  'click #turk-assignment-removal': function(event) {
    event.preventDefault();
    const turkId = $("#user-select").val();
    const TDFId = $("#experiment-select").val()
    Meteor.callAsync('removeTurkById', turkId, TDFId)
  },

  // Admin/Teachers - send Turk message
  'click #turk-send-msg': async function(event) {
    event.preventDefault();
    const workerid = $('#turk-workerid').val();
    const msgtext = $('#turk-msg').val();
    console.log('Sending to', workerid, 'Msg:', msgtext);
    $('#turkModal').modal('show');
    try {
      const result = await Meteor.callAsync('turkSendMessage', workerid, msgtext);
      $('#turkModal').modal('hide');
      const disp = 'Server returned:' + JSON.stringify(result, null, 2);
      console.log(disp);
      alert(disp);
    } catch (error) {
      $('#turkModal').modal('hide');
      const disp = 'Failed to handle turk approval. Error:' + error;
      console.log(disp);
      alert(disp);
    }
  },

  // Admin/Teachers - show user log for a particular experiment
  'change #tdf-select': function(event) {
    event.preventDefault();

    const target = $("#tdf-select");
    const exp = target.val();

    turkLogRefresh(exp);
  },

  // Admin/Teachers - filter Turk log results by trials seen
  'keyup #turklog-filt': function(event) {
    Session.set('turkLogFilterTrials', _.intval($('#turklog-filt').val()));
    console.log('Filtering for', Session.get('turkLogFilterTrials'), 'trials');
  },

  // Admin/Teachers - approve/pay a user in the Turk log view
  'click .btn-pay-action': async function(event) {
    event.preventDefault();

    const rec = turkLogButtonToRec(event.currentTarget);
    if (!rec) {
      alert('Cannot find record for that table entry?!');
      return;
    }
    const exp = await meteorCallAsync('getTdfByFileName', rec.experiment)
    const expId = exp._id
    if (!exp) {
      alert('Could not determine the experiment name for this entry?!');
      return;
    }

    const msg = 'Thank you for participating';

    $('#turkModal').modal('show');
    try {
      const result = await Meteor.callAsync('turkPay', rec.userId, expId, msg);
      $('#turkModal').modal('hide');

      rec.turkpayDetails = {
        msg: 'Refresh the view to see details on server',
        details: '',
      };

      if (result) {
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
    } catch (error) {
      $('#turkModal').modal('hide');

      rec.turkpayDetails = {
        msg: 'Refresh the view to see details on server',
        details: error,
      };
      rec.turkpay = 'FAIL';
      console.log('turkPay failure:', error);
      alert('There was a server failure of some kind: ' + error);

      turkExperimentLog.remove({'idx': rec.idx});
      turkLogInsert(rec);
    }
  },

  // Admin/Teachers - pay bonus to a user in the Turk log view
  'click .btn-bonus-action': async function(event) {
    event.preventDefault();

    const rec = turkLogButtonToRec(event.currentTarget);
    if (!rec) {
      alert('Cannot find record for that table entry?!');
      return;
    }

    const exp = await meteorCallAsync('getTdfByFileName', rec.experiment)
    const expId = exp._id
    const expFile =  _.trim(rec.experiment).replace(/\./g, '_');
    if (!exp) {
      alert('Could not determine the experiment name for this entry?!');
      return;
    }

    $('#turkModal').modal('show');

    try {
      const result = await Meteor.callAsync('turkBonus', rec.userId, expFile, expId);
      $('#turkModal').modal('hide');

      rec.turkbonusDetails = {
        msg: 'Refresh the view to see details on server',
        details: '',
      };

      if (result) {
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
    } catch (error) {
      $('#turkModal').modal('hide');

      rec.turkbonusDetails = {
        msg: 'Refresh the view to see details on server',
        details: error,
      };
      rec.turkbonus = 'FAIL';
      console.log('turkBonus failure:', error);
      alert('There was a server failure of some kind: ' + error);

      turkExperimentLog.remove({'idx': rec.idx});
      turkLogInsert(rec);
    }
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

function getProfileField(field) {
  const prof = Meteor.user().profile?.aws;
  if (!prof || typeof prof[field] === undefined) {
    return null;
  }
  return prof[field];
}