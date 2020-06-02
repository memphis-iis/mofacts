export const curSemester = "SU_2020";

search = function(key, prop, array){
  for(var i=0;i<array.length;i++){
    if(array[i][prop] === key){
      return array[i];
    }
  }
}

getAllClassesForCurrentInstructor = function(instructorID){
  console.log("getAllClassesForCurrentInstructor, instructorID:" + instructorID);
  if (Roles.userIsInRole(Meteor.user(), ["admin"])){
    console.log("admin role, getAllClassesForCurrentInstructor");
    return Classes.find({}).fetch();
  }else{
    console.log("teacher role, getAllClassesForCurrentInstructor");
    return Classes.find({instructor:instructorID,"curSemester":curSemester}).fetch();
  }
}
