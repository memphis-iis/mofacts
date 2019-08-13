/*jshint sub:true*/

//The jshint inline option above suppresses a warning about using sqaure
//brackets instead of dot notation - that's because we prefer square brackets
//for creating some MongoDB queries


var Future = Npm.require("fibers/future");
var fs = Npm.require("fs");
var endOfLine = Npm.require("os").EOL;

// Open file stream for active user log
var activeUserLogStream = fs.createWriteStream("activeUserLog.csv", {flags: 'a'});

//Helper functions

serverConsole = function() {
    var disp = [(new Date()).toString()];
    for (var i = 0; i < arguments.length; ++i) {
        disp.push(arguments[i]);
    }
    console.log.apply(this, disp);
};

function getStimJSON(fileName) {
    var future = new Future();
    Assets.getText(fileName, function (err, data) {
        if (err) {
            serverConsole("Error reading Stim JSON", err);
            throw err;
        }
        future.return(xml2js.parseStringSync(data));
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

// Append a row to CSV file that serves as a log of online users
function logNumOnlineUsers() {
  var now = (new Date()).toString();
  var numUsers = Meteor.call('numOnlineUsers');
  var rowToWrite = now + ',' + numUsers + '\n';
  activeUserLogStream.write(rowToWrite);
  serverConsole('Logged ' + numUsers + ' active users.');
}

// Save the given user profile via "upsert" logic
function userProfileSave(id, profile) {
    try {
        //Insure record matching ID is present while working around MongoDB 2.4 bug
        UserProfileData.update({_id: id}, {'$set': {'preUpdate': true}}, {upsert: true});
    }
    catch(e) {
        serverConsole("Ignoring user profile upsert ", e);
    }
    var numUpdated = UserProfileData.update({_id: id}, profile);
    if (numUpdated == 1) {
        return "Save succeeed";
    }

    // WHOOOPS! If we're still here something has gone horribly wrong
    if (numUpdated < 1) {
        throw new Meteor.Error("user-profile-save", "No records updated by save");
    }
    else {
        throw new Meteor.Error("user-profile-save", "More than one record updated?! " + _.display(numUpdate));
    }
}

// Return the user object matching the user. We use Meteor's provided search
// function to attempt to locate the user. We will attempt to find the user
// by username *and* by email.
function findUserByName(username) {
    if (!username || _.prop(username, "length") < 1) {
        return null;
    }

    var funcs = [Accounts.findUserByUsername, Accounts.findUserByEmail];

    for (var i = 0; i < funcs.length; ++i) {
        var user = funcs[i](username);
        if (!!user) {
            return user;
        }
    }

    return null;
}

// Create a formatted TDF record given the specified parameters
function createTdfRecord(fileName, tdfJson, ownerId, source) {
    return {
        'fileName': fileName,
        'tdfs': tdfJson,
        'owner': ownerId,
        'source': source
    };
}

// Create a formatted Stim record given the specified parameters
function createStimRecord(fileName, stimJson, ownerId, source) {
    return {
        'fileName': fileName,
        'stimuli': stimJson,
        'owner': ownerId,
        'source': source
    };
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
        }}),
        UserMetrics.find({})
    ];

    return defaultData;
});

Meteor.publish('userMetrics', function(){
  return UserMetrics.find({});
})

Meteor.publish('tdfs', function(){
  return Tdfs.find({});
})

Meteor.publish('classes',function(){
  return Classes.find({instructor:this.userId});
});

