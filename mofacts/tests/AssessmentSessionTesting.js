require("./dinky_test.js");
require("./sd_fixtures.js");

require("../common/Helpers.js");
require("../common/AssessmentSession.js");

test_suite("permutefinal", function() {
    var tdffile = SDTDF();
    var unitIndex = 1;
    var unit = tdffile.tdfs.tutor.unit[unitIndex];
    var setspec = tdffile.tdfs.tutor.setspec[0];

    var q_in_order = function(q) {
        for(var i = 1; i < q.length; ++i) {
            if (q[i-1].clusterIndex != q[i].clusterIndex - 1) {
                return false;
            }
        }
        return true;
    };

    var q_min_max = function(q) {
        var mn = q[0].clusterIndex;
        var mx = mn;
        for(var i = 1; i < q.length; ++i) {
            var val = q[i].clusterIndex;
            if (val < mn) mn = val;
            if (val > mx) mx = val;
        }
        return [mn, mx];
    };

    unit_test("Missing", function(logger) {
        delete unit.assessmentsession[0].permutefinalresult[0];
        var sched = AssessmentSession.createSchedule(setspec, unitIndex, unit);

        assert.equal(unitIndex, sched.unitNumber);
        assert.equal(true, !!sched.created);
        assert.equal(true, !sched.permute);
        assert.equal(31, sched.q.length);
        assert.equal(true, q_in_order(sched.q));
        assert.deepEqual([0,30], q_min_max(sched.q));
    });

    unit_test("Blank", function(logger) {
        unit.assessmentsession[0].permutefinalresult[0] = "";
        var sched = AssessmentSession.createSchedule(setspec, unitIndex, unit);

        assert.equal(unitIndex, sched.unitNumber);
        assert.equal(true, !!sched.created);
        assert.equal(true, !sched.permute);
        assert.equal(31, sched.q.length);
        assert.equal(true, q_in_order(sched.q));
        assert.deepEqual([0,30], q_min_max(sched.q));
    });

    unit_test("Ranges", function(logger) {
        unit.assessmentsession[0].permutefinalresult[0] = "0-15 16-30";
        var sched = AssessmentSession.createSchedule(setspec, unitIndex, unit);

        assert.equal(unitIndex, sched.unitNumber);
        assert.equal(true, !!sched.created);
        assert.equal(true, !sched.permute);
        assert.equal(31, sched.q.length);
        assert.equal(false, q_in_order(sched.q));
        assert.equal(false, q_in_order(sched.q.slice(0,16)));
        assert.equal(false, q_in_order(sched.q.slice(16)));

        assert.deepEqual([0,30], q_min_max(sched.q));
        assert.deepEqual([0,15], q_min_max(sched.q.slice(0,16)));
        assert.deepEqual([16,30], q_min_max(sched.q.slice(16)));

    });
});

test_suite("randomchoices", function() {
    var tdffile = SDTDF();
    var unitIndex = 1;
    var unit = tdffile.tdfs.tutor.unit[unitIndex];
    var setspec = tdffile.tdfs.tutor.setspec[0];

    unit_test("Missing", function(logger) {
        delete unit.assessmentsession[0].randomchoices[0];
        var settings = AssessmentSession.loadAssessmentSettings(setspec, unit);

        assert.equal(31, settings.scheduleSize);
        assert.deepEqual([], settings.ranChoices);
    });

    unit_test("Blank", function(logger) {
        unit.assessmentsession[0].randomchoices[0] = "";
        var settings = AssessmentSession.loadAssessmentSettings(setspec, unit);

        assert.equal(31, settings.scheduleSize);
        assert.deepEqual([], settings.ranChoices);
    });

    unit_test("simplest", function(logger) {
        unit.assessmentsession[0].randomchoices[0] = "3";
        var settings = AssessmentSession.loadAssessmentSettings(setspec, unit);

        assert.equal(31, settings.scheduleSize);
        assert.deepEqual([0,1,2], settings.ranChoices);
    });

    unit_test("complex", function(logger) {
        unit.assessmentsession[0].randomchoices[0] = "0-3";
        var settings = AssessmentSession.loadAssessmentSettings(setspec, unit);

        assert.equal(31, settings.scheduleSize);
        assert.deepEqual([0,1,2,3], settings.ranChoices);
    });

    unit_test("simple and complex", function(logger) {
        unit.assessmentsession[0].randomchoices[0] = "2 2-4 2 10-11";
        var settings = AssessmentSession.loadAssessmentSettings(setspec, unit);

        assert.equal(31, settings.scheduleSize);
        assert.deepEqual([0,1, 2,3,4, 0,1, 10,11], settings.ranChoices);
    });
});

test_report();
