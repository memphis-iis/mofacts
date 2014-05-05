
//////////////
//  EVENTS  //
//////////////

Template.statsPageTemplate.events({
    'click #continueButton' : function () {
        Router.go("profile");
    },
    'click .logoutLink' : function () {
        Meteor.logout( function (error) {
            if (typeof error !== "undefined") {
                //something happened during logout
                console.log("User: " + Meteor.user() +" \n" +
                            "\tError: " + error + "\n");
            } else {
                Router.go("signin");
            }
        });
    },
    'click .homeLink' : function () {
        Router.go("profile");
    }
});

/////////////////
//  VARIABLES  //
/////////////////

Template.statsPageTemplate.username = function () {

    if (typeof Meteor.user() === "undefined") {
        Router.go("signin");
        window.location.reload();
        //the reload is needed because for some reason the page contents show up as
        //empty unless we do the reload.
        return;
    } else {
        return Meteor.user().username;
    }
}

Template.statsPageTemplate.rendered = function () {
    var results;
    var total = 0;
    var totalCorrect = 0;
    var userResponse;
    var theAnswer;
    var coloring = "\"black\"";

    Meteor.call("addtime");

    var statsGet = UserProgress.find(
        { _id: Meteor.userId() },
        {progressDataArray: 1});

    statsGet.forEach(function (Object){
        total = (Object.progressDataArray.length);
        

        for (var i = 0; i < total; i++) {
            userResponse = (Object.progressDataArray[i].userAnswer);
            theAnswer = (Object.progressDataArray[i].answer[0]);

            if(userResponse.toLowerCase() === theAnswer.toLowerCase()){
                totalCorrect++;
            }

        }
    });

    var Percentage = Math.round((totalCorrect/total)*100);

    $("#statsAndStuff").append(
        "<div class=\"text-center\"> <font color=" + coloring + "> <center>" +
        
        "<H3> <font color=" + coloring + "> Your Score <dr>"
        + Percentage + 

        "% </font> </H3> <dr><dr> <H4> You got " 
        + totalCorrect + 

        " of the " 
        + total + 

        " questions correct </H4> </font> </center> </div>" +


        "<dr><dr>" +
        "<div class=\"text-center\">" +
            "<button type=\"button\" id=\"continueButton\" class=\"btn btn-primary\">Return to Home Screen</button>" +
        "</div>" + 

        "<center> <h6>" +

        "Scoring does not take into account duplicate questions.<br>"+
        "Duplicate questions count individually." +

        "</h6> </center>");
    

}

/////////////////
//  FUNCTIONS  //
/////////////////
