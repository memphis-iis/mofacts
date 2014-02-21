Handlebars.registerHelper('equals', function (arg1, arg2, options) {
    if (arg1 === arg2) {
        return true;
    } else {
        return false;
    }
});

Handlebars.registerHelper('currentQuestion', function () {
    return Session.get("currentQuestion");
});

Handlebars.registerHelper('currentAnswer', function () {
    return Session.get("currentAnswer");
});