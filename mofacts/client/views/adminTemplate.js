//TODO: everything in this template

Template.adminTemplate.rendered = function() {
}

Template.adminTemplate.helpers({
   results: function() {
       var test = UserProgress.findOne({username: 'wscarter'});
       return test.username;
   }
});
