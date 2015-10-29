////////////////////////////////////////////////////////////////////////////
// Template storage and helpers

var turkExperimentLog = new Mongo.Collection(null); //local-only - no database;

function clearTurkExpLog() {
    turkExperimentLog.remove({'temp': 1});
}

function turkLogRefresh(exp) {
    $("#turkExpTitle").text("Viewing data for " + exp);
    clearTurkExpLog();

    $('#turkModal').modal('show');

    Meteor.call("turkUserLogStatus", exp, function(error, result){
        $('#turkModal').modal('hide');

        if (typeof error !== "undefined") {
            var disp = "Failed to retrieve log entries. Error:" + error;
            console.log(disp);
            alert(disp);
            return;
        }

        _.each(result, function(val, idx) {
            var newRec = _.extend({
                temp: 1,
                idx: idx,
                questionsSeen: 0,
                experiment: exp
            }, val);

            newRec.needPay = (newRec.turkpay === '?');
            newRec.needBonus = (newRec.turkbonus === '?');
            newRec.haveEmailSched = (newRec.turkEmailSchedule !== '?');
            newRec.haveEmailSend = (newRec.turkEmailSend !== '?');
            newRec.turk_username = newRec.username;

            turkExperimentLog.insert(newRec);
        });
    });
}

function turkLogButtonToRec(element) {
    var target = $(element);
    var idx = _.intval(target.data("idx"), -1);
    console.log("Pay event for", target, "Found index", idx);

    if (idx < 0) {
        return null;
    }

    return turkExperimentLog.findOne({'idx': idx}, {sort: {'idx': 1}});
}

Template.turkWorkflow.helpers({
    turkExperimentLogToShow: function() {
        return turkExperimentLog.find().count() > 0;
    },

    turkExperimentLog: function() {
        var minTrials = _.intval(Session.get("turkLogFilterTrials") || -1);
        return turkExperimentLog.find({'questionsSeen': {'$gte': _.intval(minTrials)}}, {sort: {idx: 1}});
    },
});

//Helpful wrapper around JSON.stringify, including timestamp field expansion
function displayify(obj) {
    if (typeof obj === "string" || typeof obj === "number") {
        return obj;
    }
    var dispObj = _.extend({}, obj);

    try {
        for (var prop in dispObj) {
            if (prop.toLowerCase().endsWith('timestamp')) {
                var ts = _.intval(_.prop(obj, prop));
                if (ts > 0) {
                    dispObj[prop] = " " + new Date(ts) + " (converted from " + ts + ")";
                }
            }
        }
    }
    catch(e) {
        console.log("Object displayify error", e);

    }

    return JSON.stringify(dispObj, null, 2);
}

////////////////////////////////////////////////////////////////////////////
// Template Events

Template.turkWorkflow.rendered = function () {
    //Init the modal dialogs
    $('#turkModal').modal({
        'backdrop': 'static',
        'keyboard': false,
        'show': false
    });

    $('#detailsModal').modal({
        'show': false
    });

    var allTdfs = Tdfs.find({});
    var turkLogCount = 0; //Check all the valid TDF's

    allTdfs.forEach( function (tdfObject) {
        //Make sure we have a valid TDF (with a setspec)
        var setspec = _.chain(tdfObject)
            .prop("tdfs")
            .prop("tutor")
            .prop("setspec").first()
            .value();

        if (!setspec) {
            return;
        }

        // No lesson name? that's wrong
        var name = _.chain(setspec).prop("lessonname").first().value();
        if (!name) {
            return;
        }

        //Only show for userselect == true (and always assume userselect is
        //true unless we explcitily find false
        var userselectText = _.chain(setspec)
            .prop("userselect").first().trim()
            .value().toLowerCase();

        var userselect = true;
        if (userselectText === "false")
            userselect = false;

        if (userselect && Meteor.userId() === tdfObject.owner) {
            $("#turkLogSelectContainer").append(
                $("<button type='button' id='turk_"+tdfObject._id+"' name=turk_'"+name+"'></button>")
                    .addClass("btn btn-fix btn-sm btn-success btn-log-select")
                    .css('margin', '3px')
                    .data("tdffilename", tdfObject.fileName)
                    .html(name)
            );

            turkLogCount += 1;
        }
    });

    //Only show turk log stuff if there is anything to show
    $("#turkLogAll").toggle(turkLogCount > 0);
};


