/*jshint sub:true*/

//The jshint inline option above suppresses a warning about using sqaure
//brackets instead of dot notation - that's because we prefer square brackets
//for creating some MongoDB queries

var Future = Npm.require("fibers/future");
var fs = Npm.require("fs");
var endOfLine = Npm.require("os").EOL;

// On startup, this will be set to the first user in private/roles/admins.json
// AFTER the list is sorted.
var adminUserId = null;

//Helper functions

function parseXML(xml) {
    var json = {};
    xml2js.parseString(xml, function (err, result) {
        json = result;
    });
    return json;
}

function getStimJSON(fileName) {
    var future = new Future();
    Assets.getText(fileName, function (err, data) {
        if (err)
            throw err;
        var json = parseXML(data);
        future.return(json);
    });
    return future.wait();
}

function getPresetUsersInRole(fileName) {
    var future = new Future();
    Assets.getText(fileName, function (err, data) {
        if (err)
            throw err;
        if (!data) {
            data = "[]"; //Always return at least an empty
        }
        var roles = JSON.parse(data);
        if (!!roles && roles.sort) {
            roles.sort();
        }
        future.return(roles);
    });
    return future.wait();
}

function defaultUserProfile() {
    return {
        have_aws_id: false,
        have_aws_secret: false,
        aws_id: '',
        aws_secret_key: '',
        use_sandbox: true
    };
}

function writeUserLogEntries(experiment, objectsToLog) {
    var objType = typeof objectsToLog;
    var valsToPush = [];

    if (typeof objectsToLog === "undefined") {
        //Nothing passed to us: use an empty object, which will
        //contain only the current time
        valsToPush.push({});
    }
    else if (typeof objectsToLog.length === "undefined") {
        //Not an array - they passed a single object
        valsToPush.push(objectsToLog);
    }
    else {
        //Grab the entire array
        for (i = 0; i < objectsToLog.length; i++) {
            valsToPush.push(objectsToLog[i]);
        }
    }

    //Every object we log gets a server side time stamp
    for (i = 0; i < valsToPush.length; i++) {
        valsToPush[i]["serverSideTimeStamp"] = Date.now();
    }

    //Create action object: should look like:
    // { $push: { <experiment_key>: { $each: <objectsToLog in array> } } }
    var action = {$push: {}};
    var experiment_key = (experiment + "").replace(/\./g, "_");
    var allVals = {$each: valsToPush};
    action["$push"][experiment_key] = allVals;

    UserTimesLog.update(
        {_id: Meteor.userId()},
        action,
        {upsert: true}
    );
}

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


//Published to all clients (even without subscription calls)
Meteor.publish(null, function () {
    //Only valid way to get the user ID for publications
    var userId = this.userId;

    //The default data published to everyone - all TDF's and stims, and the
    //user data (user times log and user record) for them
    var defaultData = [
        Stimuli.find({}),
        Tdfs.find({}),
        UserTimesLog.find({_id: userId}),
        Meteor.users.find({_id: userId}),
        UserProfileData.find({_id: userId}, {fields: {
            have_aws_id: 1,
            have_aws_secret: 1,
            use_sandbox: 1
        }})
    ];

    return defaultData;
});

//Server-side startup logic

