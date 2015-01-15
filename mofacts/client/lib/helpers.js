/* client/lib/helpers.js
 * 
 * Client-side helper functions
 * */
 
//UI helpers (for the HTML template)
 
UI.registerHelper('equals', function (arg1, arg2, options) {
    if (arg1 === arg2) {
        return true;
    } else {
        return false;
    }
});

UI.registerHelper('currentQuestion', function () {
    return Session.get("currentQuestion");
});

UI.registerHelper('currentAnswer', function () {
    return Session.get("currentAnswer");
});
