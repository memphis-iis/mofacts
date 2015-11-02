/* turk_methods.js - Implement the server-side methods called by our clients
**/

// Return the _id of the user record for the "owner" (or teacher) of the given
// experiment name (TDF). This is mainly for knowing how to handle MTurk calls
function getTdfOwner(experiment, userId) {
    if (!userId) {
        var usr = Meteor.user();
        userId = !!usr ? usr._id : null;
    }
    if (!userId) {
        //No user currently logged in, so we can't figure out the current TDF
        console.log("getTdfOwner for ", experiment, "failed - no current user found");
        return null;
    }

    //Find the TDF _id from the user log
    var tdfId = userLogGetTdfId(userId, experiment);

    //If no TDF ID then we can't continue
    if (!tdfId) {
        console.log("getTdfOwner for ", experiment, "failed - no tdfId found");
        return null;
    }

    //Now we can get the owner (either set on upload of TDF *OR* set on server
    //startup for TDF's that live in git)
    var tdf = Tdfs.findOne({_id: tdfId});
    if (!!tdf && typeof tdf.owner !== "undefined") {
        return tdf.owner;
    }
    else {
        console.log("getTdfOwner for ", experiment, "failed - TDF doesn't contain owner");
        console.log(tdfId, tdf);
        return null;
    }
}