Template.turkWorkflow.events({
    // Admin/Teachers - show details from single Turk assignment
    'click #turk-show-assign': function(event) {
        event.preventDefault();
        var assignid = $("#turk-assignid").val();
        $("#turk-assign-results").text("Working on " + assignid);
        $('#turkModal').modal('show');
        Meteor.call("turkGetAssignment", assignid, function(error, result){
            $('#turkModal').modal('hide');
            var disp;
            if (typeof error !== "undefined") {
                disp = "Failed to handle turk approval. Error:" + error;
            }
            else {
                disp = "Server returned:" + JSON.stringify(result, null, 2);
            }
            $("#turk-assign-results").text(disp);
        });
    },

    // Admin/Teachers - send Turk message
    'click #turk-send-msg': function(event) {
        event.preventDefault();
        var workerid = $("#turk-workerid").val();
        var msgtext = $("#turk-msg").val();
        console.log("Sending to", workerid, "Msg:", msgtext);
        $('#turkModal').modal('show');
        Meteor.call("turkSendMessage", workerid, msgtext, function(error, result){
            $('#turkModal').modal('hide');
            var disp;
            if (typeof error !== "undefined") {
                disp = "Failed to handle turk approval. Error:" + error;
            }
            else {
                disp = "Server returned:" + JSON.stringify(result, null, 2);
            }
            console.log(disp);
            alert(disp);
        });
    },

    // Admin/Teachers - show user log for a particular experiment
    'click .btn-log-select': function(event) {
        event.preventDefault();

        var target = $(event.currentTarget);
        var exp = target.data("tdffilename");

        turkLogRefresh(exp);
    },

    // Admin/Teachers - filter Turk log results by trials seen
    'keyup #turklog-filt': function(event) {
        Session.set("turkLogFilterTrials", _.intval($("#turklog-filt").val()));
        console.log("Filtering for", Session.get("turkLogFilterTrials"), "trials");
    },

    // Admin/Teachers - approve/pay a user in the Turk log view
    'click .btn-pay-action': function(event) {
        event.preventDefault();

        var rec = turkLogButtonToRec(event.currentTarget);
        if (!rec) {
            alert("Cannot find record for that table entry?!");
            return;
        }

        var exp = _.trim(rec.experiment).replace(/\./g, "_");
        if (!exp) {
            alert("Could not determine the experiment name for this entry?!");
            return;
        }

        var msg = "Thank you for participating";

        $("#turkModal").modal('show');

        Meteor.call("turkPay", rec.userid, exp, msg, function(error, result) {
            $("#turkModal").modal('hide');

            if (!!error) {
                console.log("turkPay failure:", error);
                alert("There was a server failure of some kind: " + error);
            }
            else if (!!result) {
                console.log("turkPay error:", result);
                alert("There was a problem with the approval/payment: " + result);
            }
            else {
                alert("Your approval succeeded");
            }

            turkLogRefresh(exp);
        });
    },

    // Admin/Teachers - pay bonus to a user in the Turk log view
    'click .btn-bonus-action': function(event) {
        event.preventDefault();

        var rec = turkLogButtonToRec(event.currentTarget);
        if (!rec) {
            alert("Cannot find record for that table entry?!");
            return;
        }

        var exp = _.trim(rec.experiment).replace(/\./g, "_");
        if (!exp) {
            alert("Could not determine the experiment name for this entry?!");
            return;
        }

        $("#turkModal").modal('show');

        Meteor.call("turkBonus", rec.userid, exp, function(error, result) {
            $("#turkModal").modal('hide');

            if (!!error) {
                console.log("turkBonus failure:", error);
                alert("There was a server failure of some kind: " + error);
            }
            else if (!!result) {
                console.log("turkBonus error:", result);
                alert("There was a problem with the bonus: " + result);
            }
            else {
                alert("Your bonus payment succeeded");
            }

            turkLogRefresh(exp);
        });
    },

    // Admin/Teachers - show previous approve/pay for a user in the Turk log view
    'click .btn-pay-detail': function(event) {
        event.preventDefault();

        $("#detailsModal").modal('hide');

        var disp;
        try {
            disp = displayify(turkLogButtonToRec(event.currentTarget).turkpayDetails);
        }
        catch(e) {
            disp = "Error finding details to display: " + e;
        }

        $("#detailsModalListing").text(disp);
        $("#detailsModal").modal('show');
    },

    // Admin/Teachers - show previous bonus for a user in the Turk log view
    'click .btn-bonus-detail': function(event) {
        event.preventDefault();

        $("#detailsModal").modal('hide');

        var disp;
        try {
            disp = displayify(turkLogButtonToRec(event.currentTarget).turkbonusDetails);
        }
        catch(e) {
            disp = "Error finding details to display: " + e;
        }

        $("#detailsModalListing").text(disp);
        $("#detailsModal").modal('show');
    },

    //Admin/Teachers - show previous email sched detail
    'click .btn-sched-detail': function(event) {
        event.preventDefault();

        $("#detailsModal").modal('hide');

        var disp;
        try {
            disp = displayify(turkLogButtonToRec(event.currentTarget).turkEmailScheduleDetails);
        }
        catch(e) {
            disp = "Error finding details to display: " + e;
        }

        $("#detailsModalListing").text(disp);
        $("#detailsModal").modal('show');
    },

    //Admin/Teachers - show previous email send detail
    'click .btn-send-detail': function(event) {
        event.preventDefault();

        $("#detailsModal").modal('hide');

        var disp;
        try {
            disp = displayify(turkLogButtonToRec(event.currentTarget).turkEmailSendDetails);
        }
        catch(e) {
            disp = "Error finding details to display: " + e;
        }

        $("#detailsModalListing").text(disp);
        $("#detailsModal").modal('show');
    },
});
