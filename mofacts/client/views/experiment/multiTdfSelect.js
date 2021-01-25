////////////////////////////////////////////////////////////////////////////
// Template storage and helpers

Template.multiTdfSelect.helpers({
    
});

////////////////////////////////////////////////////////////////////////////
// Template Events

Template.multiTdfSelect.events({
    // Start a Sub TDF
    'click .subTdfButton' : function (event) {
        event.preventDefault();
        console.log(event);

        var target = $(event.currentTarget);
        selectSubTdf(
            target.data("lessonName"),
            target.data("clusterList"),
            target.data("subTdfIndex")
        );
    },
});

Template.multiTdfSelect.rendered = function () {
    const currentTdfName = Session.get("currentTdfName");
    //this is called whenever the template is rendered.
    const subTdfs = Session.get("currentTdfFile").subTdfs;

    $("#expDataDownloadContainer").html("");

    //Check all the valid TDF's
    subTdfs.forEach( function (subTdfObject,index) {
        let lessonName = subTdfObject.lessonName;
        let clusterList = subTdfObject.clusterList;

        addSubTdfButton(
            $("<button type='button' name='"+lessonName+"'>")
                .addClass("btn btn-block btn-responsive subTdfButton")
                .data("lessonName", lessonName)
                .data("clusterList", clusterList)
                .data("subTdfIndex",index)
                .html(lessonName)
        );
    });
};

function addSubTdfButton(btnObj){
    console.log("ADD BUTTON CALLED: " + JSON.stringify(btnObj));
    var container = "<div class='col-xs-12 col-sm-12 col-md-3 col-lg-3 text-center'><br></div>";
    container = $(container).prepend('<p style="display:inline-block">&nbsp;&nbsp;&nbsp;</p>');
    container = $(container).prepend(btnObj);
    $("#testButtonContainer").append(container);
}

//Actual logic for selecting and starting a TDF
function selectSubTdf(lessonName, clusterList, subTdfIndex) {
    console.log("Selected subtdf: " + lessonName + " with clusterList: " + clusterList + " and subTdfIndex: " + subTdfIndex);

    Session.set("subTdfIndex",subTdfIndex);

    //Save the test selection event
    recordUserTime("multiTdfSelect subtdf selection", {
        subTdfTarget: lessonName,
        clusterList: clusterList,
        subTdfIndex: subTdfIndex,
    });

    Router.go("/card");
}
