Template.student.helpers({
   username: function () {
      if (!haveMeteorUser()) {
         routeToSignin();
      }
      else {
         return Meteor.user().username;
      }
   },
   studentDataLat: function () {
      return generateStudentGraphData(Session.get('currStudent'), buildTdfDBName(getCurrentTdfName()), false);
   },
   studentDataCor: function () {
      return generateStudentGraphData(Session.get('currStudent'), buildTdfDBName(getCurrentTdfName()), true);
   },
   classDataLat: function () {
      return generateClassGraphData(buildTdfDBName(getCurrentTdfName()), false);
   },
   classDataCor: function() {
      return generateClassGraphData(buildTdfDBName(getCurrentTdfName()), true);
   }
});

Template.student.events({
   'click .switchGraph': function (e) {
      e.preventDefault();
      if (document.getElementById("reptitionLatency").style.display == "none") {
         document.getElementById("reptitionLatency").style.display="block";
         document.getElementById("reptitionCorrectness").style.display="none";
      }
      else {
         document.getElementById("reptitionLatency").style.display="none";
         document.getElementById("reptitionCorrectness").style.display="block";
         document.getElementById("reptitionCorrectness").style.visibility="visible";
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

   // Find out the length of the array returned from the specified function.
   var studentDataLatLeng = Template.student.__helpers[" studentDataLat"]().length;
   // Auto populate an array from 0 to length of specified function.
   var studentDataLatRes = [];
   for (var i = 1; i <= studentDataLatLeng; i++) {
      studentDataLatRes.push(i);
   }
   // Repeat above.
   var studentDataCorLeng = Template.student.__helpers[" studentDataCor"]().length;
   var studentDataCorRes = [];
   for (var i = 1; i <= studentDataCorLeng; i++) {
      studentDataCorRes.push(i);
   }

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
      fullWidth: true,
      height: 300,
      axisY: {
         onlyInteger: true,
         offset: 50
      },
      lineSmooth: false
   });
}
