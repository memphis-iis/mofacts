//TODO: download experiment data from TDF list selection (using experiment_times.js)

Template.adminTemplate.rendered = function() {
};

Template.adminTemplate.helpers({
   results: function() {
       return Meteor.user();
   }
});
