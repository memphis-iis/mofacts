/* cookies.js - our small, simple wrapper around documment.cookies

See https://developer.mozilla.org/en-US/docs/Web/API/Document/cookie if you
are unfamiliar with the standard cookie interface in browsers.

The only dependency assumed is underscore and underscore mixins.

The funtionality in this module is currently limited and makes some pretty
strong assumptions about how you want to deal with cookies. Perhaps the main
assumption is that they should use a path of '/' and that they should have
their 'expires' value set. If you want something different, you should probably
think very strongly about using Meteor's Session instead of cookies.
*/

Cookie = {
    // Anything that supports reading cookieSource.cookie for all and setting
    // cookieSource.cookie to set a single cookie. (Mainly for mocking/testing)
    'cookieSource': document,

    'get': function(name) {
        var allCookies = _.trim(this.cookieSource.cookie).split(';');
        name = encodeURIComponent(_.trim(name));

        var value = _(allCookies).chain()
            .map(function(entry){
                var pos = entry.indexOf('=');
                var cook = {
                    'name': _.trim(entry.substring(0, pos)),
                    'value': _.trim(entry.substring(pos + 1))
                };
                return cook;
            })
            .findWhere({'name': name})
            .result('value')
            .trim()
            .value();

        return decodeURIComponent(value);
    },

    'set': function(name, value, expireDays) {
        name = encodeURIComponent(_.trim(name));
        value = encodeURIComponent(_.trim(value));

        exp = new Date(
            new Date().getTime() +
            (_.intval(expireDays, 1) * 24 * 60 * 60 * 1000)
        ).toGMTString();

        this.cookieSource.cookie = name + "=" + value + "; path=/; expires=" + exp;
    }
};
