/* Helpers - Simple helper functions that we might use across multiple
 * files (on both the client and the server)
 * */

Helpers = {
    //Given a user ID, return the "dummy" password that stands in for a blank
    //password. This is because we REALLY do want to use blanks passwords for
    //some users
    blankPassword: function(userName) {
        return userName + "BlankPassword";
    },

    //Extract space-delimited fields from src and push them to dest. Note that
    //dest is changed, but is NOT cleared before commencing. Also note that
    //false-ish values and whitespace-only strings are silently discarded
    extractDelimFields: function(src, dest) {
        if (!src) {
            return;
        }
        var fields = _.trim(src).split(/\s/);
        for(var i = 0; i < fields.length; ++i) {
            var fld = _.trim(fields[i]);
            if (fld && fld.length > 0) {
                dest.push(fld);
            }
        }
    },

    //Given a string of format "a-b", return an array containing all
    //numbers from a to b inclusive.  On errors, return an empty array
    rangeVal: function(src) {
        src = _.trim(src);
        var idx = src.indexOf("-");
        if (idx < 1) {
            return [];
        }

        var first = _.intval(src.substring(0, idx));
        var last  = _.intval(src.substring(idx+1));
        if (last < first) {
            return [];
        }

        var range = [];
        for (var r = first; r <= last; ++r) {
            range.push(r);
        }

        return range;
    },

    //Given an array, shuffle IN PLACE and then return the array
    shuffle: function(array) {
        if (!array || !array.length) {
            return array;
        }

        var currentIndex = array.length;

        while (currentIndex > 0) {
            var randomIndex = Math.floor(Math.random() * currentIndex);
            currentIndex -= 1;

            var tmp = array[currentIndex];
            array[currentIndex] = array[randomIndex];
            array[randomIndex] = tmp;
        }

        return array;
    },

    //Given an array, select and return one item at random. If the array is
    //empty, then undefined is returned
    randomChoice: function(array) {
        var choice;
        if (array && array.length) {
            choice = array[Math.floor(Math.random() * array.length)];
        }
        return choice;
    }
};
