Session.set("tdfs",[]);
Session.set("curStudentPerformance",{});

curTdf = "";
loadedLabels = false;
const numTrialsForKCLearningCurve = 5;

getStimProbs = function(){
  //We've selected the "All" tdf option
  if(Session.get("currentStimName") === null){
    var allTdfProbs = [];
    Tdfs.find({}).forEach(function(curTdf){
      console.log(curTdf);
      Session.set("currentTdfName",curTdf.fileName);
      if(!!getCurrentTdfFile().tdfs.tutor.setspec[0].stimulusfile){
        Session.set("currentStimName",getCurrentTdfFile().tdfs.tutor.setspec[0].stimulusfile[0]);
        var tempModelUnitEngine = createModelUnit();
        var totalStimProb = 0;
        var cardProbs = tempModelUnitEngine.getCardProbs();
        for(var i=0;i<cardProbs.length;i++){
          if(!!cardProbs[i].probability){
            totalStimProb += cardProbs[i].probability;
          }
        }

        var avgStimProbForTdf = totalStimProb / cardProbs.length;
        console.log(avgStimProbForTdf);
        allTdfProbs.push(avgStimProbForTdf);
      }else{
        allTdfProbs.push(0);
      }
    });
    Session.set("currentStimName",null);
    Session.set("currentTdfName",null);
    return allTdfProbs;
  }else{
    var tempModelUnitEngine = createModelUnit();
    var stimProbs = [];
    var cardProbs = tempModelUnitEngine.getCardProbs();
    for(var i=0;i<cardProbs.length;i++){
        stimProbs.push(cardProbs[i].probability);
    }

    return stimProbs;
  }
}

getAvgCorrectnessAcrossKCsLearningCurve = function(){
  var avgCorrectnessAcrossKCsLearningCurve = [];

  var countAndNumCorrectPerTrialNum = {};

  for(var i=0;i<numTrialsForKCLearningCurve;i++){
    countAndNumCorrectPerTrialNum[i] = {"count":0,"numCorrect":0};
  }

  var tdfQueryName = curTdf;

  UserMetrics.find({"_id":Meteor.user()._id}).forEach(function(entry){
    test = entry;
    for(var tdf in entry){
      //Make sure we filter out keys that aren't tdfs
      if(tdf.indexOf(tdfQueryName) != -1){
        var currentData = entry[tdf];
        for(var kc in currentData){
          if(!!currentData[kc] && currentData[kc].answerCorrect){
            var trialData = currentData[kc].answerCorrect;
            for(var i=0;i<trialData.length && i < numTrialsForKCLearningCurve;i++){
              var trialResult = trialData[i];
              if(trialResult){
                countAndNumCorrectPerTrialNum[i]['numCorrect'] += 1;
              }
              countAndNumCorrectPerTrialNum[i]['count'] += 1;
            }
          }
        }
      }
    }
  });

  for(var i=0;i<numTrialsForKCLearningCurve;i++){
    var count = countAndNumCorrectPerTrialNum[i].count;
    var numCorrect = countAndNumCorrectPerTrialNum[i].numCorrect;
    var avg = 0;
    if(count > 0){
      avg = numCorrect / count;
    }
    avgCorrectnessAcrossKCsLearningCurve.push(avg);
  }

  return avgCorrectnessAcrossKCsLearningCurve;
}

Template.studentReporting.helpers({
  tdfs: function(){
    return Session.get("tdfs");
  },

  curStudentPerformance: function(){
    return Session.get("curStudentPerformance");
  },

  studentUsername: function(){
    //If we're navigating from the teacher reporting page we'll set the
    //studentUsername session variable.  Otherwise just display the info for the
    //current user
    return Session.get("studentUsername") || Meteor.user().username;
  }
});

Meteor.subscribe('tdfs',function () {
  Session.set("tdfs",getAllTdfs());
});

Template.studentReporting.onRendered(function(){
  console.log("rendered!!!");
  if($("#tdf-select").val() !== "invalid" && $("#tdf-select").val() !== null){
    updateDataAndCharts($("#tdf-select").val());
  }
});

