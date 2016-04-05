Template.itemStats.helpers({
   username: function () {
      if (!haveMeteorUser()) {
         routeToSignin();
      }
      else {
         return Meteor.user().username;
      }
   },
   itemDataLat: function () {
      return generateItemGraphData(Session.get('currItem'), buildTdfDBName(getCurrentTdfName()), false);
   },
   itemDataCor: function () {
      return generateItemGraphData(Session.get('currItem'), buildTdfDBName(getCurrentTdfName()), true);
   },

});

Template.itemStats.events({
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

   'click .adminLink' : function (event) {
      event.preventDefault();
      Router.go("/admin");
   },

   'click .allItemsLink' : function (event) {
      event.preventDefault();
      Router.go("/allItems");
   }

   //This file will later house the logic for the graphs and metrics for the item

});

Template.itemStats.rendered = function () {

   // Find out the length of the array returned from the specified function.
   var itemDataLatLeng = Template.itemStats.__helpers[" itemDataLat"]().length;
   // Auto populate an array from 0 to length of specified function.
   var itemDataLatRes = [];
   for (var i = 1; i <= itemDataLatLeng; i++) {
      itemDataLatRes.push(i);
   }
   // Repeat above.
   var itemDataCorLeng = Template.itemStats.__helpers[" itemDataCor"]().length;
   var itemDataCorRes = [];
   for (var i = 1; i <= itemDataCorLeng; i++) {
      itemDataCorRes.push(i);
   }

   new Chartist.Line('#reptitionLatency', {
      labels: itemDataLatRes,
      series: [
         Template.itemStats.__helpers[" itemDataLat"]()
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
      labels: itemDataCorRes,
      series: [
         Template.itemStats.__helpers[" itemDataCor"]()
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
