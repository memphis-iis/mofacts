var results = [];
db.getCollection("classes").find({curSemester:"FA_2020"}).forEach(function(relevantClass){
   var teacher = db.getCollection("users").findOne({"_id":relevantClass.instructor}).username; 
   var outputClassData = {
       teacher: teacher,
       name: relevantClass.name,
       studentsWhoTookSurvey: []
   };
   for(var username of relevantClass.students){
       if(username){
           var user = db.getCollection('users').findOne({"username":username});
           if(user){
               var userId = user._id;
               var utl = db.getCollection("userTimesLog").findOne({"_id":userId});
               if(utl && utl['IESsurveytdfFall2020_xml']){
                   var finishedSurvey = false;
                   for(var log of utl['IESsurveytdfFall2020_xml']){
                          if(log['action'] == "unit-end" && log['currentUnit'] == 4){
                              finishedSurvey = true;
                          }
                   }
                   if(finishedSurvey){
                       outputClassData.studentsWhoTookSurvey.push(username);
                   }
               }
           }
       }
   }
   results.push(outputClassData);
});
results;
