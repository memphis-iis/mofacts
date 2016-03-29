// var testItems = new Mongo.Collection(null);
// for (var i=0; i<100; i++) {
// 		testItems.insert({
// 				id: "Item no. "+i,
// 				correctness: Math.floor(Math.random()*100)/100
// 		});
// }



Template.lineGraphAverage.rendered = function(){
		// Currently this generates the latency graph. You would change the 3rd arg to 'true' to obtain the correctness graph. labelData should be agnostic.
		var studentData = generateStudentGraphData(Session.get('currStudent'), buildTdfDBName(getCurrentTdfName()), true);
		var labelData = generateNaturals(studentData.length);
    new Chartist.Line('.ct-chart', {
        labels: labelData,
        series: [{
           name: 'Student',
           data: studentData
         } //,  {
        //    name: 'Average',
        //    data: [4, 4, 3, 3, 2, 2, 1, 1]
        // }
								]
    }, {
        low: 0,
        fullWidth: true,
		  height: 300,
        axisY: {
          onlyInteger: true,
          offset: 20
        },
        lineSmooth: false
    });
}
