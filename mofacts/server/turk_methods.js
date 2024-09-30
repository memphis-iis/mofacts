import {getTdfById, getTdfByFileName, serverConsole, getTdfByExperimentTarget} from './methods';
import {displayify} from '../common/globalHelpers';

export {sendScheduledTurkMessages};
/* turk_methods.js - Implement the server-side methods called by our clients
**/


writeUserLogEntries = function(experimentId, objectsToLog, userId) {
  if (!userId) {
    throw new Meteor.Error('No valid user ID found for User Log Entry');
  }
  if(!Array.isArray(objectsToLog))
    objectsToLog = [objectsToLog];
  const action = {$push: {}};
  action['$push'][experimentId] = {$each: objectsToLog};

  UserTimesLog.update( {userId: userId}, action, {upsert: true} );
  logUserMetrics(userId, experimentId, objectsToLog);
};

// Utility - update server-side metrics when we see an answer
function logUserMetrics(userId, experimentKey, valsToCheck) {
  // Gather the answers we should use to check
  const answers = valsToCheck.map((rec) =>(rec.action == 'answer' || rec.action == '[timeout]'));

  // Leave if nothing to do
  if (answers.length < 1) {
    return;
  }

  const makeKey = function(idx, fieldName) {
    return experimentKey + '.' + idx + '.' + fieldName;
  };

  for (let i = 0; i < answers.length; ++i) {
    const answer = answers[i];
    const ttype = _.trim(answer.ttype);
    const idx = _.intval(answer.shufIndex);

    let action;
    if (ttype == 's') {
      // Study
      const reviewTime = _.intval(answer.inferredReviewLatency);
      action = [{'$push': {}, '$inc': {}}];
      action[0]['$push'][makeKey(idx, 'studyTimes')] = reviewTime;
      action[0]['$inc'][makeKey(idx, 'studyCount')] = 1;
    } else {
      const isCorrect = answer.isCorrect;
      const answerTime = _.intval(answer.endLatency);
      action = [{'$push': {}, '$inc': {}}];
      action[0]['$push'][makeKey(idx, 'answerTimes')] = answerTime;
      action[0]['$push'][makeKey(idx, 'answerCorrect')] = isCorrect;
      action[0]['$inc'][makeKey(idx, 'questionCount')] = 1;
      action[0]['$inc'][makeKey(idx, 'correctAnswerCount')] = (isCorrect ? 1 : 0);
    }

    for (let j = 0; j < action.length; ++j) {
      UserMetrics.update({_id: userId}, action[j]);
    }
  }
}
// Given a user ID (_id) and an experiment, return the corresponding tdfId (_id)
async function userLogGetTdfId(userid, experiment) {
  const userLog = UserTimesLog.findOne({userId: userid});
  let entries = [];
  if (userLog && userLog[experiment] && userLog[experiment].length) {
    entries = userLog[experiment];
  }

  let id = null;
  for (let i = 0; i < entries.length; ++i) {
    const rec = entries[i];
    const action = _.trim(rec.action).toLowerCase();

    // Only need to see the tdf select event once to get the key
    if (action === 'expcondition' || action === 'condition-notify') {
      id = _.display(rec.currentTdfName);
      if (id) {
        break;
      }
    }
  }

  if (id) {
    const tdf = await getTdfByFileName(id);
    if (tdf) {
      return tdf.content._id;
    }
  }

  return null; // Whoops
}

// Return the _id of the user record for the "owner" (or teacher) of the given
// experiment name (TDF). This is mainly for knowing how to handle MTurk calls
async function getTdfOwner(experimentId) {
  // Now we can get the owner (either set on upload of TDF *OR* set on server
  // startup for TDF's that live in git)
  const tdf = await getTdfById(experimentId);
  if (!!tdf && typeof tdf.ownerId !== 'undefined') {
    return tdf.ownerId;
  } else {
    serverConsole('getTdfOwner for ', experimentId, 'failed - TDF doesn\'t contain owner');
    serverConsole(tdf._id, tdf);
    return null;
  }
}


