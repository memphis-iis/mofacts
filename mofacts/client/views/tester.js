var testItems = new Mongo.Collection(null);
for (var i=0; i<100; i++) {		
		testItems.insert({
				id: "Item no. "+i,
				correctness: Math.floor(Math.random()*100)/100
		});
}

Template.tester.helpers({
		username: function() {
				return Meteor.user().username;
		}
});

Template.tester.rendered = function() {
		var itemArray = testItems.find();
		var addLine = function(lineItem) {
				$("#itemList").append(
						"<li>"+lineItem.id+", "+lineItem.correctness+"</li>"
				);
		};
		
		itemArray.forEach( function(item) {
				addLine(item);
		});
		
};
