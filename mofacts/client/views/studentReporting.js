Session.set("studentReportingTdfs",[]);
Session.set("curStudentPerformance",{});

loadedLabels = false;
const numTrialsForKCLearningCurve = 5;

window.onpopstate = function(event){
  Session.set("studentReportingTdfs",[]);
  Session.set("curStudentPerformance",{});
  if(Session.get("loginMode") === "southwest"){
    Router.go("/profileSouthwest");
  }else{
    Router.go("/profile");
  }
}

getcardProbs = function(){
  //We've selected the "All" tdf option
  if(Session.get("currentStimName") === null){
    var allTdfProbs = [];
    var allTdfProbLabels = [];
    var studentReportingTdfs = Session.get("studentReportingTdfs");

    for(var i=0;i<studentReportingTdfs.length;i++){
      var curTdfFileName = studentReportingTdfs[i].fileName;
      var curTdfDisplayName = studentReportingTdfs[i].displayName;
      Session.set("currentTdfName",curTdfFileName);
      console.log("curTdfFileName: " + curTdfFileName);
      if(!!getCurrentTdfFile() && !!getCurrentTdfFile().tdfs.tutor.setspec[0].stimulusfile){
        Session.set("currentStimName",getCurrentTdfFile().tdfs.tutor.setspec[0].stimulusfile[0]);

        var tempModelUnitEngine = createModelUnit();
        var expKey = Session.get("currentTdfName").replace('.','_');
        processUserTimesLog(true,expKey,tempModelUnitEngine);
        var totalStimProb = 0;
        var cardProbs = tempModelUnitEngine.getCardProbs();
        console.log("past getCardProbs");
        for(var j=0;j<cardProbs.length;j++){
          if(!!cardProbs[j].probability){
            totalStimProb += cardProbs[j].probability;
          }
        }

        var avgStimProbForTdf = totalStimProb / cardProbs.length;
        allTdfProbLabels.push(curTdfDisplayName.replace(" ",'_'));
        allTdfProbs.push(avgStimProbForTdf);
      }
    }
    Session.set("currentStimName",null);
    Session.set("currentTdfName",null);
    return [allTdfProbLabels,allTdfProbs];
  }else{
    tempModelUnitEngine = createModelUnit();
    var expKey = Session.get("currentTdfName").replace('.','_');
    processUserTimesLog(true,expKey,tempModelUnitEngine);
    var cardProbs = [];
    var cardProbsLabels = [];
    var mycardProbs =tempModelUnitEngine.getCardProbs();
    for(var i=0;i<mycardProbs.length;i++){
        var cardIndex = mycardProbs[i].cardIndex;
        var stimIndex = mycardProbs[i].stimIndex;
        var currentQuestion = fastGetStimQuestion(cardIndex,stimIndex);
        cardProbsLabels.push(currentQuestion);
        cardProbs.push(mycardProbs[i].probability);
    }

    return [cardProbsLabels,cardProbs];
  }
}

