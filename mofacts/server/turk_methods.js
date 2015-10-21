/* turk_methods.js - Implement the server-side methods called by our clients
**/

// Return the _id of the user record for the "owner" (or teacher) of the given
// experiment name (TDF). This is mainly for knowing how to handle MTurk calls
function getTdfOwner(experiment) {
    var usr = Meteor.user();
    var userId = !!usr ? usr._id : null;
    if (!userId) {
        //No user currently logged in, so we can't figure out the current TDF
        console.log("getTdfOwner for ", experiment, "failed - no current user found");
        return null;
    }

    var userLog = UserTimesLog.findOne({ _id: userId });
    var entries = [];
    if (userLog && userLog[experiment] && userLog[experiment].length) {
        entries = userLog[experiment];
    }
    else {
        console.log("getTdfOwner for ", experiment, "failed - no user log entries found");
        return null;
    }

    //Find last profile TDF selection
    var tdfId = null;
    for (var i = entries.length - 1; i >= 0; --i) {
        var rec = entries[i];
        var action = Helpers.trim(rec.action).toLowerCase();
        if (action === "profile tdf selection" && typeof rec.tdfkey !== "undefined") {
            tdfId = rec.tdfkey;
            break;
        }
    }

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
            return e;
        }
    },

    //Message sending for the end of a lockout
    turkScheduleLockoutMessage: function(experiment, lockoutend, subject, msgbody) {
        try {
            var usr, turkid, ownerId;

            usr = Meteor.user();
            if (!usr || !usr._id) {
                throw Meteor.Error("No current user");
            }

            turkid = !!usr ? usr.username : null;
            if (!turkid) {
                throw Meteor.Error("No valid username found");
            }
            turkid = Helpers.trim(turkid).toUpperCase();

            ownerId = getTdfOwner(experiment);

            var ownerProfile = UserProfileData.findOne({_id: ownerId});
            if (!ownerProfile) {
                throw Meteor.Error("Could not find TDF owner profile for id '" + ownerId + "'");
            }
            if (!ownerProfile.have_aws_id || !ownerProfile.have_aws_secret) {
                throw Meteor.Error("Current TDF owner not set up for AWS/MTurk");
            }

            subject = subject || Helpers.trim("Message from " + turkid + " Profile Page");
            var msgtext = "The lock out period has ended - you may continue.\n\n" + msgbody;
            var jobName = 'Message for ' + experiment + ' to ' + turkid;
            var schedDate = new Date(lockoutend);

            console.log("Scheduling:", jobName, "at", schedDate);
            SyncedCron.add({
                name: jobName,

                schedule: function(parser) {
                    return parser.recur().on(schedDate).fullDate();
                },

                job: function() {
                    console.log("Running scheduled job", jobName);
                    try {
                        var requestParams = {
                            'Subject': subject,
                            'MessageText': msgtext,
                            'WorkerId': turkid
                        };
                        var ret = turk.notifyWorker(ownerProfile, requestParams);
                        console.log("Completed scheduled job", jobName);
                        return _.extend({'passedParams': requestParams}, ret);
                    }
                    catch(e) {
                        console.log("Error finishing", jobname, e);
                        return e;
                    }
                }
            });

            console.log("Scheduled Message scheduled for:", SyncedCron.nextScheduledAtDate(jobName));
            return "Message scheduled";
        }
        catch(e) {
            console.log("Failure scheduling turk message at later date:", e);
            throw Meteor.Error("Message-Failure", e.error, e);
        }
    },

    //Given a currently logged in user, an experiment, and a msg - we
    //attempt to pay the user for the current MTurk HIT/assignment.
    //RETURNS: null on success or an error message on failure. Any results
    //are logged to the user times log
    turkPay: function(experiment, msg) {
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
            turkid = !!usr ? usr.username : null;
            if (!turkid) {
                throw "No valid username found";
            }
            turkid = Helpers.trim(turkid).toUpperCase();

            ownerId = getTdfOwner(experiment);
            var ownerProfile = UserProfileData.findOne({_id: ownerId});
            if (!ownerProfile) {
                throw "Could not find TDF owner profile for id '" + ownerId + "'";
            }
            if (!ownerProfile.have_aws_id || !ownerProfile.have_aws_secret) {
                throw "Current TDF owner not set up for AWS/MTurk";
            }

            //TODO: look for turkminscore and check vs their current score
            //      (which we'll get from userLogCurrentScore). Note that we'll
            //      need a unit number from the client side

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
                        var assignWorker = Helpers.trim(currAssign.WorkerId).toUpperCase();
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
            errmsg = "Exception caught while processing Turk: " + JSON.stringify(e, null, 2);
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
            writeUserLogEntries(experiment, userLogEntry);
        }

        return errmsg;
    },

    turkBonus: function(experiment, tdfid, unitnum) {
        var errmsg = null; // Return null on success

        //Data we log
        var workPerformed = {
            locatePreviousAssignment: 'not performed',
            locateBonusAmount: 'not performed',
            sendBonusRequest: 'not performed'
        };

        var turkid, ownerId; // Needed for final work

        try {
            var usr = Meteor.user();
            turkid = !!usr ? usr.username : null;
            if (!turkid) {
                throw "No valid username found";
            }
            turkid = Helpers.trim(turkid).toUpperCase();
            var workerDbKey = usr._id;

            ownerId = getTdfOwner(experiment);
            var ownerProfile = UserProfileData.findOne({_id: ownerId});
            if (!ownerProfile) {
                throw "Could not find TDF owner profile for id '" + ownerId + "'";
            }
            if (!ownerProfile.have_aws_id || !ownerProfile.have_aws_secret) {
                throw "Current TDF owner not set up for AWS/MTurk";
            }

            //Read user log for experiment to find assignment ID
            var assignmentId = null;
            var previousBonus = false;

            var userLog = UserTimesLog.findOne({ _id: workerDbKey });
            var userLogEntries = [];
            if (userLog && userLog[experiment] && userLog[experiment].length) {
                userLogEntries = userLog[experiment];
            }

            for (var i = userLogEntries.length - 1; i >= 0; --i) {
                var rec = userLogEntries[i];
                var action = Helpers.trim(rec.action).toLowerCase();
                if (action === "turk-approval" && !assignmentId) {
                    if (typeof rec.assignmentDetails !== "undefined" &&
                        typeof rec.assignmentDetails.AssignmentId !== "undefined" &&
                        rec.assignmentDetails.AssignmentId.length)
                    {
                        assignmentId = Helpers.trim(Helpers.firstElement(rec.assignmentDetails.AssignmentId));
                    }
                    else {
                        console.log("Bad Assignment found for bonus", rec);
                        throw "Invalid assignment structure found for approval";
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
            var tdfUnit = null;
            if (typeof tdfFile.tdfs.tutor.unit !== "undefined") {
                if (!!unitnum || unitnum === 0) {
                    tdfUnit = tdfFile.tdfs.tutor.unit[unitnum];
                }
            }

            var bonusAmt = null;
            if (tdfUnit) {
                bonusAmt = Helpers.floatVal(Helpers.firstElement(tdfUnit.turkbonus));
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
            errmsg = "Exception caught while processing Turk: " + Helpers.display(e);
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
            writeUserLogEntries(experiment, userLogEntry);
        }

        return errmsg;
    },

    //Given an experiment name, return the current status of any turk activities
    turkUserLogStatus: function(experiment) {
        var expKey = ('' + experiment).replace(/\./g, "_");
        var records = [];
        var tdfId = null;

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
                turkbonusDetails: 'No Details Found'
            };

            for (var i = 0; i < recs.length; ++i) {
                var rec = recs[i];
                if (!rec || !rec.action) {
                    continue;
                }

                var act = Helpers.trim(rec.action).toLowerCase();
                if (act === "turk-approval") {
                    data.turkpay = rec.success ? 'Complete' : 'FAIL';
                    data.turkpayDetails = rec;
                }
                else if (act === "turk-bonus") {
                    data.turkbonus = rec.success ? 'Complete' : 'FAIL';
                    data.turkbonusDetails = rec;
                }
                else if (tdfId !== null && act === "profile tdf selection" && typeof rec.tdfkey !== "undefined") {
                    //Two things to keep in mind here - this is a one time check,
                    //and we'll immediately fail if there is a problem
                    tdfId = rec.tdfkey;
                    var ownerOK = false;
                    if (!!tdfId) {
                        //They must be the owner of the TDF
                        var tdf = Tdfs.findOne({_id: tdfId});
                        if (!!tdf && typeof tdf.owner !== "undefined") {
                            ownerOK = (Meteor.user()._id === tdf.owner);
                        }
                    }

                    if (!ownerOK) {
                        console.log("Could not verify owner for", experiment);
                        return [];
                    }
                }
            }

            records.push(data);
        });

        return records;
    }
});
