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

function getStimJSON(fileName) {
    var future = new Future();
    Assets.getText(fileName, function (err, data) {
        if (err)
            throw err;
        future.return(xml2js.parseStringSync(data));
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

function userProfileSave(id, profile) {
    try {
        //Insure record matching ID is present while working around MongoDB 2.4 bug
        UserProfileData.update({_id: id}, {'$set': {'preUpdate': true}}, {upsert: true});
    }
    catch(e) {
        console.log("Ignoring user profile upsert ", e);
    }
    var numUpdated = UserProfileData.update({_id: id}, profile);
    if (numUpdated == 1) {
        return "Save succeeed";
    }

    // WHOOOPS! If we're still here something has gone horribly wrong
    if (numUpdate < 1) {
        throw new Meteor.Error("user-profile-save", "No records updated by save");
    }
    else {
        throw new Meteor.Error("user-profile-save", "More than one record updated?! " + Helpers.display(numUpdate));
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

//Config for scheduled jobs - the start command is at the end of
//Meteor.startup below
SyncedCron.config({
    log: true,
    logger: null,
    collectionName: 'cronHistory',
    utc: false,
    collectionTTL: undefined
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

    //You'll note our lack of upsert in the loops below - we don't want _id to
    //change under MongoDB 2.4 (later versions of Mongo don't have the bug)

    _.each(
        _.filter(fs.readdirSync('./assets/app/stims/'), isXML),
        function (ele, idx, lst) {
            console.log("Updating Stim in DB from ", ele);
            var json = getStimJSON('stims/' + ele);
            var rec = {fileName: ele, stimuli: json, owner: adminUserId};
            var prev = Stimuli.findOne({fileName: ele});

            if (prev) {
                Stimuli.update({ _id: prev._id }, rec);
            }
            else {
                Stimuli.insert(rec);
            }
        }
    );

    _.each(
        _.filter(fs.readdirSync('./assets/app/tdf/'), isXML),
        function (ele, idx, lst) {
            console.log("Updating TDF in DB from ", ele);
            var json = getStimJSON('tdf/' + ele);

            var rec = {fileName: ele, tdfs: json, owner: adminUserId};
            var prev = Tdfs.findOne({fileName: ele});

            if (prev) {
                Tdfs.update({ _id: prev._id }, rec);
            }
            else {
                Tdfs.insert(rec);
            }
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
            userProfileSave(createdId, defaultUserProfile());

            //Remeber we return a LIST of errors, so this is success
            return null;
        },

        //We provide a separate server method for user profile info - this is
        //mainly since we don't want some of this data just flowing around
        //between client and server
        saveUserProfileData: function(profileData) {
            var saveResult, acctBal, result, errmsg;
            try {
                data = _.extend(defaultUserProfile(), profileData);

                //Check length BEFORE any kind of encryption
                data.have_aws_id = data.aws_id.length > 0;
                data.have_aws_secret = data.aws_secret_key.length > 0;

                data.aws_id = encryptUserData(data.aws_id);
                data.aws_secret_key = encryptUserData(data.aws_secret_key);

                saveResult = userProfileSave(Meteor.userId(), data);

                //We test by reading the profile back and checking their
                //account balance
                acctBal = turk.getAccountBalance(
                    UserProfileData.findOne({_id: Meteor.user()._id})
                );
                if (!acctBal) {
                    throw "There was an error reading your account balance";
                }

                result = true;
                errmsg = "";
            }
            catch(e) {
                result = false;
                errmsg = e;
            }

            return {
                'result': result,
                'saveResult': saveResult,
                'acctBal': acctBal,
                'error': errmsg
            };
        },

        //Allow file uploaded with name and contents. The type of file must be
        //specified - current allowed types are: 'stimuli', 'tdf'
        saveContentFile: function(type, filename, filecontents) {
            var result = null;
            var errmsg = "No action taken?";

            //TODO: filename gets special prefix denoting file upload
            //TODO: Should overwrite IFF owner matches

            try {
                //We need a valid use that is either admin or teacher
                var ownerId = Meteor.user()._id;
                if (!ownerId) {
                    throw "No user logged in - no file upload allowed";
                }

                if (!Roles.userIsInRole(Meteor.user(), ["admin", "teacher"])) {
                    throw "You are not authorized to upload files";
                }

                //We prefix upload files with upload and the user _id so that
                //they are separate from the preload files in git and other
                //users' files
                filename = "upload:" + ownerId + ":" + filename;

                if (type == "tdf") {
                    //TODO: save the TDF file
                }
                else if (type === "stim") {
                    //TODO: save the stimulus file
                }
                else {
                    throw "Unknown file type not allowed: " + type;
                }

                result = true;
                errmsg = "";
            }
            catch(e) {
                result = false;
                errmsg = e;
            }

            return {
                'result': result,
                'error': errmsg
            };
        },

        //Log one or more user records for the currently running experiment
        userTime: function (experiment, objectsToLog) {
            writeUserLogEntries(experiment, objectsToLog);
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

    //Start up synched cron background jobs
    SyncedCron.start();
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
