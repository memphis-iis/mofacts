require("./dinky_test.js");

document = {};  // Our cookie library needs a document object

require("../lib/globalHelpers.js");
require("../client/lib/cookies.js");

test_suite("Cookies", function() {
    var mockCookies = {
        cookies: [],

        set cookie (kv) {
            var sepIdx = kv.indexOf("=");
            var k = kv.substr(0, sepIdx);
            var v = kv.substring(sepIdx + 1);
            v = _.trim(v.split(';')[0]);  // Discard any extra settings
            console.log("Adding Cookie", k, "==", v);
            this.cookies[k] = v;
        },

        get cookie () {
            var output = [];
            for (var cookieName in this.cookies) {
                output.push(cookieName + "=" + this.cookies[cookieName]);
            }
            return output.join(";");
        },

        reset: function () {
            this.cookies = [];
        }
    };

    Cookie.cookieSource = mockCookies;

    unit_test("read/write", function(logger) {
        mockCookies.reset();

        assert.deepEqual("", Cookie.get("mycookie"));

        Cookie.set("mycookie", "Hello/World");
        console.log("mockCookies", mockCookies.cookies);
        assert.deepEqual("Hello/World", Cookie.get("mycookie"));
    });
});

test_report();
