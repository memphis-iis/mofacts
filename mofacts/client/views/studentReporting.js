Session.set("studentReportingTdfs",[]);
Session.set("curStudentPerformance",{});

curTdf = "";
loadedLabels = false;
const numTrialsForKCLearningCurve = 5;

window.onpopstate = function(event){
  //console.log("back button pressed?" + document.location.pathname);
  Session.set("studentReportingTdfs",[]);
  Session.set("curStudentPerformance",{});
}

getStimProbs = function(){
  //We've selected the "All" tdf option
  if(Session.get("currentStimName") === null){
    var allTdfProbs = [];
    var allTdfProbLabels = [];
    var studentUsername = Template.studentReporting.__helpers[" studentUsername"]();
    var studentID = translateUsernameToID(studentUsername);
    UserMetrics.find({"_id":studentID}).forEach(function(entry){
      console.log("userMetric: " + JSON.stringify(entry));
      var possibleTdfs = _.filter(_.keys(entry), x => x.indexOf("_xml") != -1)
      for(var index in possibleTdfs){
        var possibleTdf = possibleTdfs[index];
        console.log(possibleTdf);
        if(possibleTdf.indexOf("_xml") != -1){
          var curTdfName = possibleTdf;
          var curTdf = entry[curTdfName];
          console.log(curTdf);
          var replacement = ".";
          curTdfName = curTdfName.replace(/_([^_]*)$/,replacement+'$1');
          Session.set("currentTdfName",curTdfName);
          if(!!getCurrentTdfFile() && !!getCurrentTdfFile().tdfs.tutor.setspec[0].stimulusfile){
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
            allTdfProbLabels.push(curTdfName.replace('-',''));
            allTdfProbs.push(avgStimProbForTdf);
          }
        }
      }
    });
    Session.set("currentStimName",null);
    Session.set("currentTdfName",null);
    return [allTdfProbLabels,allTdfProbs];
  }else{
    var tempModelUnitEngine = createModelUnit();
    var stimProbs = [];
    var stimProbsLabels = [];
    var cardProbs = tempModelUnitEngine.getCardProbs();
    for(var i=0;i<cardProbs.length;i++){
        stimProbsLabels.push(i+1);
        stimProbs.push(cardProbs[i].probability);
    }

    return [stimProbsLabels,stimProbs];
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
    return Session.get("studentReportingTdfs");
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

Template.studentReporting.onRendered(function(){
  Meteor.subscribe('userMetrics',function () {
    console.log("userMetrics!!!");
    var studentUsername = Template.studentReporting.__helpers[" studentUsername"]();
    console.log("studentUsername:" + studentUsername);
    var studentID = translateUsernameToID(studentUsername);
    if(studentID === undefined){
      Meteor.setTimeout(function(){
        studentID = translateUsernameToID(studentUsername);
        console.log("studentID: " + studentID)
        Session.set("studentReportingTdfs",getAllNamesOfTdfsAttempted(studentID));
      },200)
    }else{
        Session.set("studentReportingTdfs",getAllNamesOfTdfsAttempted(studentID));
    }
  });
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
    var curTdfFile = getCurrentTdfFile();
    if(!!curTdfFile){
      Session.set("currentStimName",curTdfFile.tdfs.tutor.setspec[0].stimulusfile[0]);
    }else{
      //Gracefully handle case where a tdf has been deleted
      Session.set("curStudentPerformance",{
        "username":studentUsername,
        "count":"N/A",
        "percentCorrect":"N/A",
        "numCorrect":"N/A",
        "totalTime":"N/A"
      });
      drawCharts(true);
      return;
    }
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

  drawCharts(false);
}

safeSeries = function(series) {
    if (!series || series.length < 1)
        return series;

    while (series.length < 2) {
        series.push(null);  // null are missing points
    }
    return series;
}

var drawCorrectnessLine = function(targetSelector, labels, series, dataDescrip, chartConfig) {
    var target = $(targetSelector).get(0);
    if (!target) {
        console.log("no target");
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

var drawProbBars = function(targetSelector, labels, series, dataDescrip, chartConfig) {
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

drawCharts = function (drawWithoutData) {
    if(!!drawWithoutData){
      drawCorrectnessLine('#correctnessChart', [], [], "correctness", {});

      drawProbBars('#stimProbsChart', [], [], "probabilities", {});
    }else{
      // Get our series and populate a range array for chart labeling
      var correctSeries = safeSeries(getAvgCorrectnessAcrossKCsLearningCurve());
      var rawProbs = getStimProbs();
      probSeries = safeSeries(rawProbs[1]);

      var itemDataCorRes = _.range(1, correctSeries.length+1);  // from 1 to len
      var itemDataProbRes = rawProbs[0];

      //"All" selected, so we should make room for labels bigger than just numbers
      if(Session.get("currentTdfName") === null){
          $("#stimProbsChart").css("margin-left", "20%");
      }else{
          $("#stimProbsChart").css("margin-left", "0%");
      }

      // Now actually create the charts - but only if we can find the proper
      // elements and there is data to display


      drawCorrectnessLine('#correctnessChart', itemDataCorRes, correctSeries, "correctness", {
          high: 1,
          axisY: {
              onlyInteger: false
          }
      });

      var probBarsHeight = Math.max((probSeries.length * 16),200);

      drawProbBars('#stimProbsChart', itemDataProbRes, probSeries, "probabilities", {
        high: 1,
        seriesBarDistance: 5,
        height: probBarsHeight,
        horizontalBars: true,
        axisX:{
          labelInterpolationFnc: function(value, index) {
            return index % 2 === 0 ? value : null;
          }
        }
      });
    }

};
