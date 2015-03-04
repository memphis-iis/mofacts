assert = require("assert");

_ = require("../.meteor/local/build/programs/server/packages/underscore.js");

require("./dinky_test.js");
require("./sd_fixtures.js");

require("../common/Helpers.js");
require("../common/AssessmentSession.js");

test_suite("permutefinal", function() {
    var tdffile = SDTDF();
    var unitIndex = 1;
    var unit = tdffile.tdfs.tutor.unit[unitIndex];
    var setspec = tdffile.tdfs.tutor.setspec[0];

    unit_test("Blank and Missing", function(logger) {
        var sched;

        delete unit.assessmentsession[0].permutefinalresult[0];
        sched = AssessmentSession.createSchedule(setspec, unitIndex, unit);

        assert.equal(unitIndex, sched.unitNumber);
        assert.equal(true, !!sched.created);
        assert.equal(true, !sched.permute);
        assert.equal(31, sched.q.length);

        unit.assessmentsession[0].permutefinalresult[0] = "";
        sched = AssessmentSession.createSchedule(setspec, unitIndex, unit);

        assert.equal(unitIndex, sched.unitNumber);
        assert.equal(true, !!sched.created);
        assert.equal(true, !sched.permute);
        assert.equal(31, sched.q.length);
    });

    unit_test("simplest", function(logger) {
        //TODO check simple
    });

    unit_test("complex", function(logger) {
        //TODO assert stuff
    });
    
    unit_test("simple and complex", function(logger) {
        //TODO assert stuff
    });
});
