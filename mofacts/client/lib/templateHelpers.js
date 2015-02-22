/* client/lib/templateHelpers.js
 *
 * Client-side helper functions for our templates
 * */

UI.registerHelper('equals', function (arg1, arg2, options) {
    return (arg1 === arg2);
});

UI.registerHelper('currentQuestion', function () {
    return Session.get("currentQuestion");
});

UI.registerHelper('currentAnswer', function () {
    return Session.get("currentAnswer");
});
