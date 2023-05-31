import {curSemester, ALL_TDFS, KC_MULTIPLE} from '../common/Definitions';

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
    if (tdfId && typeof tdfId === 'object') {
        return GlobalExperimentStates.find({userId: this.userId, TDFId: {$in: tdfId}});
    } else if (tdfId) {
        return GlobalExperimentStates.find({userId: this.userId, TDFId: tdfId});
    }
});

Meteor.publish('allUserExperimentState', function() {
    return GlobalExperimentStates.find({userId: this.userId});
});

Meteor.publish('currentTdf', function(tdfId) {
    console.log("publishing currentTdf", tdfId, typeof tdfId)
    if (tdfId && typeof tdfId === 'object') {
        return Tdfs.find({_id: {$in: tdfId}});
    } else if (tdfId) {
        return Tdfs.find({_id: tdfId});
    }
<<<<<<< HEAD
=======
    return Tdfs.find();
>>>>>>> a14c48ca (Implement Verbosity Level Changing)
});

Meteor.publish('allTdfs', function() {
    return Tdfs.find();
});

Meteor.publish('tdfByExperimentTarget', function(experimentTarget) {
    return Tdfs.find({"content.tdfs.tutor.setspec.experimentTarget": experimentTarget});
});

Meteor.publish('Assignments', function(courseId) {
    return Assignments.find({courseId: courseId});
});

Meteor.publish('settings', function() {
    return DynamicSettings.find();
});