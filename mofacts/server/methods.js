/*jshint sub:true*/

//The jshint inline option above suppresses a warning about using sqaure
//brackets instead of dot notation - that's because we prefer square brackets
//for creating some MongoDB queries


var Future = Npm.require("fibers/future");
var fs = Npm.require("fs");
var endOfLine = Npm.require("os").EOL;
if(!!process.env.METEOR_SETTINGS_WORKAROUND){
  Meteor.settings = JSON.parse(process.env.METEOR_SETTINGS_WORKAROUND);
}
if(!!Meteor.settings.public.testLogin){
  process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0;
  console.log("dev environment, allow insecure tls");
}
console.log("meteor settings: " + JSON.stringify(Meteor.settings));
process.env.MAIL_URL = Meteor.settings.MAIL_URL;
var adminUsers = Meteor.settings.initRoles.admins;
var ownerEmail = Meteor.settings.owner;

var clozeGeneration = require('./lib/Process.js');

// Open file stream for active user log
var activeUserLogStream = fs.createWriteStream("activeUserLog.csv", {flags: 'a'});

//For Southwest SSO with ADFS/SAML 2.0
for (i = 0; i < Meteor.settings.saml.length; i++) {
  // privateCert is weird name, I know. spCert is better one. Will need to refactor
  if (Meteor.settings.saml[i].privateKeyFile && Meteor.settings.saml[i].publicCertFile) {
      console.log("Set keys/certs for " + Meteor.settings.saml[i].provider);
      Meteor.settings.saml[i].privateCert = Assets.getText(Meteor.settings.saml[i].publicCertFile);
      Meteor.settings.saml[i].privateKey = Assets.getText(Meteor.settings.saml[i].privateKeyFile);
  } else {
      console.log("No keys/certs found for " + Meteor.settings.saml[i].provider);
  }
}

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

