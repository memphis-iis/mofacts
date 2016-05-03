Template.student.helpers({
   username: function () {
      if (!haveMeteorUser()) {
         routeToSignin();
      }
      else {
         return Meteor.user().username;
      }
   },

   selectedUsername: function () {
      return (Roles.userIsInRole(Meteor.user(), ["admin", "teacher"]))? Session.get('currStudent') : Meteor.user()._id;
   },

   studentDataLat: function () {
      var user = (Roles.userIsInRole(Meteor.user(), ["admin", "teacher"]))? Session.get('currStudent') : Meteor.user()._id;
      var studentDataLatVar = generateStudentGraphData(user, buildTdfDBName(getCurrentTdfName()), false);
      studentDataLatVar.unshift(7500);
      return studentDataLatVar;

   },

   studentDataCor: function () {
      var user = (Roles.userIsInRole(Meteor.user(), ["admin", "teacher"]))? Session.get('currStudent') : Meteor.user()._id;
      var studentDataCorVar = generateStudentGraphData(user, buildTdfDBName(getCurrentTdfName()), true);
      studentDataCorVar.unshift(0);
      return studentDataCorVar;
   },

   classDataLat: function () {
      var classDataLatVar = generateClassGraphData(buildTdfDBName(getCurrentTdfName()), false);
      classDataLatVar.unshift(7500);
      return classDataLatVar;
   },

   classDataCor: function () {
      var classDataCorVar = generateClassGraphData(buildTdfDBName(getCurrentTdfName()), true);
      classDataCorVar.unshift(0);
      return classDataCorVar;
   },
		itemData: function () {
				var user = (Roles.userIsInRole(Meteor.user(), ["admin", "teacher"]))? Session.get('currStudent') : Meteor.user()._id;
				return generateStudentPerItemData(user, buildTdfDBName(getCurrentTdfName()));
		},
		// studentName: function() {
		// 		var query = {};
		// 		query['_id'] = Session.get('currStudent');
		// 		query['username'] = true;
		// 		return Meteor.users.findOne(query)['username'];
		// }
});

Template.student.events({
   'click .switchButton': function (event) {
      event.preventDefault();
      drawChart();
      if (document.getElementById("reptitionLatency").style.display == "none") {
         document.getElementById("reptitionLatency").style.display="block";
         document.getElementById("reptitionLatencyTitle").style.display="block";
         document.getElementById("reptitionCorrectness").style.display="none";
         document.getElementById("reptitionCorrectnessTitle").style.display="none";
      }
      else {
         document.getElementById("reptitionLatency").style.display="none";
         document.getElementById("reptitionLatencyTitle").style.display="none";
         document.getElementById("reptitionCorrectness").style.display="block";
         document.getElementById("reptitionCorrectnessTitle").style.display="block";
      }
   },

   'click .logoutLink' : function (event) {
      event.preventDefault();
      Meteor.logout( function (error) {
         if (typeof error !== "undefined") {
            //something happened during logout
            console.log("User:", Meteor.user(), "Error:", error);
         }
         else {
            routeToSignin();
         }
      });
   },

   'click .homeLink' : function (event) {
      event.preventDefault();
      Router.go("/profile");
   },

   'click .allItemsLink' : function (event) {
      event.preventDefault();
      Router.go("/allItems");
   },

   'click .allStudentsLink' : function (event) {
      event.preventDefault();
      Router.go("/allStudents");
   },

   'click .adminLink' : function (event) {
      event.preventDefault();
      Router.go("/admin");
   },

   //This is where the meterics and graphs for the individual student will be housed later

});

Template.student.rendered = function () {
   Tracker.autorun(function(){
      drawChart();
   })
}

var drawChart = function () {

   // Find out the length of the array returned from the specified function.
   var studentDataLatLeng = Template.student.__helpers[" studentDataLat"]().length;
   // Auto populate an array from 0 to length of specified function.
   var studentDataLatRes = [];
   for (var i = 0; i <= studentDataLatLeng; i++) {
      studentDataLatRes.push(i);
   }
   // Repeat above.
   var studentDataCorLeng = Template.student.__helpers[" studentDataCor"]().length;
   var studentDataCorRes = [];
   for (var i = 0; i <= studentDataCorLeng; i++) {
      studentDataCorRes.push(i);
   }

   if (Roles.userIsInRole(Meteor.user(), ["admin", "teacher"])) {

      new Chartist.Line('#reptitionLatency', {
         labels: studentDataLatRes,
         series: [
            Template.student.__helpers[" studentDataLat"](),
            Template.student.__helpers[" classDataLat"]()
         ]
      }, {
         low: 0,
         fullWidth: true,
         height: 300,
         axisY: {
            onlyInteger: true,
            offset: 50
         },
         lineSmooth: false
      });

      new Chartist.Line('#reptitionCorrectness', {
         labels: studentDataCorRes,
         series: [
            Template.student.__helpers[" studentDataCor"](),
            Template.student.__helpers[" classDataCor"]()
         ]
      }, {
         high: 1,
         low: 0,
         fullWidth: true,
         height: 300,
         axisY: {
            onlyInteger: false,
            offset: 50
         },
         lineSmooth: false
      });
   } else {
      new Chartist.Line('#reptitionLatency', {
         labels: studentDataLatRes,
         series: [
            Template.student.__helpers[" studentDataLat"]()
         ]
      }, {
         low: 0,
         fullWidth: true,
         height: 300,
         axisY: {
            onlyInteger: true,
            offset: 50
         },
         lineSmooth: false
      });

      new Chartist.Line('#reptitionCorrectness', {
         labels: studentDataCorRes,
         series: [
            Template.student.__helpers[" studentDataCor"]()
         ]
      }, {
         low: 0,
         high: 1,
         fullWidth: true,
         height: 300,
         axisY: {
            onlyInteger: false,
            offset: 50
         },
         lineSmooth: false
      });
   }
}