//Set up our server-side methods
Meteor.methods({
    //Simple assignment debugging for turk
    turkGetAssignment: function(assignid) {
        try {
            var usr = Meteor.user();
            if (!Roles.userIsInRole(usr, ["admin", "teacher"])) {
                throw "You are not authorized to do that";
            }

            var profile = UserProfileData.findOne({_id: usr._id});
            if (!profile) {
                return "Could not find current user profile";
            }
            if (!profile.have_aws_id || !profile.have_aws_secret) {
                return "Current user not set up for AWS/MTurk";
            }

            return turk.getAssignment(profile, {'AssignmentId': assignid});
        }
        catch(e) {
            return e;
        }
    },

    //Simple message sending
    turkSendMessage: function(workerid, msgtext) {
        try {
            var usr = Meteor.user();
            if (!Roles.userIsInRole(usr, ["admin", "teacher"])) {
                throw "You are not authorized to do that";
            }

            var profile = UserProfileData.findOne({_id: usr._id});
            if (!profile) {
                return "Could not find current user profile";
            }
            if (!profile.have_aws_id || !profile.have_aws_secret) {
                return "Current user not set up for AWS/MTurk";
            }

            return turk.notifyWorker(profile, {
                'Subject': "Message from " + usr.username + " Profile Page",
                'MessageText': msgtext,
                'WorkerId': workerid
            });
        }
        catch(e) {
            console.log("Error for turkSendMessage", e);
            return e;
        }
    },

    //Message sending for the end of a lockout
    turkScheduleLockoutMessage: function(experiment, lockoutend, subject, msgbody) {
        var usr, turkid, ownerId, workerUserId;
        var schedDate;
        var jobName;
        var resultMsg = "";
        var errmsg = null;
        var requestParams = null; //Params used to make email send request

        try {
            usr = Meteor.user();
            if (!usr || !usr._id) {
                throw Meteor.Error("No current user");
            }

            workerUserId = usr._id;
            turkid = usr.username;
            if (!turkid) {
                throw Meteor.Error("No valid username found");
            }
            turkid = _.trim(turkid).toUpperCase();

            ownerId = getTdfOwner(experiment);

            var ownerProfile = UserProfileData.findOne({_id: ownerId});
            if (!ownerProfile) {
                throw Meteor.Error("Could not find TDF owner profile for id '" + ownerId + "'");
            }
            if (!ownerProfile.have_aws_id || !ownerProfile.have_aws_secret) {
                throw Meteor.Error("Current TDF owner not set up for AWS/MTurk");
            }

            subject = subject || _.trim("Message from " + turkid + " Profile Page");
            var msgtext = "The lock out period has ended - you may continue.\n\n" + msgbody;
            jobName = 'Message for ' + experiment + ' to ' + turkid;
            schedDate = new Date(lockoutend);

            //Pre-calculate our request parameters for send to that we can
            //copy them to our schedule log entry
            requestParams = {
                'Subject': subject,
                'MessageText': msgtext,
                'WorkerId': turkid
            };

            console.log("Scheduling:", jobName, "at", schedDate);
            SyncedCron.add({
                name: jobName,

                schedule: function(parser) {
                    return parser.recur().on(schedDate).fullDate();
                },

                job: function() {
                    console.log("Running scheduled job", jobName);
                    var senderr = null;
                    var retval = null;

                    try {
                        var ret = turk.notifyWorker(ownerProfile, requestParams);
                        console.log("Completed scheduled job", jobName);
                        retval = _.extend({'passedParams': requestParams}, ret);
                    }
                    catch(e) {
                        console.log("Error finishing", jobname, e);
                        senderr = e;
                    }
                    finally {
                        var sendLogEntry = {
                            'action': 'turk-email-send',
                            'success': senderr === null,
                            'result': retval,
                            'errmsg': senderr,
                            'turkId': turkid,
                            'tdfOwnerId': ownerId,
                            'schedDate': schedDate ? schedDate.toString() : "???"
                        };

                        console.log("About to log entry for Turk", JSON.stringify(sendLogEntry, null, 2));
                        writeUserLogEntries(experiment, sendLogEntry, workerUserId);
                    }

                    if (senderr !== null) {
                        throw senderr;
                    }
                    return retval;
                }
            });

            console.log("Scheduled Message scheduled for:", SyncedCron.nextScheduledAtDate(jobName));
            resultMsg = "Message scheduled";
        }
        catch(e) {
            console.log("Failure scheduling turk message at later date:", e);
            errmsg = {
                'msg': e.error,
                'full': e
            };
        }
        finally {
            //Always write an entry
            var schedLogEntry = {
                'action': 'turk-email-schedule',
                'success': errmsg === null,
                'result': resultMsg,
                'errmsg': errmsg,
                'turkId': turkid,
                'tdfOwnerId': ownerId,
                'schedDate': schedDate ? schedDate.toString() : "???",

                //The following three properties are for recreating the sched
                //call (although you'll need to create a Date from schedDateRaw
                //and retrieve the owner profile with tdfOwnerId)
                'schedDateRaw': schedDate ? schedDate.getTime() : 0,
                'jobname': jobName,
                'requestParams': requestParams
            };

            console.log("About to log email sched entry for Turk", JSON.stringify(schedLogEntry, null, 2));
            writeUserLogEntries(experiment, schedLogEntry, workerUserId);
        }

        if (errmsg !== null) {
            throw Meteor.Error("Message-Failure", errmsg.msg, errmsg.full);
        }

        return resultMsg;
    },

    //Assuming the current user is an admin or teacher, and given a user ID, an
    //experiment, and a msg - we attempt to pay the user for the current MTurk
    //HIT/assignment.
    //RETURNS: null on success or an error message on failure. Any results
    //are logged to the user times log
    turkPay: function(workerUserId, experiment, msg) {
        var errmsg = null; //Return null on success

        //Data we log
        var workPerformed = {
            findHITs: 'not performed',
            findAssignment: 'not performed',
            approveAssignment: 'not performed'
        };

        var ownerId, turkid; // Needed for final work

        try {
            var usr = Meteor.user();
            if (!Roles.userIsInRole(usr, ["admin", "teacher"])) {
                throw "You are not authorized to do that";
            }
            ownerId = usr._id;

            var ownerProfile = UserProfileData.findOne({_id: ownerId});
            if (!ownerProfile) {
                throw "Could not find your user profile";
            }
            if (!ownerProfile.have_aws_id || !ownerProfile.have_aws_secret) {
                throw "You are not set up for AWS/MTurk";
            }

            turkid =  _.chain(Meteor.users.findOne({'_id': workerUserId}))
                .prop('username').trim()
                .value().toUpperCase();
            if (!turkid) {
                throw "No valid username found";
            }

            if (ownerId != getTdfOwner(experiment, workerUserId)) {
                throw "You are not the owner of that TDF";
            }

            //If we have a minimum score, check vs their current score
            var tdfId = userLogGetTdfId(workerUserId, experiment);
            var tdf = Tdfs.findOne({_id: tdfId});

            // Get available HITs
            hitlist = turk.getAvailableHITs(ownerProfile, {});
            if (hitlist && hitlist.length) {
                workPerformed.findHITs = "HITs found: " + hitlist.length;
                workPerformed.hitdetails = hitlist;
            }
            else {
                workPerformed.findHITs = "No HITs found";
                hitlist = [];
                throw "No HITs - can not continue";
            }

            //Look for assignments for HITs that can be reviewed
            var assignment = null;
            for(var i = 0; i < hitlist.length; ++i) {
                hit = hitlist[i];
                var assignList = turk.getAssignmentsForHIT(ownerProfile, {
                    'HITId': hit
                });
                if (!assignList)
                    assignList = [];

                for (var j = 0; j < assignList.length; ++j) {
                    var currAssign = assignList[j];
                    if (currAssign && currAssign.WorkerId) {
                        var assignWorker = _.trim(currAssign.WorkerId).toUpperCase();
                        if (turkid === assignWorker) {
                            assignment = currAssign;
                            break;
                        }
                    }
                }

                if (!!assignment)
                    break;
            }

            if (!!assignment) {
                workPerformed.findAssignment = "Found assignment " + assignment.AssignmentId;
                workPerformed.assignmentDetails = assignment;
            }
            else {
                workPerformed.findAssignment = "No assignment found";
                throw "Can not continue - no assignment";
            }

            var approveResponse = turk.approveAssignment(ownerProfile, {
                'AssignmentId': assignment.AssignmentId,
                'RequesterFeedback': msg || "Thanks for your participation"
            });
            workPerformed.approveAssignment = "Assignment was approved!";
            workPerformed.approvalDetails = approveResponse;
        }
        catch(e) {
            console.log("Error processing Turk approval", e);
            errmsg = "Exception caught while processing Turk approval: " + JSON.stringify(e, null, 2);
        }
        finally {
            //Always write an entry
            var userLogEntry = _.extend({
                'action': 'turk-approval',
                'success': errmsg === null,
                'errmsg': errmsg,
                'turkId': turkid,
                'tdfOwnerId': ownerId
            }, workPerformed);

            console.log("About to log entry for Turk", JSON.stringify(userLogEntry, null, 2));
            writeUserLogEntries(experiment, userLogEntry, workerUserId);
        }

        return errmsg;
    },

    turkBonus: function(workerUserId, experiment) {
        var errmsg = null; // Return null on success

        //Data we log
        var workPerformed = {
            locatePreviousAssignment: 'not performed',
            locateBonusAmount: 'not performed',
            sendBonusRequest: 'not performed'
        };

        var turkid, ownerId, tdfid, unitnum; // Needed for final work

        try {
            var usr = Meteor.user();
            if (!Roles.userIsInRole(usr, ["admin", "teacher"])) {
                throw "You are not authorized to do that";
            }
            ownerId = usr._id;

            var ownerProfile = UserProfileData.findOne({_id: ownerId});
            if (!ownerProfile) {
                throw "Could not find your user profile";
            }
            if (!ownerProfile.have_aws_id || !ownerProfile.have_aws_secret) {
                throw "You are not set up for AWS/MTurk";
            }

            turkid =  _.chain(Meteor.users.findOne({'_id': workerUserId}))
                .prop('username').trim()
                .value().toUpperCase();
            if (!turkid) {
                throw "No valid username found";
            }

            if (ownerId != getTdfOwner(experiment, workerUserId)) {
                throw "You are not the owner of that TDF";
            }

            //Read user log for experiment to find assignment ID
            var assignmentId = null;
            var previousBonus = false;

            tdfid = userLogGetTdfId(workerUserId, experiment);
            if (!tdfid) {
                throw "Could not find the TDF for that user/experiment combination";
            }

            var userLog = UserTimesLog.findOne({ _id: workerUserId });
            var userLogEntries = [];
            if (userLog && userLog[experiment] && userLog[experiment].length) {
                userLogEntries = userLog[experiment];
            }

            var i;

            for (i = userLogEntries.length - 1; i >= 0; --i) {
                var rec = userLogEntries[i];
                var action = _.trim(rec.action).toLowerCase();
                if (action === "turk-approval" && !assignmentId) {
                    assignmentId = _.chain(rec)
                        .prop("assignmentDetails")
                        .prop("AssignmentId").trim()
                        .value();
                    if (!assignmentId) {
                        console.log("Bad Assignment found for bonus", rec);
                        throw "No previous assignment ID was found for approval, so no bonus can be paid. Examine approval/pay details for more information";
                    }
                }
                else if (action === "turk-bonus") {
                    previousBonus = true;
                }
            }

            if (assignmentId) {
                workPerformed.locatePreviousAssignment = "Found assignment " + assignmentId;
                workPerformed.assignmentId = assignmentId;
            }
            else {
                workPerformed.locatePreviousAssignment = "No assignment found";
                throw "Previous assignment required";
            }

            if (previousBonus) {
                throw "There was already a bonus paid for this user/TDF combination";
            }

            //We read the TDF to get the bonus amount
            var tdfFile = Tdfs.findOne({_id: tdfid});
            var bonusAmt = null;
            var unitList = tdfFile.tdfs.tutor.unit || [];
            for(i = 0; i < unitList.length; ++i) {
                bonusAmt = _.chain(unitList[i])
                    .prop("turkbonus").first().floatval().value();
                if (bonusAmt) {
                    unitnum = i;
                    break;
                }
            }

            if (bonusAmt) {
                workPerformed.locateBonusAmount = "Found bonus " + bonusAmt +
                    " in tdf[unit]=" + tdfid + "[" + unitnum + "]";
                workPerformed.bonusAmt = bonusAmt;
            }
            else {
                workPerformed.locateBonusAmount = "No bonus amount found";
                throw "Bonus amount required";
            }

            //Actually send request - note that we always force USD currently
            var bonusResponse = turk.grantBonus(ownerProfile, bonusAmt, {
                'WorkerId': turkid,
                'AssignmentId': assignmentId,
                'Reason': 'Additional unit completion. Thank you!'
            });
            workPerformed.sendBonusRequest = "Bonus request sent";
            workPerformed.bonusResponse = bonusResponse;
        }
        catch(e) {
            console.log("Error processing Turk bonus", e);
            errmsg = "Exception caught while processing Turk bonus: " + JSON.stringify(e, null, 2);
        }
        finally {
            var userLogEntry = _.extend({
                'action': 'turk-bonus',
                'success': errmsg === null,
                'errmsg': errmsg,
                'turkId': turkid,
                'tdfOwnerId': ownerId,
                'selectedTdfId': tdfid,
                'selectedTdfUnitNum': unitnum
            }, workPerformed);

            console.log("About to log entry for Turk ", experiment, JSON.stringify(userLogEntry, null, 2));
            writeUserLogEntries(experiment, userLogEntry, workerUserId);
        }

        return errmsg;
    },

    //Given an experiment name, return the current status of any turk activities
    turkUserLogStatus: function(experiment) {
        var expKey = ('' + experiment).replace(/\./g, "_");
        var records = [];
        var tdf = null;

        UserTimesLog.find({}).forEach(function (entry) {
            if (!(expKey in entry)) {
                return;
            }

            var recs = entry[expKey];
            if (!recs || !recs.length) {
                return;
            }

            var userRec = Meteor.users.findOne({_id: entry._id});
            if (!userRec || !userRec.username) {
                return;
            }

            var data = {
                userid: entry._id,
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
                lastUnitSeen: -1,
                maxTimestamp: 0
            };

            for (var i = 0; i < recs.length; ++i) {
                var rec = recs[i];
                if (!rec || !rec.action) {
                    continue;
                }

                var lastTs = _.intval(rec.clientSideTimeStamp);
                if (!!lastTs && lastTs > data.maxTimestamp) {
                    data.maxTimestamp = lastTs;
                }

                var act = _.trim(rec.action).toLowerCase();
                if (act === "turk-approval") {
                    data.turkpay = rec.success ? 'Complete' : 'FAIL';
                    data.turkpayDetails = rec;
                }
                else if (act === "turk-bonus") {
                    data.turkbonus = rec.success ? 'Complete' : 'FAIL';
                    data.turkbonusDetails = rec;
                }
                else if (act === "turk-email-schedule") {
                    data.turkEmailSchedule = rec.success ? 'Complete': 'FAIL';
                    data.turkEmailScheduleDetails = rec;
                }
                else if (act === "turk-email-send") {
                    data.turkEmailSend = rec.success ? 'Complete': 'FAIL';
                    data.turkEmailSendDetails = rec;
                }
                else if (tdf !== null && (act === "expcondition" || act === "condition-notify")) {
                    //Two things to keep in mind here - this is a one time check,
                    //and we'll immediately fail if there is a problem
                    tdf = Tdfs.findOne({'fileName': rec.currentTdfName});
                    var ownerOK = false;
                    if (!!tdf && typeof tdf.owner !== "undefined") {
                        //They must be the owner of the TDF
                        ownerOK = (Meteor.user()._id === tdf.owner);
                    }

                    if (!ownerOK) {
                        console.log("Could not verify owner for", experiment);
                        return [];
                    }
                }
                else if (act === "question") {
                    if (!!rec.selType) {
                        data.questionsSeen += 1;
                        data.lastUnitSeen = Math.max(data.lastUnitSeen, _.intval(rec.currentUnit));
                    }
                }
                else if (act === "answer" || act === "[timeout]") {
                    data.answersSeen += 1;

                    var wasCorrect = false;
                    if (act === "answer") {
                        wasCorrect = typeof rec.isCorrect !== "undefined" ? rec.isCorrect : false;
                    }
                    if (wasCorrect) {
                        data.answersCorrect += 1;
                    }
                }
            }

            records.push(data);
        });

        return records;
    }
});
