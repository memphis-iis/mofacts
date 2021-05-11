import { setStudentPerformance } from '../../lib/currentTestingHelpers';

Session.set("studentReportingTdfs",[]);
Session.set("curStudentPerformance",{});

Template.studentReporting.helpers({
  studentReportingTdfs: () => Session.get("studentReportingTdfs"),
  curClassPerformance: () => Session.get("curClassPerformance"),
  curClass: () => Session.get("curClass"),
  curStudentPerformance: () => Session.get("curStudentPerformance"),
  studentUsername: () => Session.get("studentUsername")
});

Template.studentReporting.rendered = async function(){
  window.onpopstate = function(event){
    console.log("window popstate student reporting");
    if(document.location.pathname == "/studentReporting" && Session.get("loginMode") === "southwest"){
      Router.go("/profileSouthwest");
    }else{
      Router.go("/profile");
    }
  }
  console.log("studentReporting rendered!!!");

  Session.set("studentReportingTdfs",[]);
  Tracker.afterFlush(async function(){
    console.log("afterFlush");

    let studentUsername = Session.get("studentUsername") || Meteor.user().username;
    let studentID = Session.get("curStudentID") || Meteor.userId();
    console.log("student,",studentUsername,studentID);

    const tdfsAttempted = await meteorCallAsync('getTdfIDsAndDisplaysAttemptedByUserId',studentID);
    Session.set("studentReportingTdfs",tdfsAttempted);
    console.log("studentReportingTdfs",tdfsAttempted);

    //let dataAlreadyInCache = false;
    if (Roles.userIsInRole(Meteor.user(), ["admin","teacher"])){
      console.log("admin/teacher");
      //dataAlreadyInCache = true;
    }else{
      Session.set("curStudentID",studentID);
      Session.set("studentUsername",studentUsername);
    }
    // if(tdfsAttempted.length == 1){
    //   Tracker.afterFlush(async function(){
    //     let tdfToSelect = Session.get("instructorSelectedTdf") || Session.get("studentReportingTdfs")[0].tdfid;
    //     $("#tdf-select").val(tdfToSelect);
    //     if($("#tdf-select").val() != null){
    //       let selectedTdfId = $("#tdf-select").val();
  
    //       //if(!dataAlreadyInCache){
    //         setStudentPerformance(studentID,studentUsername,selectedTdfId);
  
    //         let studentData = await meteorCallAsync('getStudentReportingData',studentID,selectedTdfId);
    //         console.log("studentData",studentData,studentID,studentUsername,selectedTdfId);
    //       //}
    //     }
    //   });
    // }
  });
};

Template.studentReporting.events({
  "change #tdf-select": async function(event){
    let selectedTdfId = $(event.currentTarget).val();
    console.log("change tdf select",selectedTdfId);
    if(selectedTdfId!=="invalid"){
      $('#tdf-select option[value="invalid"]').prop('disabled',true);
      let studentID = Session.get("curStudentID") || Meteor.userId();
      let studentUsername = Session.get("studentUsername") || Meteor.user().username;
  
      let studentData = await meteorCallAsync('getStudentReportingData',studentID,selectedTdfId);
      console.log("studentData",studentData);

      setStudentPerformance(studentID,studentUsername,selectedTdfId);
      drawCharts(studentData);
    }
  }
});

