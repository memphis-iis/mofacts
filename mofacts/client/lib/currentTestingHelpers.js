/* client/lib/currentTestingHelpers.js
 *
 * Client-side helper functions for getting current information about testing
 * and/or the current trial. Much of this functionality began in cardTemplate.js
 * but has been moved here for easier use. See also lib/sessionUtils.js for
 * a better list of Session variables we currently use.
 * */

//Return the current stim file cluster
getStimCluster = function (index) {
    var file = Stimuli.findOne({fileName: getCurrentStimName()});
    return file.stimuli.setspec.clusters[0].cluster[index];
};

//Return the current question type
getQuestionType = function () {
    var type = "text"; //Default type

    //If we get called too soon, we just use the first cluster
    var clusterIndex = getCurrentClusterIndex();
    if (!clusterIndex && clusterIndex !== 0)
        clusterIndex = 0;

    var cluster = getStimCluster(clusterIndex);
    if (cluster.displayType && cluster.displayType.length) {
        type = cluster.displayType[0];
    }

    return ("" + type).toLowerCase();
};

findQTypeSimpified = function () {
    var QType = getQuestionType();

    if      (QType == "text")  QType = "T";    //T for Text
    else if (QType == "image") QType = "I";    //I for Image
    else if (QType == "sound") QType = "A";    //A for Audio
    else                       QType = "NA";   //NA for Not Applicable

    return QType;
};

getTestType = function () {
    return Helpers.trim(Session.get("testType")).toLowerCase();
};

getCurrentClusterIndex = function () {
    return Session.get("clusterIndex");
};

//get the question at this index
getStimQuestion = function (index, whichQuestion) {
    return getStimCluster(index).display[whichQuestion];
};

//get the answer at this index
getStimAnswer = function (index, whichAnswer) {
    return getStimCluster(index).response[whichAnswer];
};

getCurrentStimName = function () {
    return Session.get("currentStimName");
};

getCurrentUnitNumber = function () {
    return Session.get("currentUnitNumber");
};

getCurrentTdfName = function () {
    return Session.get("currentTdfName");
};

getCurrentTdfFile = function () {
    return Tdfs.findOne({fileName: getCurrentTdfName()});
};

getCurrentTdfUnit = function () {
    var thisTdf = getCurrentTdfFile();
    if (!thisTdf) {
        return null;
    }

    var currUnit = null;
    if (typeof thisTdf.tdfs.tutor.unit !== "undefined") {
        var unitIdx = getCurrentUnitNumber();
        currUnit = thisTdf.tdfs.tutor.unit[unitIdx];
    }

    return currUnit || null;
};

//Return the delivery parms for the current unit. Note that we provide default
//values AND eliminate the single-value array issue from our XML-2-JSON mapping
getCurrentDeliveryParams = function () {
    //Note that we will only extract values that have a specified default
    //value here.
    var deliveryParams = {
        purestudy: 0,
        skipstudy: false,
        reviewstudy: 0,
        correctprompt: 0
    };

    var xlateBool = function(v) {
        return  v ? Helpers.trim(v).toLowerCase() === "true" : false;
    };

    var xlations = {
        purestudy: Helpers.intVal,
        skipstudy: xlateBool,
        reviewstudy: Helpers.intVal,
        correctprompt: Helpers.intVal
    };

    var currUnit = getCurrentTdfUnit();
    var modified = false;
    var fieldName; //Used in loops below

    if (!!currUnit) {
        var found = null;
        try {
            found = Helpers.firstElement(currUnit.deliveryparams);
        }
        catch(err) {
            //Nothing - we don't a unit or the unit doesn't have del parms
        }

        if (found) {
            for(fieldName in deliveryParams) {
                var fieldVal = Helpers.firstElement(found[fieldName]);
                if (fieldVal) {
                    deliveryParams[fieldName] = fieldVal;
                    modified = true;
                }
            }
        }
    }

    //If we changed anything from the default, we should make sure
    //everything is properly xlated
    if (modified) {
        for(fieldName in deliveryParams) {
            var currVal = deliveryParams[fieldName];
            var xlation = xlations[fieldName];
            deliveryParams[fieldName] = xlation(currVal);
        }
    }

    return deliveryParams;
};

//Return the current button order as an array
getCurrentTdfButtonOrder = function () {
    //Our default value
    var btnOrder = [];

    try {
        var file = getCurrentTdfFile();
        if (file && file.tdfs.tutor.setspec[0].buttonorder) {
            var btnOrderTxt = file.tdfs.tutor.setspec[0].buttonorder;
            btnOrder = (btnOrderTxt + '').split(",");
            if (!btnOrder || !btnOrder.length) {
                btnOrder = []; //Just use empty array
            }
        }
    }
    catch(e) {
        console.log("Error find button order (will use []): " + e);
    }

    return btnOrder;
};
