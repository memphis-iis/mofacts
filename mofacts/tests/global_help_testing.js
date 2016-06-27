//We are currently skipping any client-only stuff in the global helpers
Meteor = { isClient: false, isServer: true };

require("./dinky_test.js");

require("../lib/globalHelpers.js");

test_suite("underscore mixins", function() {
    unit_test("Mixin _.intval and _.floatval", function(logger) {
        var obj = {
            si: ' 42 ',
            fi: ' 3.14 '
        };

        assert.deepEqual(0, _.intval(0));
        assert.deepEqual(0, _.intval('0'));
        assert.deepEqual(0, _.intval({}));
        assert.deepEqual(0, _.intval(''));
        assert.deepEqual(0, _.intval(null));
        assert.deepEqual(0, _.intval(undefined));
        assert.deepEqual(0, _.intval());
        assert.deepEqual(0, _.intval(false));
        assert.deepEqual(0, _.intval('Nothing to see here'));
        assert.deepEqual(42, _.intval(null, 42));

        assert.deepEqual(42, _.intval('42'));
        assert.deepEqual(42, _.intval(42));
        assert.deepEqual(42, _.intval(43-1));
        assert.deepEqual(42, _.intval('  42  '));

        assert.deepEqual(0.0, _.floatval(0));
        assert.deepEqual(0.0, _.floatval('0'));
        assert.deepEqual(0.0, _.floatval({}));
        assert.deepEqual(0.0, _.floatval(''));
        assert.deepEqual(0.0, _.floatval(null));
        assert.deepEqual(0.0, _.floatval(undefined));
        assert.deepEqual(0.0, _.floatval());
        assert.deepEqual(0.0, _.floatval(false));
        assert.deepEqual(0.0, _.floatval('Nothing to see here'));
        assert.deepEqual(0.42, _.floatval(null, 0.42));

        assert.deepEqual(1.1, _.floatval("1.1"));
        assert.deepEqual(1.1, _.floatval(1.1));
        assert.deepEqual(1.1, _.floatval(1.1 - 0.0));
        assert.deepEqual(1.1, _.floatval(' 1.1 '));
    });

    unit_test("Mixin _.prop", function(logger) {
        var obj = {
            s: 'A String',
            a: ['An', 'Array'],
            i: 42,
            nested: [
                {'name': 'first', sub: {s: 'Another String', ii: ' 42 '}},
                {'name': 'not-first', sub: {s: 'Bad String'}},
            ]
        };

        assert.deepEqual(null, _.prop(obj, 'no-prop'));
        assert.deepEqual(null, _.prop(obj));
        assert.deepEqual(null, _.prop(obj, null));
        assert.deepEqual(null, _.prop(obj, ''));
        assert.deepEqual(null, _.prop(null, null));
        assert.deepEqual(null, _.prop(undefined, null));
        assert.deepEqual(null, _.prop('', 'cantbeaproperty'));

        assert.deepEqual(0, _.prop('', 'length'));
        assert.deepEqual(0, _.chain(null).prop('s').trim().prop('length').value());

        assert.deepEqual('A String', _.prop(obj, 's'));
        assert.deepEqual(8, _.chain(obj).prop('s').trim().prop('length').value());
        assert.deepEqual(['An', 'Array'], _.prop(obj, 'a'));
        assert.deepEqual(2, _.chain(obj).prop('a').prop('length').value());
        assert.deepEqual('An', _.chain(obj).prop('a').prop(0).value());
        assert.deepEqual('Array', _.chain(obj).prop('a').prop(1).value());
        assert.deepEqual(42, _.prop(obj, 'i'));

        assert.deepEqual('Another String', _.chain(obj).prop('nested').first().prop('sub').prop('s').value());
        assert.deepEqual(42, _.chain(obj).prop('nested').first().prop('sub').prop('ii').intval().value());
        assert.deepEqual('Bad String', _.chain(obj).prop('nested').last().prop('sub').prop('s').value());

        assert.deepEqual(null, _.chain(obj).prop('nestedmiss').first().prop('sub').prop('s').value());
        assert.deepEqual(null, _.chain(obj).prop('nested').first().prop('sub').prop('miss').value());

        assert.deepEqual(42, _.chain(obj).prop('nestedmiss').first().prop('sub').prop('s').intval(42).value());
        assert.deepEqual(0.42, _.chain(obj).prop('nested').first().prop('sub').prop('miss').floatval(0.42).value());
    });

    unit_test("Mixin _.safekeys", function(logger) {
        assert.deepEqual([], _.safekeys());
        assert.deepEqual([], _.safekeys({}));
        assert.deepEqual([], _.safekeys(null));
        assert.deepEqual([], _.safekeys(""));
        assert.deepEqual([], _.safekeys(0));
        assert.deepEqual([], _.safekeys(1));
        assert.deepEqual([], _.safekeys([]));

        assert.deepEqual(['a'], _.safekeys({'a': null}));
        assert.deepEqual(['a'], _.safekeys({'a': 1}));
        assert.deepEqual(['a'], _.safekeys({'a': {'b': 2}}));
    });

    unit_test("Mixin _.sum", function(logger) {
        assert.deepEqual(0, _.sum());
        assert.deepEqual(0, _.sum([]));
        assert.deepEqual(0, _.sum([0]));
        assert.deepEqual(0, _.sum([0, 0]));
        assert.deepEqual(42.1, _.sum([0, 42, 0.1]));
    });

    unit_test("total practice time demo/test for sum", function(logger){
        var cards = [
            { name: 'A', times: [10, 20, 30] },
            { name: 'B', notimes: true },
            { name: 'C', times: [] },
            { name: 'D', times: [40] },
            { name: 'E', times: [0.42] },
        ];

        var calc = _.chain(cards).pluck('times').flatten().sum().value();
        assert.deepEqual(10+20+30+40+0.42, calc);
    });
});

test_report();
