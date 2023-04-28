
Meteor.publish('files.assets.all', function () {
    return DynamicAssets.collection.find();
});

Meteor.publish('assets', function(ownerId, stimSetId) {
    return DynamicAssets.collection.find({userId: ownerId, "meta.stimuliSetId": stimSetId});
});

Meteor.publish('ownedFiles', function() {
    return [Tdfs.find({'ownerId': Meteor.userId()}), Stims.find({'owner': Meteor.userId()})]
});

Meteor.publish('accessableFiles', function() {
    const accessableFileIds = Meteor.users.findOne({_id: this.userId}).accessedTDFs;
    return Tdfs.find({_id: {$in: accessableFileIds}})
});

Meteor.publish('userComponentStates', function(tdfId) {
    return ComponentStates.find({userId: this.userId, TDFId: tdfId});
});

Meteor.publish('userExperimentState', function(tdfId) {
    return GlobalExperimentStates.find({userId: this.userId, TDFId: tdfId});
});

Meteor.publish('currentExperimentTdfs', function(tdfId) {
    return Tdfs.find({_id: tdfId});
});