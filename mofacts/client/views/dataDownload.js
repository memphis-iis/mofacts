Template.dataDownload.rendered = function () {
  $("#expDataDownloadContainer").html("");

  var allTdfs = Tdfs.find({});

  var isAdmin = Roles.userIsInRole(Meteor.user(), ["admin"]);

  //Check all the valid TDF's
  allTdfs.forEach( function (tdfObject) {
      // Show data download - note that this happens regardless of userselect
      if (Meteor.userId() === tdfObject.owner || isAdmin) {
          var disp = name;
          if (tdfObject.fileName != name) {
              disp += " (" + tdfObject.fileName + ")";
          }

          $("#expDataDownloadContainer").append(
              $("<div></div>").append(
                  $("<a class='exp-data-link' target='_blank'></a>")
                      .attr("href", "/experiment-data/" + tdfObject.fileName +"/datashop")
                      .text("Download: " + disp)
              )
          );
      }
  });

  $("#expDataDownloadContainer").append(
      $("<div></div>").append(
          $("<legend class='text-center'>User Cloze Edits</legend>")
      )
  );

  if(isAdmin){
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
  }else{
    console.log("not an admin, not display cloze edits");
  }


};