Template.studentReporting.events({
  "change #tdf-select": function(event, template){
    if(!loadedLabels){
      $("#correctnessChart").attr('data-x-axis-label','Trial Number');
      $("#correctnessChart").attr('data-y-axis-label','Correctness (%)');

      $("#stimProbsChart").attr('data-x-axis-label','Probability');
      $("#stimProbsChart").attr('data-y-axis-label',"Stim Number");

      loadedLabels = true;
    }
    curTdf = $(event.currentTarget).val().replace(".","_");
    updateDataAndCharts($(event.currentTarget).val());
  }
});

updateDataAndCharts = function(curTdfName){
  console.log("curTdfName: " + curTdfName);
  Session.set("currentTdfName",curTdfName);
  if(curTdf === "xml" || !curTdf){
    Session.set("currentStimName",null);
  }else{
    Session.set("currentStimName",getCurrentTdfFile().tdfs.tutor.setspec[0].stimulusfile[0]);
  }

  var studentUsername = "";
  var studentID = "";
  if (Roles.userIsInRole(Meteor.user(), ["admin","teacher"])){
    studentUsername = Template.studentReporting.__helpers[" studentUsername"]();
    studentID = translateUsernameToID(studentUsername);
  }else{
    studentUsername = Meteor.user().username;
    studentID = Meteor.user()._id;
  }

  Session.set("curStudentPerformance",getStudentPerformance(studentUsername,studentID,curTdf));

  drawCharts();
}

safeSeries = function(series) {
    if (!series || series.length < 1)
        return series;

    while (series.length < 2) {
        series.push(null);  // null are missing points
    }
    return series;
}

drawCharts = function () {
    // Get our series and populate a range array for chart labeling
    var correctSeries = safeSeries(getAvgCorrectnessAcrossKCsLearningCurve());
    probSeries = safeSeries(getStimProbs());

    var itemDataCorRes = _.range(1, correctSeries.length+1);  // from 1 to len
    var itemDataProbRes = [];

    //"All" selected, so we should put labels of each tdf on the chart instead
    //of just numbers
    if(Session.get("currentTdfName") === null){
        Tdfs.find({}).forEach(function(tdf){
          itemDataProbRes.push(tdf.fileName.replace('-',''));
        })
        $("#stimProbsChart").css("margin-left", "20%");
    }else{
        itemDataProbRes = _.range(1, probSeries.length+1);
        $("#stimProbsChart").css("margin-left", "0%");
    }

    // Now actually create the charts - but only if we can find the proper
    // elements and there is data to display
    var drawCorrectnessLine = function(targetSelector, labels, series, dataDescrip, chartConfig) {
        var target = $(targetSelector).get(0);
        if (!target) {
            return;
        }
        if (series.length < 1) {
            $(target)
                .removeClass("show-axis-labels")
                .html("<div class='nodata'>No " + dataDescrip + " data available</div>");
        }
        else {
            $(target).addClass("show-axis-labels");
            // Note that we provide some default values that can be overridden
            var chartData = {
                'labels': labels,
                'series': [series]
            };

            var fullConfig = _.extend({
                low: 0,
                fullWidth: true,
                height: 300,
                lineSmooth: false
            }, chartConfig);

            new Chartist.Line(target, chartData, fullConfig);
        }
    };

    drawProbBars = function(targetSelector, labels, series, dataDescrip, chartConfig) {
        var target = $(targetSelector).get(0);
        if (!target) {
            return;
        }
        if (series.length < 1) {
            $(target)
                .removeClass("show-axis-labels")
                .html("<div class='nodata'>No " + dataDescrip + " data available</div>");
        }
        else {
            $(target).addClass("show-axis-labels").html("");
            // Note that we provide some default values that can be overridden
            var chartData = {
                'labels': labels,
                'series': [series]
            };

            var fullConfig = _.extend({
                low: 0,
                fullWidth: true
            }, chartConfig);

            new Chartist.Bar(target, chartData, fullConfig);
        }
    };

    drawCorrectnessLine('#correctnessChart', itemDataCorRes, correctSeries, "correctness", {
        high: 1,
        axisY: {
            onlyInteger: false
        }
    });

    drawProbBars('#stimProbsChart', itemDataProbRes, probSeries, "probabilities", {
      high: 1,
      seriesBarDistance: 5,
      height: (probSeries.length * 16),
      horizontalBars: true,
      axisX:{
        labelInterpolationFnc: function(value, index) {
          return index % 2 === 0 ? value : null;
        }
      }
    });
};
