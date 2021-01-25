////////////////////////////////////////////////////////////////////////////
// Template helpers

var userFiles = new Mongo.Collection(null); //local-only - no database;

function clearUserFiles() {
    userFiles.remove({'temp': 1});
}

function userFilesRefresh() {
    clearUserFiles();

    var count = 0;
    var userId = Meteor.user()._id;

    Session.get("allTdfs").forEach(function(tdf) {
        if (userId === tdf.owner) {
            userFiles.insert({
                'temp': 1,
                '_id': tdf._id,
                'idx': count,
                'type': 'tdf',
                'fileName': _.chain(tdf).prop('fileName').trim().value()
            });

            count += 1;
        }
    });

    Stimuli.find().forEach(function(stim){
        if (userId === stim.owner) {
            userFiles.insert({
                'temp': 1,
                '_id': stim._id,
                'idx': count,
                'type': 'stim',
                'fileName': _.chain(stim).prop('fileName').trim().value()
            });

            count += 1;
        }
    });
}

Template.contentUpload.helpers({
    userFiles: function() {
        userFilesRefresh();
        return userFiles.find();
    },
});


////////////////////////////////////////////////////////////////////////////
// Template events

Template.contentUpload.events({
    // Admin/Teachers - upload a TDF file
    'click #doUploadTDF': function(event) {
        event.preventDefault();
        doFileUpload("#upload-tdf", "tdf", "TDF");
    },

    // Admin/Teachers - upload a Stimulus file
    'click #doUploadStim': function(event) {
        event.preventDefault();
        doFileUpload("#upload-stim", "stim", "Stimlus");
    },

    'change #upload-tdf': function(event) {
        let curFiles = Array.from($("#upload-tdf").prop("files"));
        let outputLabel = curFiles[0].name;
        if(curFiles.length > 1){
            outputLabel += " + " + (curFiles.length-1) + " more...";
        }
        $("#tdf-file-info").html(outputLabel);
    },

    'change #upload-stim': function(event) {
        let curFiles = Array.from($("#upload-stim").prop("files"));
        let outputLabel = curFiles[0].name;
        if(curFiles.length > 1){
            outputLabel += " + " + (curFiles.length-1) + " more...";
        }
        $("#stim-file-info").html(outputLabel);
    }
});


////////////////////////////////////////////////////////////////////////////
// Our main logic for uploading files

function doFileUpload(fileElementSelector, fileType, fileDescrip) {
    var count = 0;

    _.each($(fileElementSelector).prop("files"), function(file) {
        count += 1;

        var name = file.name;
        var fileReader = new FileReader();

        fileReader.onload = function() {
            console.log("Upload attempted for", name);

            Meteor.call('saveContentFile', fileType, name, fileReader.result, function(error, result) {
                if (!!error) {
                    console.log("Critical failure saving " + fileDescrip, error);
                    alert("There was a critical failure saving your " + fileDescrip + " file:" + error);
                }
                else if (!result.result) {
                    console.log(fileDescrip + " save failed", result);
                    alert("The " + fileDescrip + " file was not saved: " + result.errmsg);
                }
                else {
                    console.log(fileDescrip + " Saved:", result);
                    alert("Your " + fileDescrip + " file was saved");
                    //Now we can clear the selected file
                    $(fileElementSelector).val('');
                    $(fileElementSelector).parent().find('.file-info').html('');
                }
            });
        };

        fileReader.readAsBinaryString(file);
    });

    console.log(fileType, ":", fileDescrip, "at ele", fileElementSelector, "scheduled", count, "uploads");
}
