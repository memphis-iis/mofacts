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

    Tdfs.find().forEach(function(tdf) {
        console.log("Found", tdf.fileName); //TODO: remove
        if (userId === tdf.owner) {
            console.log("Inserting", tdf.fileName); //TODO: remove
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
        console.log("Found", stim.fileName); //TODO: remove
        if (userId === stim.owner) {
            console.log("Keeping", stim.fileName); //TODO: remove
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
                    console.log(fileDescrip + " saved failed", result);
                    alert("The " + fileDescrip + " file was not saved: " + errmsg);
                }
                else {
                    console.log(fileDescrip + " Saved:", result);
                    alert("You " + fileDescrip + " file was saved");
                }
            });
        };

        fileReader.readAsBinaryString(file);
    });

    console.log(fileType, ":", fileDescrip, "at ele", fileElementSelector, "scheduled", count, "uploads");
}
