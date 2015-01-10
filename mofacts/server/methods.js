var Future = Npm.require("fibers/future");
var fs = Npm.require("fs");
var filename, name, timestamp, TempLog = "";
var filepath = '../../../../../server/';
var endOfLine = Npm.require("os").EOL;

//TODO: Update README with new meteor version and procedure for updating

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

//Server-side startup logic

Meteor.startup(function () {
    //Currently we re-load all tdf and stimuli from local files
    Stimuli.remove({});
    Tdfs.remove({});
    stimTdfPair.remove({});
    
    var isXML = function (fn) { return fn.indexOf('.xml') >= 0; };
    
    _.each(
        _.filter(fs.readdirSync('./assets/app/stims/'), isXML), 
        function(ele, idx, lst) {
            var json = getStimJSON('stims/' + ele);
            Stimuli.insert({fileName: ele, stimuli: json});
        }
    );
    
    _.each(
        _.filter(fs.readdirSync('./assets/app/tdf/'), isXML),
        function(ele, idx, lst) {
            var json = getStimJSON('tdf/' + ele);
            Tdfs.insert({fileName: ele, tdfs: json});
        }
    );
    
    //Set up our server-side methods
    Meteor.methods({
        
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

        //Added addition stuff to Log
        writing: function(stuff){
            fs.appendFileSync(filepath + name + "_" + filename +".txt", stuff)
            Meteor.call("addtime");
        },
        
        recordActR: function(vals){
            fs.appendFileSync(filepath + name + "_" + filename + "_ACTR_.txt", vals)
        },
    
        //Added addition stuff to Log
        addtime: function(){
            Meteor.call("timestamp");
            fs.appendFileSync(filepath + name + "_" + filename +".txt", timestamp  + endOfLine)
        },

        //Saves test name to Server side
        naming: function(name){
            name = name.split(".",1);
            filename = name;
        },

        //Saves username to Server side
        user: function(names){
            name = names;

        },

        //Saves timestamp to Server side
        timestamp: function(){
            var time = Date.now();
            timestamp = time;
        },

        //Saves timestamp to Server side
        Userlog: function(usernamestuff){
            console.log(usernamestuff + " has connected.")
        },


        //TODO: we could change this call to do a SINGLE database op
        updateCardProbs: function(setModifiers, incModifiers){
            var target = {_id: Meteor.userId()};
            
            _.each(setModifiers, function(ele, idx) {
                CardProbabilities.update(target, ele);
            });
            
            _.each(incModifiers, function(ele, idx) {
                CardProbabilities.update(target, ele);
            });
        }
    });
});