// Send any scheduled messages in ScheduledTurkMessages
async function sendScheduledTurkMessages() {
  const now = Date.now();
  let sendCount = 0;

  serverConsole('Looking for ScheduledTurkMessages on or after', new Date(now));

  while (true) {
    // Find next email to send
    const nextJob = ScheduledTurkMessages.findOne({
      'sent': '',
      'scheduled': {'$lte': now},
    });
    if (!nextJob) {
      break;
    }

    // Send turk message
    serverConsole('Running scheduled job', nextJob._id);
    let senderr = null;
    let retval = null;

    try {
      const ownerProfile = Meteor.users.findOne({_id: nextJob.ownerProfileId});
      if (!ownerProfile) {
        throw new Error('Could not find current user profile');
      }
      if (!ownerProfile.aws || ownerProfile.aws.have_aws_id || !ownerProfile.aws.have_aws_secret) {
        throw new Error('Current user not set up for AWS/MTurk');
      }
      const ret = await turk.notifyWorker(ownerProfile.aws, nextJob.requestParams);
      serverConsole('Completed scheduled job', nextJob._id);
      retval = _.extend({'passedParams': nextJob.requestParams}, ret);
    } catch (e) {
      serverConsole('Error - COULD NOT SEND TURK MESSAGE: ', e);
      senderr = e;
    } finally {
      const sendLogEntry = {
        'action': 'turk-email-send',
        'success': senderr === null,
        'result': retval,
        'errmsg': senderr,
        'turkId': nextJob.requestParams.WorkerId,
        'tdfOwnerId': nextJob.ownerId,
        'schedDate': (new Date(nextJob.scheduled)).toString(),
      };

      serverConsole('About to log entry for Turk', JSON.stringify(sendLogEntry, null, 2));
      writeUserLogEntries(nextJob.experiment, sendLogEntry, nextJob.workerUserId);
    }

    // Mark the email sent, not matter what happened
    let markedRecord = null;
    try {
      ScheduledTurkMessages.update(
          {'_id': nextJob._id},
          {'$set': {'sent': Date.now()}},
      );
      markedRecord = true;
      sendCount++;
      serverConsole('Finished requested email:', nextJob._id);
    } catch (e) {
      serverConsole('FAILED TO MARK JOB DONE: ', nextJob._id, e);
      markedRecord = false;
    }

    if (!!senderr || !markedRecord) {
      break; // Nothing to do - we failed!
    }
  }

  serverConsole('Total sent messages:', sendCount);
  return {'sendCount': sendCount};
};


