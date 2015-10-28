////////////////////////////////////////////////////////////////////////////
// Template storage and helpers

//None currently

////////////////////////////////////////////////////////////////////////////
// Template events

Template.contentUpload.events({
    // Admin/Teachers - upload a TDF file
    'click #doUploadTDF': function(event) {
        event.preventDefault();

        _.each($("#upload-tdf").prop("files"), function(file) {
            var name = file.name;
            var fileReader = new FileReader();
            fileReader.onload = function() {
                console.log("Upload attempted for", name, "RESULT:", fileReader.result);
                Meteor.call('saveContentFile', 'tdf', name, file.srcElement.result, function(error, result) {
                    if (!!error) {
                        console.log("Critical failure saving TDF", error);
                        alert("There was a critical failure saving your TDF:" + error);
                    }
                    else if (!result.result) {
                        console.log("TDF saved failed", result);
                        alert("The TDF was not saved: " + errmsg);
                    }
                    else {
                        console.log("TDF Saved:", result);
                        alert("You TDF was saved");
                    }
                });
            };
            fileReader.readAsBinaryString(file);
        });
    },

    // Admin/Teachers - upload a Stimulus file
    'click #doUploadStim': function(event) {
        event.preventDefault();

        _.each($("#upload-stim").prop("files"), function(file) {
            var name = file.name;
            var fileReader = new FileReader();
            fileReader.onload = function() {
                console.log("Upload attempted for", name, "RESULT:", fileReader.result);
                Meteor.call('saveContentFile', 'stim', name, file.srcElement.result, function(error, result) {
                    if (!!error) {
                        console.log("Critical failure saving stim", error);
                        alert("There was a critical failure saving your Stimulus file:" + error);
                    }
                    else if (!result.result) {
                        console.log("Stim saved failed", result);
                        alert("The Stimulus file was not saved: " + errmsg);
                    }
                    else {
                        console.log("Stim Saved:", result);
                        alert("You Stimulus file was saved");
                    }
                });
            };
            fileReader.readAsBinaryString(file);
        });
    },
});