getAvgCorrectnessAcrossKCsLearningCurve = function(){
  var avgCorrectnessAcrossKCsLearningCurve = [];

  var countAndNumCorrectPerTrialNum = {};

  for(var i=0;i<numTrialsForKCLearningCurve;i++){
    countAndNumCorrectPerTrialNum[i] = {"count":0,"numCorrect":0};
  }

  var tdfQueryName = curTdf;

  UserMetrics.find({"_id":studentID}).forEach(function(entry){
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
    if(count > 0){
      var avg = numCorrect / count;
      avgCorrectnessAcrossKCsLearningCurve.push(avg);
    }
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

setTdfFileNamesAndDisplayValues = function(studentID){
  console.log("setTdfFileNamesAndDisplayValues, studentID: " + studentID);
  namesOfTdfsAttempted = getAllNamesOfTdfsAttempted(studentID);
  studentReportingTdfs = [];
  Meteor.subscribe('tdfs',function(){
    Tdfs.find({}).forEach(function(entry){
      var fileName = entry.fileName;
      var displayName = entry.tdfs.tutor.setspec[0].lessonname[0];
      if(namesOfTdfsAttempted.indexOf(fileName) != -1){
        studentReportingTdfs.push({'fileName':fileName,'displayName':displayName});
      }
    });

    Session.set('studentReportingTdfs',studentReportingTdfs);
  });
}

selectFirstOptionByDefaultAndUpdateCharts = function(){
  console.log("selectFirstOptionByDefaultAndUpdateCharts");
   var tdfs = Session.get("studentReportingTdfs");

   //Have to wait for DOM to update after studentReportingTdfs is set
   Tracker.afterFlush(function(){
     console.log("selectFirstOptionByDefaultAndUpdateCharts, tdfs: " + JSON.stringify(tdfs));
     if(!!tdfs[0]){
       var firstIndividualTdf = tdfs[0].fileName;
       $("#tdf-select").val(firstIndividualTdf);
       console.log("selectFirstOptionByDefaultAndUpdateCharts: " + $("#tdf-select").val());
       if($("#tdf-select").val() != null){
        curTdf = $("#tdf-select").val().replace(".","_");
        var curTdfFileName = $("#tdf-select").val();
        updateDataAndCharts(curTdf,curTdfFileName);
       }
     }
   });
}

Tracker.autorun(selectFirstOptionByDefaultAndUpdateCharts);

Template.studentReporting.onCreated(function(){
  console.log("created!!!");
  Meteor.subscribe('userMetrics',function () {
    console.log("usermetrics ready!!!");
    //var studentReportingTdfs = [];
    var studentUsername = Template.studentReporting.__helpers[" studentUsername"]();
    console.log("studentUsername:" + studentUsername);
    Meteor.call('usernameToIDMap',function(err,res){
      console.log("usernameToIDMap loaded 1");
      if(!!err){
        console.log("ERROR getting usernameToIDMap: " + err);
      }else{
        usernameToIDMap = res;
        studentID = translateUsernameToID(studentUsername);
        setTdfFileNamesAndDisplayValues(studentID);
      }
    });
  });
});

Template.studentReporting.onRendered(function(){
  console.log("rendered!!!");
})

Template.studentReporting.events({
  "change #tdf-select": function(event, template){
    console.log("change tdf select");
    curTdf = $(event.currentTarget).val().replace(".","_");
    var curTdfFileName = $(event.currentTarget).val();
    updateDataAndCharts(curTdf,curTdfFileName);
  }
});

updateDataAndCharts = function(curTdf,curTdfFileName){
  console.log("curTdfFileName: " + curTdfFileName);
  $("#correctnessChart").attr('data-x-axis-label','Repetition Number');
  $("#correctnessChart").attr('data-y-axis-label','Correctness (%)');

  $("#cardProbsChart").attr('data-x-axis-label','Correctness (%)');
  if(curTdf === "xml" || !curTdf){
    Session.set("currentStimName",null);
    $("#cardProbsChart").attr('data-y-axis-label',"Chapter");
  }else{
    $("#cardProbsChart").attr('data-y-axis-label',"");

    Session.set("currentTdfName",curTdfFileName);
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
    return series;
}

var drawCorrectnessLine = function(targetSelector, labels, series, dataDescrip, chartConfig) {
    var target = $(targetSelector).get(0);
    if (!target) {
        console.log("no target");
        return;
    }
    if (series.length < 2) {
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

        lookUpLabelByDataValue = function(value){
          return labels[series.findIndex(function(element){
            return element == value;
          })];
        }

        var fullConfig = _.extend({
            low: 0,
            fullWidth: true,
        }, chartConfig);

        new Chartist.Bar(target, chartData, fullConfig).on("draw", function(data) {
          test = data;
          if (data.type === "bar") {
        		data.element._node.setAttribute("title", "Item: " + lookUpLabelByDataValue(data.value) + " Value: " + data.value.toFixed(2));
        		data.element._node.setAttribute("data-chart-tooltip", target);
        	}
        }).on("created", function() {
        	// Initiate Tooltip
        	$(target).tooltip({
        		selector: '[data-chart-tooltip="'+target+'"]',
        		container: target,
        		html: true
        	});
        });
    }
}

test = "";

drawCharts = function (drawWithoutData) {
    if(!!drawWithoutData){
      drawCorrectnessLine('#correctnessChart', [], [], "correctness", {});

      drawProbBars('#cardProbsChart', [], [], "probabilities", {});
    }else{
      // Get our series and populate a range array for chart labeling
      var correctSeries = safeSeries(getAvgCorrectnessAcrossKCsLearningCurve());
      correctSeries = correctSeries.map(function(val){return val*100});
      var rawProbs = getcardProbs();
      probSeries = safeSeries(rawProbs[1]);
      probSeries = probSeries.map(function(val){return val*100}).reverse();

      var itemDataCorLabels = _.range(1, correctSeries.length+1);  // from 1 to len
      var itemDataProbLabels = rawProbs[0].reverse();
      var cardProbsChartAxisYOffset;

      //"All" selected, so we should make room for labels bigger than just numbers
      if(Session.get("currentTdfName") === null){
          cardProbsChartAxisYOffset = 250;
          showYAxisLabel = true
          probBarsHeight = Math.max((probSeries.length * 10),200);
      }else{
          cardProbsChartAxisYOffset = 50;
          showYAxisLabel = false;//
          probBarsHeight = (probSeries.length * 10);
      }

      // Now actually create the charts - but only if we can find the proper
      // elements and there is data to display


      drawCorrectnessLine('#correctnessChart', itemDataCorLabels, correctSeries, "correctness", {
          height: 300,
          axisY: {
              type: Chartist.FixedScaleAxis,
              ticks: [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100],
              low: 0,
              high: 100
          }
      });

      drawProbBars('#cardProbsChart', itemDataProbLabels, probSeries, "probabilities", {
        seriesBarDistance: 0,
        height: probBarsHeight,
        horizontalBars: true,
        high: 100,
        axisX:{
          labelInterpolationFnc: function(value, index) {
            return value % 10 == 0 ? value : null;
          },
          position: 'start',
          onlyInteger: true,
          type: Chartist.AutoScaleAxis,
          scaleMinSpace: 10,
          low: 0,
        },
        axisY:{
          offset: cardProbsChartAxisYOffset,
          showLabel: showYAxisLabel
        }
      });
    }

};
