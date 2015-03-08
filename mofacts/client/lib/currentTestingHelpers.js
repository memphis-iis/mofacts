/* client/lib/currentTestingHelpers.js
 *
 * Client-side helper functions for getting current information about testing
 * and/or the current trial. Much of this functionality began in cardTemplate.js
 * but has been moved here for easier use. See also lib/sessionUtils.js for
 * a better list of Session variables we currently use.
 * */

//Return the total number of stim clusters
getStimClusterCount = function() {
    return Stimuli.findOne({fileName: getCurrentStimName()})
        .stimuli.setspec.clusters[0].cluster.length;
};

//Return the current stim file cluster
getStimCluster = function (index) {
    //TODO: take into account init (before units) shuffle/swap for clusters
    return Stimuli.findOne({fileName: getCurrentStimName()})
        .stimuli.setspec.clusters[0].cluster[index];
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

    if      (QType === "text")  QType = "T";    //T for Text
    else if (QType === "image") QType = "I";    //I for Image
    else if (QType === "sound") QType = "A";    //A for Audio
    else if (QType === "cloze") QType = "C";    //C for Cloze
    else                        QType = "NA";   //NA for Not Applicable

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

//Get units left to display/execute - note that the current unit isn't
//counted. Ex: if you have three units (0, 1, 2) and unit 1 is the current
//unit, then you have 1 unit remaining. If there are no units or there is
//we return 0
getUnitsRemaining = function() {
    var unitsLeft = 0;

    var thisTdf = getCurrentTdfFile();
    if (!!thisTdf) {
        var unitCount = 0;
        if (typeof thisTdf.tdfs.tutor.unit !== "undefined" && thisTdf.tdfs.tutor.unit.length) {
            unitCount = thisTdf.tdfs.tutor.unit.length;
        }
        if (unitCount > 0) {
            var unitIdx = getCurrentUnitNumber() || 0;
            unitsLeft = (unitCount - unitIdx) - 1;
            if (unitsLeft < 0) {
                unitsLeft = 0;
            }
        }
    }

    return unitsLeft;
};

//Return the delivery parms for the current unit. Note that we provide default
//values AND eliminate the single-value array issue from our XML-2-JSON mapping
//
//IMPORTANT: we also support selecting one of multiple delivery params via
//experimentXCond (which is specified in the URL)
getCurrentDeliveryParams = function () {
    //Note that we will only extract values that have a specified default
    //value here.
    var deliveryParams = {
        purestudy: 0,
        skipstudy: false,
        reviewstudy: 0,
        correctprompt: 0,
        lockoutminutes: 0,
    };

    var xlateBool = function(v) {
        return  v ? Helpers.trim(v).toLowerCase() === "true" : false;
    };

    var xlations = {
        purestudy: Helpers.intVal,
        skipstudy: xlateBool,
        reviewstudy: Helpers.intVal,
        correctprompt: Helpers.intVal,
        lockoutminutes: Helpers.intVal,
    };

    var currUnit = getCurrentTdfUnit();
    var modified = false;
    var fieldName; //Used in loops below

    if (!!currUnit) {
        var found = null;

        if (currUnit.deliveryparams && currUnit.deliveryparams.length) {
            //Note that if there is no XCond or if they specify something
            //wacky we'll just go with index 0
            var xcondIndex = Helpers.intVal(Session.get("experimentXCond"));
            if (xcondIndex < 0 || xcondIndex >= currUnit.deliveryparams.length) {
                xcondIndex = 0; //Incorrect index gets 0
            }
            found = currUnit.deliveryparams[xcondIndex];
        }

        //If found del params, then use any values we find
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
            if (xlation) {
                deliveryParams[fieldName] = xlation(currVal);
            }
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