Meteor.startup(function () {
    // Get user in roles
    var admins = getPresetUsersInRole("roles/admins.json");
    var teachers = getPresetUsersInRole("roles/teachers.json");

    var adminUserName = "";
    if (admins && admins.length) {
        adminUserName = admins[0];
    }

    _.each(Meteor.users.find().fetch(), function (ele) {
        var uname = "" + ele["username"];
        if (!!uname) {
            if (uname == adminUserName) {
                adminUserId = ele._id;
            }
            if (_.indexOf(admins, uname, true) >= 0) {
                Roles.addUsersToRoles(ele._id, "admin");
                console.log(uname + " is in admin role");
            }
            if (_.indexOf(teachers, uname, true) >= 0) {
                Roles.addUsersToRoles(ele._id, "teacher");
                console.log(uname + " is in teacher role");
            }
        }
    });

    //Rewrite TDF and Stimuli documents if we have a file
    //IMPORTANT: this will change the records' _id fields!!
    var isXML = function (fn) {
        return fn.indexOf('.xml') >= 0;
    };

    _.each(
        _.filter(fs.readdirSync('./assets/app/stims/'), isXML),
        function (ele, idx, lst) {
            console.log("Updating Stim in DB from ", ele);
            var json = getStimJSON('stims/' + ele);
            Stimuli.remove({fileName: ele});
            Stimuli.insert({fileName: ele, stimuli: json, owner: adminUserId});
        }
    );

    _.each(
        _.filter(fs.readdirSync('./assets/app/tdf/'), isXML),
        function (ele, idx, lst) {
            console.log("Updating TDF in DB from ", ele);
            var json = getStimJSON('tdf/' + ele);
            Tdfs.remove({fileName: ele});
            Tdfs.insert({fileName: ele, tdfs: json, owner: adminUserId});
        }
    );

    //Log this late so they're more prone to see it
    if (adminUserId) {
        console.log("Admin user is", adminUserName, adminUserId);
    }
    else {
        console.log("ADMIN USER is MISSING: a restart might be required");
        console.log("(Was looking for admin user " + adminUserName + ")");
        console.log("***IMPORTANT*** There will be no owner for system TDF's");
    }

    //Set up our server-side methods
    Meteor.methods({
        //Functionality to create a new user ID: return null on success. Return
        //an array of error messages on failure. If previous OK is true, then
        //we silently skip duplicate users (this is mainly for experimental
        //participants who are created on the fly)
        signUpUser: function (newUserName, newUserPassword, previousOK) {
            var checks = [];

            if (!newUserName) {
                checks.push("Blank user names aren't allowed");
            }
            else if (typeof Meteor.users.findOne({username: newUserName}) !== "undefined") {
                if (previousOK) {
                    return null; //User has already been created - nothing to do
                }
                checks.push("User is already in use");
            }

            if (!newUserPassword || newUserPassword.length < 6) {
                checks.push("Passwords must be at least 6 characters long");
            }

            if (checks.length > 0) {
                return checks; //Nothing to create
            }

            //Now we can actually create the user
            //Note that on the server we just get back the ID and have nothing
            //to do right now
            var createdId = Accounts.createUser({username: newUserName, password: newUserPassword});
            if (!createdId) {
                return ["Unknown failure creating user account"];
            }

            //Now we need to create a default user profile record
            UserProfileData.upsert({_id: createdId}, defaultUserProfile());

            //Remeber we return a LIST of errors, so this is success
            return null;
        },

        //We provide a separate server method for user profile info - this is
        //mainly since we don't want some of this data just flowing around
        //between client and server
        saveUserProfileData: function(profileData) {
            var data = _.extend(defaultUserProfile(), profileData);
            data.have_aws_id = data.aws_id.length > 0;
            data.have_aws_secret = data.aws_secret_key.length > 0;

            data.aws_id = encryptUserData(data.aws_id);
            data.aws_secret_key = encryptUserData(data.aws_secret_key);

            return UserProfileData.upsert({_id: Meteor.userId()}, data);
        },

        //Log one or more user records for the currently running experiment
        userTime: function (experiment, objectsToLog) {
            writeUserLogEntries(experiment, objectsToLog);
        },

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

        //Given a currently logged in user, an experiment, and a msg - we
        //attempt to pay the user for the current MTurk HIT/assignment.
        //RETURNS: null on success or an error message on failure. Any results
        //are logged to the user times log
        turkPay: function(experiment, msg) {
            var usr = Meteor.user();
            var turkid = !!usr ? usr.username : null;
            if (!turkid) {
                return "No valid username found";
            }
            turkid = Helpers.trim(turkid).toUpperCase();

            var ownerId = getTdfOwner(experiment);
            var ownerProfile = UserProfileData.findOne({_id: ownerId});
            if (!ownerProfile) {
                return "Could not find TDF owner profile for id ''" + ownerId + "'";
            }
            if (!ownerProfile.have_aws_id || !ownerProfile.have_aws_secret) {
                return "Current TDF owner not set up for AWS/MTurk";
            }

            var errmsg = null; // Return null on success

            //Data we log
            var workPerformed = {
                findHITs: 'not performed',
                findAssignment: 'not performed',
                approveAssignment: 'not performed'
            };

            try {
                // Get available HITs
                hitlist = turk.getAvailableHITs(ownerProfile, {});
                if (hitlist && hitlist.length) {
                    workPerformed.findHITs = "HITs found: " + hitlist.length;
                    workPerformed.hitdetails = hitlist;
                }
                else {
                    workPerformed.findHITs = "No HITs found";
                    hitlist = [];
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
                }

                if (!!assignment) {
                    var approveResponse = turk.approveAssignment(ownerProfile, {
                        'AssignmentId': assignment.AssignmentId,
                        'RequesterFeedback': msg || "Thanks for your participation"
                    });
                    workPerformed.approveAssignment = "Assignment was approved!";
                    workPerformed.approvalDetails = approveResponse;
                }
            }
            catch(e) {
                errmsg = "Exception caught while processing Turk: " + JSON.stringify(e, null, 2);
            }
            finally {
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
            var usr = Meteor.user();
            var turkid = !!usr ? usr.username : null;
            if (!turkid) {
                return "No valid username found";
            }
            turkid = Helpers.trim(turkid).toUpperCase();

            var ownerId = getTdfOwner(experiment);
            var ownerProfile = UserProfileData.findOne({_id: ownerId});
            if (!ownerProfile) {
                return "Could not find TDF owner profile for id ''" + ownerId + "'";
            }
            if (!ownerProfile.have_aws_id || !ownerProfile.have_aws_secret) {
                return "Current TDF owner not set up for AWS/MTurk";
            }

            var errmsg = null; // Return null on success

            //Data we log
            var workPerformed = {
                locatePreviousAssignment: 'not performed',
                locateBonusAmount: 'not performed',
                sendBonusRequest: 'not performed'
            };

            try {
                //TODO: read user log for experiment to find assignment ID
                var assignmentId = null;

                if (assignmentId) {
                    workPerformed.locatePreviousAssignment = "Found assignment " + assignmentId;
                    workPerformed.assignmentId = assignmentId;
                }
                else {
                    workPerformed.locatePreviousAssignment = "No assignment found";
                    throw "Previous assignment required";
                }

                //TODO: read tdfid to find turkbonus in unitnum
                //TODO: when reading log, check for previous bonus payment
                var bonusAmt = null;

                if (bonusAmt) {
                    workPerformed.locateBonusAmount = "";
                    workPerformed.bonusAmt = bonusAmt;
                }
                else {
                    workPerformed.locateBonusAmount = "No bonus amount found";
                    throw "Bonus amount required";
                }

                var bonusResponse = turk.grantBonus(ownerProfile, bonusAmt, {
                    'WorkerId': turkid,
                    'AssignmentId': assignmentId,
                    'Reason': 'Additional unit completion. Thank you!'
                });
                workPerformed.sendBonusRequest = "Bonus request sent";
                workPerformed.bonusResponse = bonusResponse;
            }
            catch(e) {
                errmsg = "Exception caught while processing Turk: " + JSON.stringify(e, null, 2);
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

                console.log("About to log entry for Turk", JSON.stringify(userLogEntry, null, 2));
                writeUserLogEntries(experiment, userLogEntry);
            }

            return errmsg;
        },

        //Let client code send console output up to server
        debugLog: function (logtxt) {
            var usr = Meteor.user();
            if (!usr) {
                usr = "[No Current User]";
            }
            else {
                usr = !!usr.username ? usr.username : usr._id;
                usr = "[USER:" + usr + "]";
            }

            console.log(usr + " " + logtxt);
        },
    });
});

//We use a special server-side route for our experimental data download
Router.route("experiment-data", {
    where: "server",
    path: "/experiment-data/:expKey/:format",
    action: function () {
        var exp = this.params.expKey;
        var fmt = this.params.format;

        if (!exp) {
            this.response.writeHead(404);
            this.response.end("No experiment specified");
            return;
        }

        var suffix = '';
        if (fmt === 'basic') {
            suffix = 'tsv';
        } else {
            suffix = 'txt';
        }

        console.log("Sending all experimental data for", exp);

        this.response.writeHead(200, {
            "Content-Type": "text/tab-separated-values",
            "Content-Disposition": "attachment; filename=" + fmt + exp + "-data."+suffix
        });

        this.response.end(createExperimentExport(exp, fmt).join('\r\n'));
    }
});
