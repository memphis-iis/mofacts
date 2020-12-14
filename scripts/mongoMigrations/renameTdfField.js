// Requires official MongoShell 3.6+
use MoFaCT;
var updatedTdfs = [];
var notUpdatedTdfs1 = [];
var notUpdatedTdfs2 = [];
var processedTdfs = [];
db.getCollection('tdfs').find({}).forEach(function(tdf){
    processedTdfs.push(tdf);
    if(tdf.tdfs.tutor.unit){
        var wasUpdated = false;
        for(var i=0;i<tdf.tdfs.tutor.unit.length;i++){
            if(tdf.tdfs.tutor.unit[i].deliveryparams && tdf.tdfs.tutor.unit[i].deliveryparams[0].timeuntilstimulus){
                tdf.tdfs.tutor.unit[i].deliveryparams[0].timeuntilaudio = JSON.parse(JSON.stringify(tdf.tdfs.tutor.unit[i].deliveryparams[0].timeuntilstimulus));
                delete tdf.tdfs.tutor.unit[i].deliveryparams[0].timeuntilstimulus;
                wasUpdated = true;
            }
        }
        if(wasUpdated){
            db.getCollection('tdfs').update({_id:tdf._id},tdf);        
            updatedTdfs.push(tdf);
        }else{
            notUpdatedTdfs2.push(tdf);
        }
    }else{
        notUpdatedTdfs1.push(tdf);
    }
},function(){
    console.log(notUpdatedTdfs1,notUpdatedTdfs2,updatedTdfs,processedTdfs);
});

//{updatedTdfs,notUpdatedTdfs1,notUpdatedTdfs2,processedTdfs};