function sendErrorReportSummaries(){
  serverConsole("sendErrorReportSummaries");
  var unsentErrorReports = ErrorReports.find({"emailed":false}).fetch();
  if(unsentErrorReports.length > 0){
    var sentErrorReports = new Set();
    for(var index in adminUsers){
      var admin = adminUsers[index];
      var from = ownerEmail;
      var subject = "Error Reports Summary";
      var text = "";
      for(var index2 in unsentErrorReports){
        var unsentErrorReport = unsentErrorReports[index2];
        var userWhoReportedError = Meteor.users.findOne({_id:unsentErrorReport.user});
        text = text + "User: " + userWhoReportedError.username + ", page: " + unsentErrorReport.page + ", time: " + unsentErrorReport.time + ", description: " + unsentErrorReport.description + ", userAgent: " + unsentErrorReport.userAgent + " \n";
        sentErrorReports.add(unsentErrorReport._id);
      }
      
      try {
        sendEmail(admin,from,subject,text);
      } catch (err) {
        serverConsole(err);
      }
    }
    sentErrorReports = Array.from(sentErrorReports);
    ErrorReports.update({_id:{$in:sentErrorReports}},{$set:{"emailed":true}},{multi:true});
    serverConsole("Sent " + sentErrorReports.length + " error reports summary");
  }else{
      serverConsole("no unsent error reports to send");
  }
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

function genID(length){
  return Math.random().toString(36).substring(2, (2+length));
}

function sendEmail(to,from,subject,text){
  check([to,from,subject,text],[String]);
  Email.send({to,from,subject,text});
}

/**
 * Helper to determine if a TDF should be generated according
 * to the provided tags
 * @param {Object} json 
 */
function hasGeneratedTdfs(json) {
  return json.tutor.generatedtdfs && json.tutor.generatedtdfs.length;
}

/**
 * Creates and inserts into the DB a dynamically generated TDF 
 * based on values defined in a parent TDF 
 * @param {Object} parentTdfJson
 * @param {Object} fileName
 * @param {String} ownerId
 * @param {String} source
 * */
function handleDynamicTdfGeneration(parentTdfJson, fileName, ownerId, source) {
  let parentSetspec = parentTdfJson.tutor.setspec[0];
  let parentUnits = parentTdfJson.tutor.unit;  
  let generatedTdfSpecs = parentTdfJson.tutor.generatedtdfs;

  if (_.isEmpty(parentSetspec.stimulusfile[0])) {
    throw "Stimulus file undefined"
  }

  let stimFileClusters = 
    Stimuli.findOne({fileName: parentSetspec.stimulusfile[0]})
      .stimuli
      .setspec
      .clusters[0]
      .cluster;

  _.each(generatedTdfSpecs[0].generatedtdf, (spec, idx) => {
    let genFileName = fileName + "_dynagen_" + idx;

    const result = Tdfs.findOne({fileName: genFileName});
    if (result) {
      console.log("Skipping existing TDF ", genFileName)
      return false;
    }

    let weightStart = -1; 
    let weightEnd = -1;
    let orderGroup = -1;
    let criteria = spec.criteria;
    let lessonName = spec.name;
    let doc = {
      fileName: genFileName,
      owner: ownerId,
      dynamic: true,
      source: source,
      tdfs: {
        tutor: {
          setspec: [],
          unit: [],
        }
      }
    };
    
    // Set criteria items
    criteria.forEach(criterion => {
      if (criterion.weights && criterion.weights.length) {
        let weightValues = criterion.weights[0];
        
        if (weightValues.indexOf('-') !== -1) {
          let splitWeightValues = weightValues.split('-');
          
          weightStart = parseInt(splitWeightValues[0]);
          weightEnd = parseInt(splitWeightValues[1]);
        } else {
          weightStart = parseInt(weightValues);
          weightEnd = weightStart;
        }
      } else if (criterion.orderGroups && criterion.orderGroups.length) {
        orderGroup = parseInt(criterion.orderGroups[0]);
      }
    });
    if (weightStart === weightEnd && orderGroup < 0) {
      throw "Missing criteria required for cluster list generation"
    }

    // Helper to determine if a cluster should be used
    // based on the criteria in tags
    let isIncludedCluster = tag => {
      let tagOrderGroup = !_.isEmpty(tag.orderGroup[0]) 
        ? parseInt(tag.orderGroup[0]) : -1;

      let tagWeightGroup = !_.isEmpty(tag.weightGroup[0]) 
        ? parseInt(tag.weightGroup[0]) : -1;

      if (tagOrderGroup > -1) {
        if (tagOrderGroup === orderGroup) {
          return true;
        }
      }

      if (tagWeightGroup > -1) {
        if (tagWeightGroup >= weightStart 
          && tagWeightGroup <= weightEnd) {
            return true;
        }
      }

      return false;
    }

    // Generate cluster list based on criteria
    let clusterListString = "";
    let clusterList = [];
    let start = -1;
    let end = -1;
    _.each(stimFileClusters, (cluster, idx) => {
      let isIncludedInStimCluster = false;
      _.each(cluster.tags, tag => {
        if (isIncludedCluster(tag)) {
          isIncludedInStimCluster = true;
          return false;
        }
      });

      if (start === -1 && isIncludedInStimCluster) {
        start = idx;
      } else if (start > -1 && isIncludedInStimCluster) {
        if (idx === stimFileClusters.length - 1) {
          end = idx;
          clusterListString += " " + start + "-" + end + " ";
        }
      } else if (start > -1 && !isIncludedInStimCluster) {
        end = idx - 1;
        clusterListString += " " + start + "-" + end + " ";
        start = -1;
        end = -1; 
      }
    });
    if (!_.isEmpty(clusterListString)) {
      clusterListString = clusterListString.trim();
      clusterList.push(clusterListString);
    } else {
      throw "Invalid cluster list"
    }

    // Create new setspec according to parent TDF's setspec
    let setSpec = {};
    Object.keys(parentSetspec).forEach(key => {
      console.log(key);
      if (key === "lessonname" || key === "name") {
        console.log(lessonName);
        setSpec[key] = lessonName;
      } else {
        setSpec[key] = parentSetspec[key][0];
      }
    });
    if (!_.isEmpty(setSpec)) {
      doc.tdfs.tutor.setspec.push(setSpec);
    } else {
      throw "Invalid setspec"
    }

    parentUnits.forEach(unit => {
      let generatedUnit = {};
      Object.keys(unit).forEach(uName => {
        if (uName === "learningsession") {
          let parentLearningSession = unit[uName][0];
          generatedUnit.learningsession = [{}];

          Object.keys(parentLearningSession).forEach(lSessionKey => {
            if (lSessionKey === "clusterlist") {
              generatedUnit.learningsession[0].clusterlist = clusterList;
            } else {
              generatedUnit.learningsession[0][lSessionKey] = parentLearningSession[lSessionKey];
            }
          });
        } else if (uName === "unitname") {
          let genUnitName = [];

          genUnitName.push(lessonName);
          generatedUnit[uName] = genUnitName[uName];
        } else {
          generatedUnit[uName] = unit[uName];
        }
      });
      if (!_.isEmpty(generatedUnit)) {
        doc.tdfs.tutor.unit.push(generatedUnit);
      } else {
        throw "Invalid unit"
      }
    });

    // Insert document into DB
    try {
      const result = Tdfs.insert(doc);
      console.log("Inserted dynamic TDF ", genFileName);
    } catch (error) {
      throw new Meteor.Error('Error inserting dynamic TDF:\n', error);
    }
  });
}

const baseSyllableURL = 'http://localhost:4567/syllables/'
getSyllablesForWord = function(word){
  let syllablesURL = baseSyllableURL + word;
  const result = HTTP.call('GET',syllablesURL);
  let syllableArray = result.content.replace(/\[|\]/g,'').split(',').map(x => x.trim());
  console.log("syllables for word, " + word + ": " + JSON.stringify(syllableArray) );
  return syllableArray;
}

const lengthOfNewGeneratedIDs = 6;

//Published to all clients (even without subscription calls)
Meteor.publish(null, function () {
    //Only valid way to get the user ID for publications
    var userId = this.userId;

    //The default data published to everyone - all TDF's and stims, and the
    //user data (user times log and user record) for them
    var defaultData = [
        StimSyllables.find({}),
        Stimuli.find({}),
        Tdfs.find({}),
        UserTimesLog.find({_id:userId}),
        Meteor.users.find({_id: userId}),
        UserProfileData.find({_id: userId}, {fields: {
            have_aws_id: 1,
            have_aws_secret: 1,
            use_sandbox: 1
        }}),
        UserMetrics.find({_id:userId}),
        Classes.find({})
    ];

    return defaultData;
});

Meteor.publish('specificUser',function(username){
  return Meteor.users.find({"username":username});
})

Meteor.publish('tdfs', function(){
  return Tdfs.find({});
})

Meteor.publish('specificUserTimesLog',function(userId){
  return UserTimesLog.find({_id:userId});
})

Meteor.publish('specificUserMetrics',function(userId){
  return UserMetrics.find({_id:userId});
})

Meteor.publish('allUsers', function () {
    var opts = {
        fields: {username: 1}
    };
    if (Roles.userIsInRole(this.userId, ["admin"])) {
        opts.fields.roles = 1;
    }
	return Meteor.users.find({}, opts);
});

Meteor.publish('classesForInstructor',function(instructorID){
  return Classes.find({"instructor":instructorID});
})

Meteor.publish('allTeachers', function(){
  return Meteor.users.find({'roles':'teacher',"username":/southwest[.]tn[.]edu/i});
});

Meteor.publish('allUsersWithTeacherRole', function() {
  return Meteor.users.find({'roles': 'teacher'});
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

            if (prev && !hasGeneratedTdfs(json)) {
              Tdfs.update({ _id: prev._id }, rec);
            } else if (hasGeneratedTdfs(json)) {
              handleDynamicTdfGeneration(json, ele, adminUserId, 'repo');
            } else {
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
          updateStimSyllableCache:function(stimFileName,answers){
            console.log("updateStimSyllableCache");
            let curStimSyllables = StimSyllables.findOne({filename:stimFileName});
            console.log("curStimSyllables: " + JSON.stringify(curStimSyllables));
            if(!curStimSyllables){
              let data = {};
              for(let answer of answers){
                let syllableArray = getSyllablesForWord(answer);
                data[answer] = {
                  count: syllableArray.length,
                  syllables: syllableArray
                }
              }
              StimSyllables.insert({filename:stimFileName,data:data});
              console.log("after updateStimSyllableCache");
            }
          },

          getUsageReportData:function(){
            const numDaysToQuery = 7;
            var startQueryDate = new Date(Date.now() - (1000*60*60*24*numDaysToQuery));

          },

          getClozeEditAuthors:function(){
            var authorIDs = {};
            ClozeEditHistory.find({}).forEach(function(entry){
              authorIDs[entry.user] = Meteor.users.findOne({_id:entry.user}).username;
            });
            return authorIDs;
          },

          sendErrorReportSummaries:function(){
            sendErrorReportSummaries();
          },
          sendEmail:function(to,from,subject,text){
            this.unblock();
            sendEmail(to,from,subject,text);
          },

          sendUserErrorReport:function(userID,description,curPage,sessionVars,userAgent,logs){
            var errorReport = {
              user:userID,
              description:description,
              page:curPage,
              time:new Date(),
              sessionVars:sessionVars,
              userAgent:userAgent,
              logs:logs,
              emailed:false
            };
            return ErrorReports.insert(errorReport);
          },

          logUserAgentAndLoginTime:function(userID,userAgent){
            var loginTime = new Date();
            return Meteor.users.update({_id:userID},{$set: {status : {lastLogin:loginTime,userAgent:userAgent}}});
          },
          generateUnusedIDs:function(numIDsToGen){
            var newIDs = [];
            var idMap = {};
            var allUsers = Meteor.users.find({}).fetch();
            _.each(allUsers,function(user){
              var id = user.username;
              idMap[id] = true;
            })
            for(var i=0;i<numIDsToGen;i++){
              var newID = genID(lengthOfNewGeneratedIDs);
              while(idMap[newID]){
                newID = genID(lengthOfNewGeneratedIDs);
              }
              newIDs.push(newID);
              idMap[newID] = true;
            }

            return newIDs;
          },

          getStudentPerformanceForClassAndTdf:function(classID,tdfFileName){
            var curClass = Classes.findOne({_id:classID});
            studentTotals = {
              numCorrect: 0,
              count: 0,
              totalTime: 0
            }
            var students = [];
            if(!!curClass){
              curClass.students.forEach(function(studentUsername){
                if(studentUsername.indexOf("@") == -1){
                  studentUsername = studentUsername.toUpperCase();
                }
                var student = Meteor.users.findOne({"username":studentUsername}) || {};
                var studentID = student._id;
                var count = 0;
                var numCorrect = 0;
                var totalTime = 0;
                assessmentItems = {};

                if(tdfFileName === "xml"){
                  tdfQueryNames = Tdfs.find({}).fetch().map(x => x.fileName);
                }else{
                  tdfQueryNames = [tdfFileName];
                }

                _.each(tdfQueryNames, function(tdfQueryName) {
                  tdfObject = Tdfs.findOne({fileName: tdfQueryName})
                  _.each(tdfObject.tdfs.tutor.unit,function(unit){
                    if(!!unit.assessmentsession){
                      clusterList = unit.assessmentsession[0].clusterlist[0];
                      clusterLists = clusterList.split(' ').map(x => x.split('-').map(y => parseInt(y)));
                      _.each(clusterLists,function(clusterStartEnd){
                        for(var i=clusterStartEnd[0];i<=clusterStartEnd[1];i++){
                          assessmentItems[i] = true;
                        }
                      });
                    }
                  });
                });

                var tdfQueryName = tdfFileName.replace(/[.]/g,'_');
                UserMetrics.find({_id:studentID}).forEach(function(entry){
                  var tdfEntries = _.filter(_.keys(entry), x => x.indexOf(tdfQueryName) != -1);
                  for(var index in tdfEntries){
                    var key = tdfEntries[index];
                    var tdf = entry[key];
                    for(var index in tdf){
                      //Only count items in learning sessions
                      if(!assessmentItems[index]){
                        var stim = tdf[index];
                        count += stim.questionCount || 0;
                        numCorrect += stim.correctAnswerCount || 0;
                        var answerTimes = stim.answerTimes;
                        for(var index in answerTimes){
                          var time = answerTimes[index];
                          totalTime += (time / (1000*60)); //Covert to minutes from milliseconds
                        }
                      }
                    }
                  }
                });
                var percentCorrect = "N/A";
                if(count != 0){
                  percentCorrect = ((numCorrect / count)*100).toFixed(2)  + "%";
                }
                totalTime = totalTime.toFixed(1);
                var studentPerformance = {
                  "username":studentUsername,
                  "count":count,
                  "percentCorrect":percentCorrect,
                  "numCorrect":numCorrect,
                  "totalTime":totalTime
                }
                studentTotals.count += studentPerformance.count;
                studentTotals.totalTime += parseFloat(studentPerformance.totalTime);
                studentTotals.numCorrect += studentPerformance.numCorrect;
                students.push(studentPerformance);
              })
            }
            studentTotals.percentCorrect = (studentTotals.numCorrect / studentTotals.count * 100).toFixed(4) + "%";
            studentTotals.totalTime = studentTotals.totalTime.toFixed(1);
            return [students,studentTotals];
          },

          namesOfTdfsAttempted:function(userId){
            var allNamesOfTdfsAttempted = [];

            var userMetrics = UserMetrics.find({_id:userId});

            userMetrics.forEach(function(entry){
              var possibleTdfs = _.filter(_.keys(entry), x => x.indexOf("_xml") != -1)
              for(var index in possibleTdfs){
                var possibleTdf = possibleTdfs[index];
                if(possibleTdf.indexOf("_xml") != -1){
                  var curTdfName = possibleTdf;
                  // //Replace only last underscore with "." to reconstruct actual tdf name
                  // curTdfName = curTdfName.replace("_xml",".xml");
                  allNamesOfTdfsAttempted.push(curTdfName);
                }
              }
            });

            return allNamesOfTdfsAttempted;
        },

        getTdfNamesAssignedByInstructor:function(instructorID){
          var user = Meteor.users.findOne({_id:instructorID});
          var instructorClasses;
          if(Roles.userIsInRole(user, ['admin'])){
            instructorClasses = Classes.find({}).fetch();
          }else{
            instructorClasses = Classes.find({"instructor":instructorID}).fetch();
          }
          var tdfs = new Set();
          _.each(instructorClasses,function(curClass){
            var tdfsInClass = curClass.tdfs;
            _.each(tdfsInClass,function(curTdf){
              tdfs.add(curTdf);
            });
          });
          return Array.from(tdfs);
        },

        insertClozeEditHistory:function(history){
          ClozeEditHistory.insert(history);
        },
        getClozesAndSentencesForText:function(rawText){
          console.log("rawText!!!: " + rawText);
          return clozeGeneration.GetClozeAPI(null,null,null,rawText);
        },

        insertStimTDFPair:function(newStimJSON,newTDFJSON){
          Stimuli.insert(newStimJSON);
          Tdfs.insert(newTDFJSON);
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

        addUserToTeachersClass: function(user,teacherUsername,teacherClassName){
          user = user.toLowerCase();
          var teacher = Meteor.users.find({"username": teacherUsername}) || {};
          var teacherID = teacher._id;
          console.log("teacherUsername: " + teacherUsername + ", teacherID: " + teacherID);
          var teacherClasses = Classes.find({"instructor":teacherID,"name":teacherClassName}).fetch();
          console.log("teacherClasses: " + JSON.stringify(teacherClasses));
          var studentInAClass = false;
          for(var index in teacherClasses){
            var curClass = teacherClasses[index];
            if(curClass.students.findIndex(x => x === user) != -1){
              studentInAClass = true;
              break;
            }
          }
          if(!studentInAClass && teacherClasses.length > 0){
            console.log("student not in a class");
            var classToUpdate = teacherClasses[0];
            classToUpdate.students.push(user);
            Classes.update({"_id":classToUpdate._id},classToUpdate,{upsert: true});
          }
        },

        getTdfsAssignedToStudent: function(user){
          console.log('user: ' + user);
          var classesWithStudent = Classes.find({"students":user}).fetch();
          console.log("classesWithStudent: " + JSON.stringify(classesWithStudent));
          tdfs = new Set([]);
          for(var index in classesWithStudent){
            var curClass = classesWithStudent[index];
            console.log("curClass: " + JSON.stringify(curClass));
            var tdfsInCurClass = curClass.tdfs;
            for(var index2 in tdfsInCurClass){
              var tdf = tdfsInCurClass[index2];
              tdfs.add(tdf);
            }
          }
          console.log("tdfs: " + JSON.stringify(Array.from(tdfs)));
          return Array.from(tdfs);
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
            serverConsole("username: " + username + ", password: " + password);
            Meteor.call('signUpUser',username,password,true,function(error,result){
              if(!!error){
                allErrors.push({username:error});
              }
              if(!!result){
                allErrors.push({username:result});
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

                    let json = {
                      tutor: tutor,
                    }
                    if (hasGeneratedTdfs(json)) {
                      handleDynamicTdfGeneration(json, fileName, ownerId, 'upload');
                    } else {
                      //Set up for TDF save
                      rec = createTdfRecord(filename, jsonContents, ownerId, 'upload');
                    }
                    
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

  SyncedCron.add({
    name: 'Send Error Report Summaries',
    schedule: function(parser) { return parser.text('at 3:00 pm');},
    job: function() { return sendErrorReportSummaries(); }
  })
});

Router.route("clozeEditHistory",{
  name: "server.clozeData",
  where: "server",
  path: "/clozeEditHistory/:userID",
  action: function () {
      var userID = this.params.userID;
      var response = this.response;

      if (!userID) {
          response.writeHead(404);
          response.end("No user id specified");
          return;
      }

      var filename = userID + "-clozeEditHistory.json";

      response.writeHead(200, {
          "Content-Type": "application/json",
          "Content-Disposition": "attachment; filename=" + filename
      });

      var recCount = 0;
      ClozeEditHistory.find({"user":userID}).forEach(function(record){
        recCount += 1;
        response.write(JSON.stringify(record));
        response.write("\r\n");
      });
      response.end("");

      serverConsole("Sent all  data for", userID, "as file", filename, "with record-count:", recCount);
  }
});

// Serves data file containing all TDF data for single teacher
Router.route("data-by-teacher", {
  name: "server.teacherData",
  where: "server",
  path: "/data-by-teacher/:uid/:format",
  action: function() {
    var uid = this.params.uid;
    var fmt = this.params.format;
    var response = this.response;

    var tdfs = [];

    if (!uid) {
      response.writeHead(404);
      response.end("No user ID specified");
      return;
    }

    if (fmt !== "datashop") {
      response.writeHead(404);
      response.end("Unknown format specified: only datashop currently supported");
      return;
    }

    var classes = Classes.find({'instructor': uid});
  
    if (!classes) {
      response.writeHead(404);
      response.end("No classes found for the specified user ID");
      return;
    }

    classes.forEach(function(c) {
      c.tdfs.forEach(function(tdf) {
        tdfs.push(tdf.fileName);
      });
    });

    if (!tdfs.length > 0) {
      response.writeHead(404);
      response.end("No tdfs found for any classes");
      return;
    }

    var user = Meteor.users.findOne({'_id': uid});
    var userName = user.username;
    userName = userName.replace('/[/\\?%*:|"<>\s]/g', '_');

    var fileName = 'mofacts_' + userName + '_all_tdf_data.txt';

    response.writeHead(200, {
      "Content-Type": "text/tab-separated-values",
      "Content-Disposition": "attachment; filename=" + fileName
    });

    var recCount = createExperimentExport(tdfs, fmt, function(record) {
      response.write(record);
      response.write('\r\n');
    });

    tdfs.forEach(function(tdf) {
      serverConsole("Sent all  data for", tdf, "as file", fileName, "with record-count:", recCount);
    });

    response.end("");
  }
});

// Serves data file containing all TDF data for all classes for a teacher
Router.route("data-by-class", {
  name: "server.classData",
  where: "server",
  path: "/data-by-class/:classid/:format",
  action: function() {
    var classId = this.params.classid;
    var fmt = this.params.format;
    var response = this.response;

    var tdfs = [];

    if (!classId) {
      response.writeHead(404);
      response.end("No class ID specified");
      return;
    }

    if (fmt !== "datashop") {
      response.writeHead(404);
      response.end("Unknown format specified: only datashop currently supported");
      return;
    }

    var foundClass = Classes.findOne({'_id': classId});
  
    if (!foundClass) {
      response.writeHead(404);
      response.end("No classes found for the specified class ID");
      return;
    }
    console.log(foundClass);
    foundClass.tdfs.forEach(function(tdf) {
      tdfs.push(tdf.fileName);
    });

    if (!tdfs.length > 0) {
      response.writeHead(404);
      response.end("No tdfs found for any classes");
      return;
    }

    var className = foundClass.name;
    className = className.replace('/[/\\?%*:|"<>\s]/g', '_');
    

    var fileName = 'mofacts_' + className + '_all_class_data.txt';

    response.writeHead(200, {
      "Content-Type": "text/tab-separated-values",
      "Content-Disposition": "attachment; filename=" + fileName
    });

    var recCount = createExperimentExport(tdfs, fmt, function(record) {
      response.write(record);
      response.write('\r\n');
    });

    tdfs.forEach(function(tdf) {
      serverConsole("Sent all  data for", tdf, "as file", fileName, "with record-count:", recCount);
    });

    response.end("");
  }
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
