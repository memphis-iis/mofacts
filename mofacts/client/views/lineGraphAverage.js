// var testItems = new Mongo.Collection(null);
// for (var i=0; i<100; i++) {
// 		testItems.insert({
// 				id: "Item no. "+i,
// 				correctness: Math.floor(Math.random()*100)/100
// 		});
// }

Template.lineGraphAverage.rendered = function(){

    new Chartist.Line('.ct-chart', {
        labels: [1, 2, 3, 4, 5, 6, 7, 8],
        series: [{
           name: 'Student',
           data: [5, 4, 5, 4, 3, 2, 1, 2]
         } , {
           name: 'Average',
           data: [4, 4, 3, 3, 2, 2, 1, 1]
        }]
    }, {
        low: 0,
        fullWidth: true,
		  height: 300,
        axisY: {
          onlyInteger: true,
          offset: 20
        }
    });
}