// Template.studentReporting.rendered = function(){
//   curTracker = Tracker.autorun(function(thisTracker){
//     if(document.location.pathname != "/studentReporting"){
//       console.log("navigated away from student reporting. stop tracker");
//       thisTracker.stop();
//     }
//     var user = Meteor.user();
//     if(!!user){
//       var studentUsername = "";
//       var studentID = "";
//       if (Roles.userIsInRole(Meteor.user(), ["admin","teacher"])){
//         console.log("admin/teacher");
//         studentUsername = Template.studentReporting.__helpers[" studentUsername"]();
//         if(studentUsername.indexOf("@") == -1){
//           studentUsername = studentUsername.toUpperCase();
//         }
//         Session.set("curStudentUsername",studentUsername);
//         Meteor.subscribe("specificUser",studentUsername,function(){
//           console.log("specificUser subscription done");
//           var student = Meteor.users.findOne({"username":studentUsername});
//           console.log("student: " + JSON.stringify(student));
//           if(!!student){
//             studentID = student._id;
//           }
//           Session.set("curStudentID",studentID);
//           console.log("studentUsername:" + studentUsername);
//           console.log("studentID:" + studentID);
//           Meteor.subscribe('specificUserTimesLog',studentID,function(){
//             currentUserTimeLogs = UserTimesLog.findOne({_id:studentID});
//             console.log("currentUserTimeLogs subscription done");
//             setTdfFileNamesAndDisplayValues();
//           });
//         });
//       }else{
//         studentUsername = Meteor.user().username;
//         studentID = Meteor.userId();

//         console.log("studentUsername:" + studentUsername);
//         console.log("studentID:" + studentID);
//         Session.set("curStudentUsername",studentUsername);
//         Session.set("curStudentID",studentID);
//         Meteor.subscribe('specificUserTimesLog',studentID,function(){
//           currentUserTimeLogs = UserTimesLog.findOne({_id:studentID});
//           console.log("currentUserTimeLogs subscription done");
//           setTdfFileNamesAndDisplayValues();
//         });
//       }
//     }
//   });
// };

function updateDataAndCharts(curTdf,curTdfFileName){
  console.log("curTdfFileName: " + curTdfFileName);
  var studentUsername = Session.get("curStudentUsername");
  $("#correctnessChart").attr('data-x-axis-label','Repetition Number');
  $("#correctnessChart").attr('data-y-axis-label','Correctness (%)');

  $("#cardProbsChart").attr('data-x-axis-label','Correctness (%)');
  if(curTdf === "xml" || !curTdf){
    console.log("updateDataAndCharts, setting currentStimName to null");
    $("#cardProbsChart").attr('data-y-axis-label',"Chapter");
  }else{
    $("#cardProbsChart").attr('data-y-axis-label',"");
  }
}

test = "";

function drawCharts(studentData) {
    $("#correctnessChart").attr('data-x-axis-label','Repetition Number');
    $("#correctnessChart").attr('data-y-axis-label','Correctness (%)');
    let {correctnessAcrossRepetitions,probEstimates} = studentData;
    // if(!!drawWithoutData){
    //   drawCorrectnessLine('#correctnessChart', [], [], "repetition", {});

    //   drawProbBars('#cardProbsChart', [], [], "probabilities", {});
    // }
    // Get our series and populate a range array for chart labeling
    let correctSeries = correctnessAcrossRepetitions.map(x => x.percentCorrect);
    let probSeries = probEstimates.map(x => x.probabilityEstimate);

    var itemDataCorLabels = _.range(1, correctSeries.length+1);  // from 1 to len
    var itemDataProbLabels = probEstimates.map(x => x.stimulus);
    var cardProbsChartAxisYOffset;

    //"All" selected, so we should make room for labels bigger than just numbers
    if(Session.get("curSelectedTdf") === "xml"){
        cardProbsChartAxisYOffset = 250;
        showYAxisLabel = true
    }else{
        cardProbsChartAxisYOffset = 50;
        showYAxisLabel = false;//
    }
    probBarsHeight = Math.max((probSeries.length * 10),200);

    // Now actually create the charts - but only if we can find the proper
    // elements and there is data to display

    drawCorrectnessLine('#correctnessChart', itemDataCorLabels, correctSeries, "repetition", {
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

function drawCorrectnessLine(targetSelector, labels, series, dataDescrip, chartConfig) {
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
      $(target).addClass("show-axis-labels").html("");;
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
}

function drawProbBars(targetSelector, labels, series, dataDescrip, chartConfig) {
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