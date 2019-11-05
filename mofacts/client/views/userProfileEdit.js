////////////////////////////////////////////////////////////////////////////
// Template helpers

function getProfileField(field) {
    var prof =  UserProfileData.findOne({_id:Meteor.userId()});
    if (!prof || typeof prof[field] === undefined)
        return null;
    return prof[field];
}

Template.userProfileEdit.helpers({
    use_sandbox: function() {
        return getProfileField('use_sandbox') ? "checked" : false;
    },

    have_aws_id: function() {
        return getProfileField('have_aws_id');
    },

    have_aws_secret: function() {
        return getProfileField('have_aws_secret');
    }
});

////////////////////////////////////////////////////////////////////////////
// Template events

Template.userProfileEdit.rendered = function () {
    //Init the modal dialog
    $('#profileWorkModal').modal({
        'backdrop': 'static',
        'keyboard': false,
        'show': false
    });

    Meteor.call('getClozeEditAuthors',function(err,res){
      if(!!err){
        console.log("error getting cloze edit authors: " + JSON.stringify(err));
      }else{
        console.log("got cloze edit authors");
        var authorIDs = res;
        _.each(_.keys(authorIDs),function(authorID){
          var disp = authorIDs[authorID] + " Cloze Edits";
          $("#expDataDownloadContainer").append(
              $("<div></div>").append(
                  $("<a class='exp-data-link' target='_blank'></a>")
                      .attr("href", "/clozeEditHistory/" + authorID)
                      .text("Download: " + disp)
              )
          );
        });
      }
    })
};

Template.userProfileEdit.events({
  // Admin/Teachers - save AWS profile data
  'click #saveProfile': function(event) {
    event.preventDefault();

    var data = {
      aws_id: $("#profileAWSID").val(),
      aws_secret_key: $("#profileAWSSecret").val(),
      use_sandbox: $("#profileUseSandbox").prop("checked")
    };

    $('#profileWorkModal').modal('show');

    Meteor.call("saveUserProfileData", data, function(error, serverReturn) {
      $('#profileWorkModal').modal('hide');
      console.log(serverReturn);

      if (!!error) {
        console.log("Error saving user profile", error);
        alert("Your changes were not saved! " + error);
      }

      else if (!serverReturn || !serverReturn.result) {
        console.log("Server failure while saving profile", serverReturn);
        alert("Your changes were not saved! The server said: " + JSON.stringify(serverReturn, null, 2));
      }
      else {
        console.log("Profile saved:", serverReturn);
        //Clear any controls that shouldn't be kept around
        $(".clearOnSave").val("");
        alert("Your profile changes have been saved: save details follow\n\n" + JSON.stringify(serverReturn, null, 2));
      }
    });
  },
});
