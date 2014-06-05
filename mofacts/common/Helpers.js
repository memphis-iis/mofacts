//Simple helper functions that we might use across multiple files (on
//both the client and the server)
Helpers = {
    //Given an object, convert it to a reasonable string for display:
    // - If it doesn't evaluate and isn't False, return empty string
    // - if it's an array join the entries together with a comma
    // - else convert to a string
    //Note that we recurse on array entries, so arrays of arrays will
    //be "flattened"
    display: function(to_display) {
        if (!to_display && to_display !== false) {
            return "";
        }
        else if (todisplay && todisplay.length && todisplay.join) {
            var dispvals = [];
            for (var i = 0; i < todisplay.length; ++i) {
                dispvals.push(Helpers.display(to_display[i]));
            }
            return dispvals.join(",");
        } 
        else {
            return "" + dispvals;
        }
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
    }
}
