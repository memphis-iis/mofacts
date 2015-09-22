/* client/lib/templateHelpers.js
 *
 * Client-side helper functions for our templates
 * */

UI.registerHelper('currentQuestion', function () {
    return Session.get("currentQuestion");
});

UI.registerHelper('displayAnswer', function () {
    return Answers.getDisplayAnswerText(Session.get("currentAnswer"));
});

UI.registerHelper('rawAnswer', function () {
    return Session.get("currentAnswer");
});

UI.registerHelper('currentProgress', function () {
    return Session.get("questionIndex");
});
