//For everyone
assert = require("assert");
_ = require("../.meteor/local/build/programs/server/packages/underscore.js");//Silly little test framework

//Just for us
var fs = require('fs');

var failure_count = 0;
var suite_count = 0;
var test_count = 0;
var console_buffer = [];
var suites = [];
var all_suites = [];

clear_test_report = function() {
    failure_count = 0;
    suite_count = 0;
    test_count = 0;
    console_buffer = [];
    suites = [];
    all_suites = [];
};
clear_test_report();

console._real_log = console.log;

console.log = function() {
    for(var i = 0; i < arguments.length; ++i) {
        var v = arguments[i];
        if (typeof v !== "string") {
            v = JSON.stringify(v);
        }
        console_buffer.push(v);
    }
    console_buffer.push('\n');
};

console.real_log = function() {
    console._real_log.apply(this, arguments);
    console.log.apply(this, arguments);
};

function curr_suite() {
    return suites.length ? suites[suites.length-1] : "NO SUITE";
}

function dump_excep(func, e) {
    if (e && e.stack) {
        func(e.stack);
    }
    else {
        func('' + e);
    }
}

test_suite = function(suite_name, func) {
    try {
        suites.push(suite_name);
        all_suites.push(suite_name);
        suite_count += 1;
        console.real_log("BEGIN Test Suite", suite_name);
        func();
    }
    catch(e) {
        failure_count += 1;
        console.real_log("Test suite FAILURE");
        dump_excep(console.real_log, e);
    }
    console.real_log("END Test Suite", suite_name);
    suites.pop();
};

unit_test = function(unit_name, func) {
    var format_msg = function() {
        var output = [curr_suite(), unit_name, "=>"];
        for(var i = 0; i < arguments.length; ++i) {
            output.push(("" + arguments[i]).trim());
        }
        return output.join(' ');
    };

    var logger = {
        print: function() {
            console.real_log(format_msg.apply(this, arguments));
        },

        log: function() {
            console.log(format_msg.apply(this, arguments));
        }
    };

    try {
        test_count += 1;
        func(logger);
    }
    catch(e) {
        failure_count += 1;
        logger.print("FAILURE");
        dump_excep(logger.print, e);
        return;
    }

    logger.print("ok");
};

test_report = function() {
    console.real_log("TEST REPORT");
    console.real_log("Test Suites:  ", suite_count);
    console.real_log("Unit Tests:   ", test_count);
    console.real_log("Failure Count:", failure_count);
    console.real_log("Dumping buffered output to .test_results");

    //Add report heading and footing
    console_buffer.unshift(
        "FULL TEST OUTPUT on " + (new Date()).toString()  + "\n" +
        "All Suites Seen: " + all_suites.join(',') + '\n'
    );
    console_buffer.push("\n=================================================\n\n\n")

    fs.appendFileSync(".test_results", console_buffer.join(''));
    clear_test_report();
};
