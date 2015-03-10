/*jshint sub:true*/

//The jshint inline option above suppresses a warning about using sqaure
//brackets instead of dot notation - that's because we prefer square brackets
//for creating some MongoDB queries

var Future = Npm.require("fibers/future");
var fs = Npm.require("fs");
var endOfLine = Npm.require("os").EOL;

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
    Assets.getText(fileName, function(err, data){
        if (err) throw err;
        var json = parseXML(data);
        future.return(json);
    });
    return future.wait();
}

function getRoles(fileName) {
    var future = new Future();
    Assets.getText(fileName, function(err, data) {
        if (err) throw err;
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


//Published to all clients (even without subscription calls)
Meteor.publish(null, function () {
    //Only valid way to get the user ID for publications
    var userId = this.userId;

    //The default data published to everyone - all TDF's and stims, and the
    //user data (user times log and user record) for them
    var defaultData = [
        Stimuli.find({}),
        Tdfs.find({}),
        UserTimesLog.find({_id:userId}),
        Meteor.users.find({_id:userId})
    ];

    return defaultData;
});

//Server-side startup logic

Meteor.startup(function () {
    //Rewrite TDF and Stimuli documents if we have a file
    var isXML = function (fn) { return fn.indexOf('.xml') >= 0; };

    _.each(
        _.filter(fs.readdirSync('./assets/app/stims/'), isXML),
        function(ele, idx, lst) {
            console.log("Updating Stim in DB from ", ele);
            var json = getStimJSON('stims/' + ele);
            Stimuli.remove({fileName: ele});
            Stimuli.insert({fileName: ele, stimuli: json});
        }
    );

    _.each(
        _.filter(fs.readdirSync('./assets/app/tdf/'), isXML),
        function(ele, idx, lst) {
            console.log("Updating TDF in DB from ", ele);
            var json = getStimJSON('tdf/' + ele);
            Tdfs.remove({fileName: ele});
            Tdfs.insert({fileName: ele, tdfs: json});
        }
    );

    var admins = getRoles("roles/admins.json");
    var teachers = getRoles("roles/teachers.json");

    _.each(Meteor.users.find().fetch(), function(ele) {
        var uname = "" + ele["username"];
        if (!!uname) {
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

    //Set up our server-side methods
    Meteor.methods({

        //Functionality to create a new user ID: return null on success. Return
        //an array of error messages on failure. If previous OK is true, then
        //we silently skip duplicate users (this is mainly for experimental
        //participants who are created on the fly)
        signUpUser: function(newUserName, newUserPassword, previousOK) {
            var checks = [];

            if (!newUserName) {
                checks.push("Blank user names aren't allowed");
            }
            else if(typeof Meteor.users.findOne({username: newUserName}) !== "undefined") {
                if (!previousOK) {
                    checks.push("User is already in use");
                }
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

            //Remeber we return a LIST of errors
            if (!createdId) {
                return ["Unknown failure creating user account"];
            }
            else {
                return null;
            }
        },

        //Handle experimental users - we create the user if missing (otherwise
        //everything is fine). We return null on success or an array of error
        //messages if there was a problem
        experimentalUser: function(newUserName, newUserPassword) {
        },

        //New functionality for logging to the DB
        userTime: function(experiment, objectsToLog) {
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
                for(i = 0; i < objectsToLog.length; i++) {
                    valsToPush.push(objectsToLog[i]);
                }
            }

            //Every object we log gets a server side time stamp
            for(i = 0; i < valsToPush.length; i++) {
                valsToPush[i]["serverSideTimeStamp"] = Date.now();
            }

            //Create action object: should look like:
            // { $push: { <experiment_key>: { $each: <objectsToLog in array> } } }
            var action = {$push: {}};
            var experiment_key = (experiment + "").replace(/\./g, "_");
            var allVals = { $each: valsToPush };
            action["$push"][experiment_key] = allVals;

            UserTimesLog.update(
                { _id: Meteor.userId() },
                action,
                {upsert: true}
            );
        },

        //Let client code send console output up to server
        debugLog: function(logtxt) {
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

    path: "/experiment-data/:expKey",

    action: function() {
        var exp = this.params.expKey;

        if (!exp) {
            this.response.writeHead(404);
            this.response.end("No experiment specified");
            return;
        }

        console.log("Sending all experimental data for", exp);

        this.response.writeHead(200, {
            "Content-Type": "text/tab-separated-values",
            "Content-Disposition": "attachment; filename=" + exp + "-data.tab"
        });

        this.response.end(createExperimentExport(exp).join('\r\n'));
    }
});
