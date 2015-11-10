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

    //Given an object, convert it to a reasonable string for display:
    // - If it doesn't evaluate and isn't False, return empty string
    // - if it's an array join the entries together with a comma
    // - else convert to a string
    //Note that we recurse on array entries, so arrays of arrays will
    //be "flattened"
    display: function(to_display) {
        if (!to_display && to_display !== false && to_display !== 0) {
            return "";
        }
        else if (to_display && to_display.length && to_display.join) {
            var dispvals = [];
            for (var i = 0; i < to_display.length; ++i) {
                dispvals.push(Helpers.display(to_display[i]));
            }
            return dispvals.join(",");
        }
        else {
            return Helpers.trim("" + to_display);
        }
    },

    //Given a string s, return it with all leading and trailing
    //whitespace removed
    trim: function(s) {
        //Handle non-strings and empty strings - first check existence,
        //then force conversion to string (and implicit copy).
        if (!s && s !== 0 && s !== false)
            return "";

        var ss = "" + s;
        if (!ss || !ss.length || ss.length < 1) {
            return "";
        }

        //Javascript strings support trim, but it doesn't exist in
        //IE 8 (and earlier)
        if (ss.trim) {
            return ss.trim();
        }
        else {
            return ss.replace(/^\s+|\s+$/gm, '');
        }
    },

    //Given an object presumed to be an array, return the first element.
    //If not possible, return null
    firstElement: function(obj) {
        try {
            if (obj && obj.length && obj.length > 0) {
                return obj[0];
            }
            else {
                return null;
            }
        }
        catch(e) {
            return null;
        }
    },

    intVal: function(src) {
        var val = parseInt(Helpers.display(src));
        if (isNaN(val)) {
            val = 0;
        }
        return val;
    },

    floatVal: function(src) {
        var val = parseFloat(Helpers.display(src));
        if (!isFinite(val)) {
            val = 0.0;
        }
        return val;
    },

    //Extract space-delimited fields from src and push them to dest. Note that
    //dest is changed, but is NOT cleared before commencing. Also note that
    //false-ish values and whitespace-only strings are silently discarded
    extractDelimFields: function(src, dest) {
        if (!src) {
            return;
        }
        var fields = Helpers.trim(src).split(/\s/);
        for(var i = 0; i < fields.length; ++i) {
            var fld = Helpers.trim(fields[i]);
            if (fld && fld.length > 0) {
                dest.push(fld);
            }
        }
    },

    //Given a string of format "a-b", return an array containing all
    //numbers from a to b inclusive.  On errors, return an empty array
    rangeVal: function(src) {
        src = Helpers.trim(src);
        var idx = src.indexOf("-");
        if (idx < 1) {
            return [];
        }

        var first = Helpers.intVal(src.substring(0, idx));
        var last  = Helpers.intVal(src.substring(idx+1));
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