// Set up our server-side methods
Meteor.methods({
  // Simple assignment debugging for turk
  turkGetAssignment: async function(assignid) {
    serverConsole('turkGetAssignment', assignid);
    try {
      const usr = Meteor.user();
      if (!Roles.userIsInRole(usr, ['admin', 'teacher'])) {
        throw new Error('You are not authorized to do that');
      }

      const profile = usr.aws;
      if (!profile) {
        return 'Could not find current user profile';
      }
      if (!profile.have_aws_id || !profile.have_aws_secret) {
        return 'Current user not set up for AWS/MTurk';
      }
      const res = await turk.getAssignment(profile, {'AssignmentId': assignid});
      return res;
    } catch (e) {
      return e;
    }
  },

  // Simple message sending
  turkSendMessage: async function(workerid, msgtext) {
    serverConsole('turkSendMessage', workerid);
    try {
      const usr = Meteor.user();
      if (!Roles.userIsInRole(usr, ['admin', 'teacher'])) {
        throw new Error('You are not authorized to do that');
      }

      const profile = usr.aws;
      if (!profile) {
        return 'Could not find current user profile';
      }
      if (!profile.have_aws_id || !profile.have_aws_secret) {
        return 'Current user not set up for AWS/MTurk';
      }
      const res = await turk.notifyWorker(profile, {
        'Subject': 'Message from ' + usr.username + ' Profile Page',
        'MessageText': msgtext,
        'WorkerId': workerid,
      });
      return res;
    } catch (e) {
      serverConsole('Error for turkSendMessage', e);
      return e;
    }
  },

  // Message sending for the end of a lockout
  turkScheduleLockoutMessage: async function(experiment, lockoutend, subject, msgbody) {
    serverConsole('turkScheduleLockoutMessage', experiment, lockoutend, subject);

    let usr; let turkid; let ownerId; let workerUserId;
    let schedDate;
    let jobName;
    let resultMsg = '';
    let errmsg = null;
    let requestParams = null; // Params used to make email send request

    try {
      usr = Meteor.user();
      if (!usr || !usr._id) {
        throw Meteor.Error('No current user');
      }

      workerUserId = usr._id;
      turkid = usr.username;
      if (!turkid) {
        throw new Meteor.Error('No valid username found');
      }
      turkid = _.trim(turkid).toUpperCase();

      ownerId = await getTdfOwner(experiment);

      const ownerProfile = await Meteor.users.findOne({_id: ownerId});
      if (!ownerProfile) {
        throw new Meteor.Error('Could not find TDF owner profile for id \'' + ownerId + '\'');
      }
      serverConsole('Found owner profile', ownerProfile);
      if (!ownerProfile.aws || !ownerProfile.aws.have_aws_id || !ownerProfile.aws.have_aws_secret) {
        throw new Meteor.Error('Current TDF owner not set up for AWS/MTurk');
      }

      const previouslyScheduledMessage = await ScheduledTurkMessages.findOne({ workerUserId: workerUserId, experiment: experiment, scheduled: { $gt: Date.now() } });
      if (!previouslyScheduledMessage) {
        subject = subject || _.trim('Message from ' + turkid + ' Profile Page');
        const msgtext = 'The lock out period has ended - you may continue.\n\n' + msgbody;
        jobName = 'Message for ' + experiment + ' to ' + turkid;
        schedDate = new Date(lockoutend);

        // Pre-calculate our request parameters for send to that we can
        // copy them to our schedule log entry
        requestParams = {
          'Subject': subject,
          'MessageText': msgtext,
          'WorkerId': turkid,
        };

        serverConsole('Scheduling:', jobName, 'at', schedDate);
        ScheduledTurkMessages.insert({
          'sent': '',
          'ownerId': ownerId,
          'scheduled': schedDate.getTime(),
          'ownerProfileId': ownerProfile._id,
          'requestParams': requestParams,
          'jobName': jobName,
          'experiment': experiment,
          'workerUserId': workerUserId
        });

        serverConsole('Scheduled Message scheduled for:', schedDate);
        resultMsg = 'Message scheduled';
      } else {
        resultMsg = 'Message already scheduled';
      }
    } catch (e) {
      serverConsole('Failure scheduling turk message at later date:', e);
      errmsg = {
        'msg': _.prop(e, 'error'),
        'full': displayify(e),
      };
    } finally {
      // Always write an entry
      const schedLogEntry = {
        'action': 'turk-email-schedule',
        'success': errmsg === null,
        'result': resultMsg,
        'errmsg': errmsg,
        'turkId': turkid,
        'tdfOwnerId': ownerId,
        'schedDate': schedDate ? schedDate.toString() : '???',

        // The following three properties are for recreating the sched
        // call (although you'll need to create a Date from schedDateRaw
        // and retrieve the owner profile with tdfOwnerId)
        'schedDateRaw': schedDate ? schedDate.getTime() : 0,
        'jobname': jobName,
        'requestParams': requestParams,
      };

      serverConsole('About to log email sched entry for Turk', JSON.stringify(schedLogEntry, null, 2));
      writeUserLogEntries(experiment, [schedLogEntry], workerUserId);
    }

    if (errmsg !== null) {
      throw Meteor.Error('Message-Failure', errmsg.msg, errmsg.full);
    }

    return resultMsg;
  },

  // Assuming the current user is an admin or teacher, and given a user ID, an
  // experiment, and a msg - we attempt to pay the user for the current MTurk
  // HIT/assignment.
  // RETURNS: null on success or an error message on failure. Any results
  // are logged to the user times log
  turkPay: async function(workerUserId, experiment, msg) {
    serverConsole('turkPay', workerUserId, experiment);

    let errmsg = null; // Return null on success

    // Data we log
    const workPerformed = {
      findHITs: 'not performed',
      findAssignment: 'not performed',
      approveAssignment: 'not performed',
    };

    let ownerId; let turkid; // Needed for final work

    try {
      const usr = Meteor.user();
      if (!Roles.userIsInRole(usr, ['admin', 'teacher'])) {
        throw new Error('You are not authorized to do that');
      }
      ownerId = usr._id;

      const ownerProfile = Meteor.users.findOne({_id: ownerId});
      if (!ownerProfile) {
        throw new Error('Could not find your user profile');
      }
      if (!ownerProfile.aws || !ownerProfile.aws.have_aws_id || !ownerProfile.aws.have_aws_secret) {
        throw new Error('You are not set up for AWS/MTurk');
      }
      turkid = _.chain(Meteor.users.findOne({'_id': workerUserId}))
          .prop('username').trim()
          .value().toUpperCase();
      if (!turkid) {
        throw new Error('No valid username found');
      }

      if (ownerId != await getTdfOwner(experiment)) {
        throw new Error('You are not the owner of that TDF');
      }

      // Get available HITs
      let hitlist = await turk.getAvailableHITs(ownerProfile, {});
      if (hitlist && hitlist.length) {
        workPerformed.findHITs = 'HITs found: ' + hitlist.length;
        workPerformed.hitdetails = hitlist;
      } else {
        workPerformed.findHITs = 'No HITs found';
        hitlist = [];
        throw new Error('No HITs - can not continue');
      }

      // Look for assignments for HITs that can be reviewed
      let assignment = null;
      for (let i = 0; i < hitlist.length; ++i) {
        const hit = hitlist[i];
        let assignList = await turk.getAssignmentsForHIT(ownerProfile, hit);
        if (!assignList) {
          assignList = [];
        }

        for (let j = 0; j < assignList.length; ++j) {
          const currAssign = assignList[j];
          if (currAssign && currAssign.WorkerId) {
            const assignWorker = _.trim(currAssign.WorkerId).toUpperCase();
            if (turkid === assignWorker) {
              assignment = currAssign;
              break;
            }
          }
        }

        if (assignment) {
          break;
        }
      }

      if (assignment) {
        workPerformed.findAssignment = 'Found assignment ' + assignment.AssignmentId;
        workPerformed.assignmentDetails = assignment;
      } else {
        workPerformed.findAssignment = 'No assignment found';
        throw new Error('Can not continue - no assignment');
      }

      const approveResponse = await turk.approveAssignment(ownerProfile, {
                'AssignmentId': assignment.AssignmentId,
                'RequesterFeedback': msg || "Thanks for your participation"
            });
      workPerformed.approveAssignment = 'Assignment was approved!';
      workPerformed.approvalDetails = approveResponse;
    } catch (e) {
      serverConsole('Error processing Turk approval', e);
      errmsg = 'Exception caught while processing Turk approval: ' + JSON.stringify(e, null, 2);
    } finally {
      // Always write an entry
      const userLogEntry = _.extend({
        'action': 'turk-approval',
        'success': errmsg === null,
        'errmsg': errmsg,
        'turkId': turkid,
        'tdfOwnerId': ownerId,
      }, workPerformed);

      serverConsole('About to log entry for Turk', JSON.stringify(userLogEntry, null, 2));
      writeUserLogEntries(experiment, userLogEntry, workerUserId);
    }

    return errmsg;
  },

  turkBonus: async function(workerUserId, experiment) {
    serverConsole('turkBonus', workerUserId, experiment);

    let errmsg = null; // Return null on success

    // Data we log
    const workPerformed = {
      locatePreviousAssignment: 'not performed',
      locateBonusAmount: 'not performed',
      sendBonusRequest: 'not performed',
    };

    let turkid; let ownerId; let tdfid; let unitnum; // Needed for final work

    try {
      const usr = Meteor.user();
      if (!Roles.userIsInRole(usr, ['admin', 'teacher'])) {
        throw new Error('You are not authorized to do that');
      }
      ownerId = usr._id;

      const ownerProfile = Meteor.users.findOne({_id: ownerId});
      if (!ownerProfile) {
        throw new Error('Could not find your user profile');
      }
      if (!ownerProfile.aws || !ownerProfile.aws.have_aws_id || !ownerProfile.aws.have_aws_secret) {
        throw new Error('You are not set up for AWS/MTurk');
      }

      turkid = _.chain(Meteor.users.findOne({'_id': workerUserId}))
          .prop('username').trim()
          .value().toUpperCase();
      if (!turkid) {
        throw new Error('No valid username found');
      }

      if (ownerId != await getTdfOwner(experiment)) {
        throw new Error('You are not the owner of that TDF');
      }

      // Read user log for experiment to find assignment ID
      let assignmentId = null;
      let previousBonus = false;

      tdfid = userLogGetTdfId(workerUserId, experiment);
      if (!tdfid) {
        throw new Error('Could not find the TDF for that user/experiment combination');
      }

      const userLog = UserTimesLog.findOne({userId: workerUserId});
      let userLogEntries = [];
      if (userLog && userLog[experiment] && userLog[experiment].length) {
        userLogEntries = userLog[experiment];
      }

      let i;

      for (i = userLogEntries.length - 1; i >= 0; --i) {
        const rec = userLogEntries[i];
        const action = _.trim(rec.action).toLowerCase();
        if (action === 'turk-approval' && !assignmentId) {
          assignmentId = _.chain(rec)
              .prop('assignmentDetails')
              .prop('AssignmentId').trim()
              .value();
          if (!assignmentId) {
            serverConsole('Bad Assignment found for bonus', rec);
            throw new Error('No previous assignment ID was found for approval, so no bonus can be paid. Examine approval/pay details for more information');
          }
        } else if (action === 'turk-bonus') {
          previousBonus = true;
        }
      }

      if (assignmentId) {
        workPerformed.locatePreviousAssignment = 'Found assignment ' + assignmentId;
        workPerformed.assignmentId = assignmentId;
      } else {
        workPerformed.locatePreviousAssignment = 'No assignment found';
        throw new Error('Previous assignment required');
      }

      if (previousBonus) {
        throw new Error('There was already a bonus paid for this user/TDF combination');
      }

      // We read the TDF to get the bonus amount
      const tdfFile = await getTdfById(tdfid);
      let bonusAmt = null;
      const unitList = tdfFile.tdfs.tutor.unit || [];
      for (i = 0; i < unitList.length; ++i) {
        bonusAmt = _.chain(unitList[i])
            .prop('turkbonus').first().floatval().value();
        if (bonusAmt) {
          unitnum = i;
          break;
        }
      }

      if (bonusAmt) {
        workPerformed.locateBonusAmount = 'Found bonus ' + bonusAmt +
                    ' in tdf[unit]=' + tdfid + '[' + unitnum + ']';
        workPerformed.bonusAmt = bonusAmt;
      } else {
        workPerformed.locateBonusAmount = 'No bonus amount found';
        throw new Error('Bonus amount required');
      }

      // Actually send request - note that we always force USD currently
      const bonusResponse = await turk.grantBonus(ownerProfile, bonusAmt, {
        'WorkerId': turkid,
        'AssignmentId': assignmentId,
        'Reason': 'Additional unit completion. Thank you!',
      });
      workPerformed.sendBonusRequest = 'Bonus request sent';
      workPerformed.bonusResponse = bonusResponse;
    } catch (e) {
      serverConsole('Error processing Turk bonus', e);
      errmsg = 'Exception caught while processing Turk bonus: ' + JSON.stringify(e, null, 2);
    } finally {
      const userLogEntry = _.extend({
        'action': 'turk-bonus',
        'success': errmsg === null,
        'errmsg': errmsg,
        'turkId': turkid,
        'tdfOwnerId': ownerId,
        'selectedTdfId': tdfid,
        'selectedTdfUnitNum': unitnum,
      }, workPerformed);

      serverConsole('About to log entry for Turk ', experiment, JSON.stringify(userLogEntry, null, 2));
      writeUserLogEntries(experiment, userLogEntry, workerUserId);
    }

    return errmsg;
  },

  // Given an experiment name, return the current status of any turk activities
  turkUserLogStatus: async function(experiment) {
    serverConsole('turkUserLogStatus', experiment);

    const expTDF = await getTdfByFileName(experiment);
    const expTDFId = expTDF._id;
    console.log('expTDFId', expTDFId)
    const records = [];
    let tdf = null;

    const experimentUsers = await Meteor.users.find({"profile.loginMode": 'experiment'}).fetch();
    const experimentUserIds = experimentUsers.map(function(user) { return user._id; });
    const experimentUserComponentStates = await ComponentStates.find({userId: {$in: experimentUserIds}, TDFId: expTDFId}).fetch();
    const experimentUserExperimentStates = await GlobalExperimentStates.find({userId: {$in: experimentUserIds}, TDFId: expTDFId}).fetch();
    const userTimesLog = await UserTimesLog.find({}).fetch();

    for(const entry of experimentUserComponentStates) {
      const userRec = experimentUsers.find(function(user) {
        return user._id === entry.userId;
      });
      const userExperimentState = experimentUserExperimentStates.find(function(experimentUserExperimentState) {
        return experimentUserExperimentState.userId === entry.userId;
      });
      const curUserTimesLog = userTimesLog.find(function(userTimeLog) {
        return userTimeLog.userId === entry.userId && userTimeLog[expTDFId];
      });
      if (!userRec || !userRec.username) {
        return;
      }

      const data = {
        userId: userRec._id,
        username: userRec.username,
        turkpay: '?',
        turkpayDetails: 'No Details Found',
        turkbonus: '?',
        turkbonusDetails: 'No Details Found',
        turkEmailSchedule: '?',
        turkEmailScheduleDetails: 'No Details Found',
        turkEmailSend: '?',
        turkEmailSendDetails: 'No Details Found',
        questionsSeen: 0,
        answersSeen: 0,
        answersCorrect: 0,
        lastUnitSeen: userExperimentState.experimentState ? userExperimentState.experimentState.currentUnitNumber : -1,
        maxTimestamp: 0,
      };
      console.log('curUserTimesLog', curUserTimesLog)
      if(curUserTimesLog){
        console.log('curUserTimesLog', curUserTimesLog)
        for(const log of curUserTimesLog[expTDFId]){
          if(!log){
            return;
          }
          if (log.action === 'turk-approval') {
            data.turkpay = log.success ? 'Complete' : 'FAIL';
            data.turkpayDetails = log;
          } else if (log.action === 'turk-bonus') {
            data.turkbonus = log.success ? 'Complete' : 'FAIL';
            data.turkbonusDetails = log;
          } else if (log.action === 'turk-email-schedule') {
            data.turkEmailSchedule = log.success ? 'Complete': 'FAIL';
            data.turkEmailScheduleDetails = log;
          } else if (log.action === 'turk-email-send') {
            data.turkEmailSend = log.success ? 'Complete': 'FAIL';
            data.turkEmailSendDetails = log;
          } else if (tdf !== null && (log.action === 'expcondition' || log.action === 'condition-notify')) {
            // Two things to keep in mind here - this is a one time check,
            // and we'll immediately fail if there is a problem
            tdf = expTDF.content;
            let ownerOK = false;
            if (!!tdf && typeof tdf.owner !== 'undefined') {
              // They must be the owner of the TDF
              ownerOK = (Meteor.user()._id === tdf.owner);
            }
    
            if (!ownerOK) {
              serverConsole('Could not verify owner for', experiment);
              return [];
            }
          }
        }
      }


      for (const stim of entry.stimStates) {
        data.answersCorrect += _.intval(stim.allTimeCorrect);
        data.questionsSeen += (stim.allTimeCorrect + stim.allTimeIncorrect);
        data.answersSeen += (stim.allTimeCorrect + stim.allTimeIncorrect);
        const lastTs = _.intval(stim.firstSeen);
        if (!!lastTs && lastTs > data.maxTimestamp) {
          data.maxTimestamp = lastTs;
        }
      }

      records.push(data);
    }
    return records;
  },
  // DEBUG
  turkTest: async function(ownerProfile, hit) {
    serverConsole('Method hit');
    const assignList = await turk.getAssignmentsForHIT(ownerProfile, hit);
    serverConsole('Got there??');
    serverConsole(assignList);
  },
});
