db.userTimesLog.find({}).forEach(function(obj){
    if (typeof obj.Music2_xml !== "undefined") {
        print("HIT: " + obj._id + " ==> " + obj.Music2_xml.length);
    }
});
