//Silly little test framework

var fs = require('fs');

var failure_count = 0;
var suite_count = 0;
var test_count = 0;
var console_buffer = [];
var suites = [];

clear_test_report = function() {
    failure_count = 0;
    suite_count = 0;
    test_count = 0;
    console_buffer = [];
    suites = [];
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
        suite_count += 1;
        func();
    }
    catch(e) {
        failure_count += 1;
        console.real_log("Test suite FAILURE");
        dump_excep(console.real_log, e);
    }
    suites.pop();
};

unit_test = function(unit_name, func) {
    var logger = {
        print: function() {
            var output = [curr_suite(), unit_name, "=>"];
            for(var i = 0; i < arguments.length; ++i) {
                output.push(("" + arguments[i]).trim());
            }
            console.real_log(output.join(' '));
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
    fs.writeFileSync(".test_results", console_buffer.join(''));
    clear_test_report();
};