Meteor.publish('allUsers', function () {
    var opts = {
        fields: {username: 1}
    };
    if (Roles.userIsInRole(this.userId, ["admin"])) {
        opts.fields.roles = 1;
    }
	return Meteor.users.find({}, opts);
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


    // Let anyone looking know what config is in effect
    serverConsole("Log Notice (from siteConfig):", getConfigProperty("logNotice"));

    // Force our OAuth settings to be current
    ServiceConfiguration.configurations.remove({"service": "google"});
    serverConsole("Removed Google service config - rewriting now");

    var google = getConfigProperty("google");
    ServiceConfiguration.configurations.insert({
        "service": "google",
        "clientId": _.prop(google, "clientId"),
        "secret": _.prop(google, "secret"),
    });
    serverConsole("Rewrote Google service config");

    // Figure out the "prime admin" (owner of repo TDF/stim files)
    // Note that we accept username or email and then find the ID
    var adminUser = findUserByName(getConfigProperty("owner"));

    // Used below for ownership
    var adminUserId = _.prop(adminUser, "_id") || "";
    // adminUser should be in an admin role
    if (adminUserId) {
        Roles.addUsersToRoles(adminUserId, "admin");
        serverConsole("Admin User Found ID:", adminUserId, "with obj:", _.pick(adminUser, "_id", "username", "email"));
    }
    else {
        serverConsole("Admin user ID could not be found. adminUser=", displayify(adminUser || "null"));
    }

    // Get user in roles and make sure they are added
    var roles = getConfigProperty("initRoles");
    var roleAdd = function(memberName, roleName) {
        var requested = _.prop(roles, memberName) || [];
        serverConsole("Role", roleName, "- found", _.prop(requested, "length"));

        _.each(requested, function(username) {
            var user = findUserByName(username);
            if (!user) {
                serverConsole("Warning: user", username, "role", roleName, "request, but user not found");
                return;
            }
            Roles.addUsersToRoles(user._id, roleName);
            serverConsole("Added user", username, "to role", roleName);
        });
    };

    roleAdd("admins", "admin");
    roleAdd("teachers", "teacher");

    //Rewrite TDF and Stimuli documents if we have a file
    //You'll note our lack of upsert in the loops below - we don't want _id to
    //change under MongoDB 2.4 (later versions of Mongo don't have the bug)

    var isXML = function (fn) {
        return fn.indexOf('.xml') >= 0;
    };
    _.each(
        _.filter(fs.readdirSync('./assets/app/stims/'), isXML),
        function (ele, idx, lst) {
            serverConsole("Updating Stim in DB from ", ele);
            var json = getStimJSON('stims/' + ele);
            var rec = createStimRecord(ele, json, adminUserId, 'repo');

            var prev = Stimuli.findOne({'fileName': ele});
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
            serverConsole("Updating TDF in DB from ", ele);
            var json = getStimJSON('tdf/' + ele);

            var rec = createTdfRecord(ele, json, adminUserId, 'repo');
            var prev = Tdfs.findOne({'fileName': ele});

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
        serverConsole("Admin user is", _.pick(adminUser, "_id", "username", "email"));
    }
    else {
        serverConsole("ADMIN USER is MISSING: a restart might be required");
        serverConsole("Make sure you have a valid siteConfig");
        serverConsole("***IMPORTANT*** There will be no owner for system TDF's");
    }

    //Make sure we create a default user profile record when a new Google user
    //shows up. We still want the default hook's 'profile' behavior, AND we want
    // our custom user profile collection to have a default record
    Accounts.onCreateUser(function(options, user) {
        // Little display helper
        var dispUsr = function(u) {
            return _.pick(u, "_id", "username", "emails", "profile");
        };

        // Default profile save
        userProfileSave(user._id, defaultUserProfile());

        // Default hook's behavior
        if (options.profile) {
            user.profile = _.extend(user.profile || {}, options.profile);
        }

        if (_.prop(user.profile, "experiment")) {
            serverConsole("Experiment participant user created:", dispUsr(user));
            return user;
        }

        // Set username and an email address from the google service info
        // We use the lowercase email for both username and email
        var email = _.chain(user)
            .prop("services")
            .prop("google")
            .prop("email").trim()
            .value().toLowerCase();
        if (!email) {
            //throw new Meteor.Error("No email found for your Google account");
        }

        if(!!email){
          user.username = email;
          user.emails = [{
              "address": email,
              "verified": true
          }];
        }

        serverConsole("Creating new Google user:", dispUsr(user));

        // If the user is initRoles, go ahead and add them to the roles.
        // Unfortunately, the user hasn't been created... so we need to actually
        // cheat a little and manipulate the user record as if we were the roles
        // code. IMPORTANT: a new version of alanning:roles could break this.
        user.roles = [];
        var roles = getConfigProperty("initRoles");
        var addIfInit = function(initName, roleName) {
            var initList = _.prop(roles, initName) || [];
            if (_.contains(initList, user.username)) {
                serverConsole("Adding", user.username, "to", roleName);
                user.roles.push(roleName);
            }
        };

        addIfInit("admins", "admin");
        addIfInit("teachers", "teacher");

        return user;
    });

    //Set up our server-side methods
    Meteor.methods({
        usernameToIDMap:function(){
          usernameToIDMap = {};
          Meteor.users.find({}).forEach(function(user){
            usernameToIDMap[user.username] = user._id;
          })
          return usernameToIDMap;
        },

        addClass: function(myClass){
          console.log("add myClass:" + JSON.stringify(myClass));
          return Classes.insert(myClass);
        },

        editClass:function(myClass){
          console.log("edit myClass:" + JSON.stringify(myClass));
          Classes.update({"_id":myClass._id},myClass,{upsert: true});
          return myClass._id;
        },

        deleteClass: function(myClass){
          Classes.remove({"instructor":this.userId,"name":myClass.name});
        },

        serverLog: function(data){
          if(Meteor.user()){
            logData = "User:" + Meteor.user()._id + ', log:' + data;
            console.log(logData);
          }
        },

        //Functionality to create a new user ID: return null on success. Return
        //an array of error messages on failure. If previous OK is true, then
        //we silently skip duplicate users (this is mainly for experimental
        //participants who are created on the fly)
        signUpUser: function (newUserName, newUserPassword, previousOK) {
            serverConsole("signUpUser", newUserName, "previousOK == ", previousOK);
            var checks = [];

            if (!newUserName) {
                checks.push("Blank user names aren't allowed");
            }
            else {
                var prevUser = Accounts.findUserByUsername(newUserName);
                if (!!prevUser) {
                    if (previousOK) {
                        // Older accounts from turk users are having problems with
                        // passwords - so when we detect them, we automatically
                        // change the password
                        Accounts.setPassword(prevUser._id, newUserPassword);
                        return null; //User has already been created - nothing to do
                    }else{
                      checks.push("User is already in use");
                    }
                }
            }

            if (!newUserPassword || newUserPassword.length < 6) {
                checks.push("Passwords must be at least 6 characters long");
            }

            if (checks.length > 0) {
                return checks; //Nothing to create
            }

            // Now we can actually create the user
            // Note that on the server we just get back the ID and have nothing
            // to do right now. Also note that this method is called for creating
            // NON-google user accounts (which should generally just be experiment
            // participants) - so we make sure to set an initial profile
            var createdId = Accounts.createUser({
                'email': newUserName,
                'username': newUserName,
                'password': newUserPassword,
                'profile': {
                    'experiment': !!previousOK
                }
            });
            if (!createdId) {
                return ["Unknown failure creating user account"];
            }

            //Now we need to create a default user profile record
            userProfileSave(createdId, defaultUserProfile());

            //Remember we return a LIST of errors, so this is success
            return null;
        },

        //We provide a separate server method for user profile info - this is
        //mainly since we don't want some of this data just flowing around
        //between client and server
        saveUserProfileData: async function(profileData) {
          serverConsole('saveUserProfileData', displayify(profileData));

          var saveResult, result, errmsg, acctBal;
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
            var res = await turk.getAccountBalance(
              UserProfileData.findOne({_id: Meteor.user()._id})
            );

            if (!res) {
              throw "There was an error reading your account balance";
            }

            result = true;
            acctBal = res.AvailableBalance;
            errmsg = "";
            return {
              'result':result,
              'saveResult':saveResult,
              'acctBal':acctBal,
              'error':errmsg
            }
          }
          catch(e) {
            result = false;
            console.log(e)
            errmsg = e;
          }
        },

        getUserSpeechAPIKey: function(){
          var speechAPIKey = GoogleSpeechAPIKeys.findOne({_id: Meteor.userId()});
          if(!!speechAPIKey){
            return decryptUserData(speechAPIKey['key']);
          }else{
            return null;
          }
        },

        isUserSpeechAPIKeySetup: function(){
          var speechAPIKey = GoogleSpeechAPIKeys.findOne({_id: Meteor.userId()});
          return !!speechAPIKey;
        },

        saveUserSpeechAPIKey: function(key) {
          key = encryptUserData(key);
          serverConsole("key:" + key);
          var result = true;
          var error = "";
          var userID = Meteor.userId();
          try {
              //Insure record matching ID is present while working around MongoDB 2.4 bug
              GoogleSpeechAPIKeys.update({_id: userID}, {'$set': {'preUpdate': true}}, {upsert: true});
          }
          catch(e) {
              serverConsole("Ignoring user speech api key upsert ", e);
          }
          var numUpdated = GoogleSpeechAPIKeys.update({_id: userID}, {key:key});

          // WHOOOPS! If we're still here something has gone horribly wrong
          if (numUpdated < 1) {
              result = false;
              error = "No records updated by save";
          }
          else if (numUpdated > 1) {
              result = false;
              error = "More than one record updated?! " + _.display(numUpdate);
          }

          return{
            'result': result,
            'error': error
          }
        },

        deleteUserSpeechAPIKey: function(){
          var userID = Meteor.userId();
          GoogleSpeechAPIKeys.remove(userID);
        },

        // ONLY FOR ADMINS: for the given targetUserId, perform roleAction (add
        // or remove) vs roleName
        userAdminRoleChange: function(targetUserId, roleAction, roleName) {
            serverConsole("userAdminRoleChange", targetUserId, roleAction, roleName);
            var usr = Meteor.user();
            if (!Roles.userIsInRole(usr, ["admin"])) {
                throw "You are not authorized to do that";
            }

            targetUserId = _.trim(targetUserId);
            roleAction = _.trim(roleAction).toLowerCase();
            roleName = _.trim(roleName);

            if (targetUserId.length < 1) {
                throw "Invalid: blank user ID not allowed";
            }
            if (!_.contains(["add", "remove"], roleAction)) {
                throw "Invalid: unknown requested action";
            }
            if (!_.contains(["admin", "teacher"], roleName)) {
                throw "Invalid: unknown requested role";
            }

            var targetUser = Meteor.users.findOne({_id: targetUserId});
            if (!targetUser) {
                throw "Invalid: could not find that user";
            }

            var targetUsername = _.prop(targetUser, "username");

            if (roleAction === "add") {
                Roles.addUsersToRoles(targetUserId, [roleName]);
            }
            else if (roleAction === "remove") {
                Roles.removeUsersFromRoles(targetUserId, [roleName]);
            }
            else {
                throw "Serious logic error: please report this";
            }

            return {
                'RESULT': 'SUCCESS',
                'targetUserId': targetUserId,
                'targetUsername': targetUsername,
                'roleAction': roleAction,
                'roleName': roleName
            };
        },

        saveUsersFile: function(filename,filecontents){
          serverConsole("saveUsersFile: " + filename);
          var allErrors = [];
          var rows = Papa.parse(filecontents).data;
          var headerRow = rows[0];
          rows = rows.slice(1);
          for(var index in rows){
            var row = rows[index];
            var username = row[0];
            var password = row[1];
            Meteor.call('signUpUser',username,password,true,function(error,result){
              if(!!error){
                allErrors.push({username:error});
              }
            });
          }
          serverConsole("allErrors: " + JSON.stringify(allErrors));
          return allErrors;
        },

        //Allow file uploaded with name and contents. The type of file must be
        //specified - current allowed types are: 'stimuli', 'tdf'
        saveContentFile: function(type, filename, filecontents) {
            serverConsole('saveContentFile', type, filename);
            var results = {
                'result': null,
                'errmsg': 'No action taken?',
                'action': 'None'
            };

            try {
                if (!type)         throw "Type required for File Save";
                if (!filename)     throw "Filename required for File Save";
                if (!filecontents) throw "File Contents required for File Save";

                //We need a valid use that is either admin or teacher
                var ownerId = Meteor.user()._id;
                if (!ownerId) {
                    throw "No user logged in - no file upload allowed";
                }

                if (!Roles.userIsInRole(Meteor.user(), ["admin", "teacher"])) {
                    throw "You are not authorized to upload files";
                }

                //Parse the XML contents to make sure we can acutally handle the file
                var jsonContents = xml2js.parseStringSync(filecontents);

                var rec, prev, collection;

                if (type == "tdf") {
                    //Make sure the TDF looks valid-ish
                    var tutor = _.chain(jsonContents).prop("tutor").value();

                    var lessonName = _.chain(tutor)
                        .prop("setspec").first()
                        .prop("lessonname").first().trim().value();
                    if (lessonName.length < 1) {
                        throw "TDF has no lessonname - it cannot be valid";
                    }

                    //Note that we don't check for units since a root TDF may
                    //not have any units

                    //Set up for TDF save
                    rec = createTdfRecord(filename, jsonContents, ownerId, 'upload');
                    collection = Tdfs;
                }
                else if (type === "stim") {
                    //Make sure the stim looks valid-ish
                    var clusterCount = _.chain(jsonContents)
                        .prop("setspec")
                        .prop("clusters").first()
                        .prop("cluster").prop("length").value();
                    if (clusterCount < 1) {
                        throw "Stimulus has no clusters - it cannot be valid";
                    }

                    //Set up for stim save
                    rec = createStimRecord(filename, jsonContents, ownerId, 'upload');
                    collection = Stimuli;
                }
                else {
                    throw "Unknown file type not allowed: " + type;
                }

                //If we're here we should have enough to handle the file
                prev = collection.findOne({'fileName': filename});
                if (prev) {
                    if (prev.owner !== ownerId) {
                        throw "You may not overwrite a file you don't own";
                    }
                    results.action = "overwrite previous file";
                    collection.update({ _id: prev._id }, rec);
                }
                else {
                    results.action = "save new file";
                    collection.insert(rec);
                }

                results.result = true;
                results.errmsg = "";
            }
            catch(e) {
                results.result = false;
                results.errmsg = e;
            }

            return results;
        },

        //Log one or more user records for the currently running experiment
        userTime: function (experiment, objectsToLog) {
            // No serverConsole call - it's handled by writeUserLogEntries
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

            serverConsole(usr + " " + logtxt);
        },

      numOnlineUsers: function () {
        return Meteor.users.find({'status.online':true}).count();
      },

    });

    //Create any helpful indexes for queries we run
    ScheduledTurkMessages._ensureIndex({ "sent": 1, "scheduled": 1 });

    //Start up synched cron background jobs
    SyncedCron.start();

    //Now check for messages to send every 5 minutes
    SyncedCron.add({
        name: 'Period Email Sent Check',
        schedule: function(parser) { return parser.text('every 5 minutes'); },
        job: function() { return sendScheduledTurkMessages(); }
    });

  SyncedCron.add({
    name: 'Log Number Online Users',
    schedule: function(parser) { return parser.text('every 5 minutes'); },
    job: function() { return logNumOnlineUsers(); }
  });
});

//We use a special server-side route for our experimental data download
Router.route("experiment-data", {
    name: "server.data",
    where: "server",
    path: "/experiment-data/:expKey/:format",
    action: function () {
        var exp = this.params.expKey;
        var fmt = this.params.format;
        var response = this.response;

        if (!exp) {
            response.writeHead(404);
            response.end("No experiment specified");
            return;
        }

        if (fmt !== "datashop") {
            response.writeHead(404);
            response.end("Unknown format specified: only datashop currently supported");
            return;
        }

        var filename = fmt + exp + "-data.txt";

        response.writeHead(200, {
            "Content-Type": "text/tab-separated-values",
            "Content-Disposition": "attachment; filename=" + filename
        });

        var recCount = createExperimentExport(exp, fmt, function(record) {
            response.write(record);
            response.write('\r\n');
        });
        response.end("");

        serverConsole("Sent all  data for", exp, "as file", filename, "with record-count:", recCount);
    }
});
