/*  Provide site-specific configuration. We do this via Meteor settings: see
    http://docs.meteor.com/api/core.html#Meteor-settings

    We start with defaults suitable for testing, but production MoFaCTS servers
    MUST (I repeat MUST) supply a JSON file whose contents are assigned to the
    environment variable METEOR_SETTINGS. See our server-side deploy script,
    but the final command without error checking would look something like:

        $ export SETTINGS_FILE=$HOME/settings.json
        $ export METEOR_SETTINGS=$(cat $SETTINGS_FILE)
        $ sudo -E -u $EXEC_USER forever start bundle/main.js

    You may test a file like this on your workstation with the --settings command
    line option. Using our helper script, it would look something like:

        $ ./run_meteor --settings ./my_test_file.json
*/

// These default value ARE ONLY GOOD FOR TESTING ON YOUR WORKSTATION
// See above - if you don't replace them in production you are In Trouble
var defaultValues = {
    // We print this out - this is handy because you can check that your JSON
    // file actually got processed by looking at the log from startup
    "logNotice": "DEFAULT CONFIG - You should replace this",

    // The owner admin - this account is always an admin and "owns" the TDF/stim
    // files that are added to the database from the repository. Note that this
    // account will be added to the admins role (as below)
    "owner": "ppavlik",

    // Pre-specified role membership (handled on server startup)
    "initRoles": {
        "admins": ["ppavlik"],
        "teachers": ["jackie", "chanda"]
    },

    // Google creds needed for OAuth
    "google": {
        "clientId": "TODO",
        "secret": "ALSO-TODO"
    },

    // Key used for by ./protection.js
    "protectionKey": "KwMYUJRUsD1FWTlGzCCL1KfD8icjlnBKw5txaLw53IZgLCeGpHYZ3ucL9HYb" +
                     "hamfsHXsVuptLWRtwFwJHU9I5ra5rgNMRmmdb7AUi3fE2VH5FbfwMvpDKVeP" +
                     "qR274SS2BuZY4pghBMS6NtxOMMMeMaRBzHL52UEyUgqXs7nckWXlU2va3TjQ" +
                     "Sl8U8kaSjI2Xz9ryVV3kjdfTrUPS9tFsrDBmJ10PEILxmkBc5RCoxfWRfKgc" +
                     "t1VEXwuLlzTbI8zu3fsHDSEk3apYUyFrR0hLbn4CIkIkG3Ejg5ZBqkJmKgtD" +
                     "U5OG4eLB1SHxx5C9pffpI2pi7p31of4nYGb5FnsxodGxrDlJI6j2ituf5iqD" +
                     "5GkWDW7QZZi3feiuUebJhsDfmlvlr73hDahAeTUH4p4g22QybcP5G2mV9blm" +
                     "Zf0k837VTvUMsoBCOpurjDFyX9fpL1FFMpWZ4eXveH7I5Ck2h0wtmgCVpCJX"
};

getFullConfig = function() {
    return _.extend({}, defaultValues, Meteor.settings);
};

getConfigProperty = function(name) {
    return _.prop(getFullConfig(), name);
};
