import {Roles} from 'meteor/alanning:roles';
Meteor.publish('files.assets.all', async function () {
    // Security: Filter assets based on user role and ownership
    if (!this.userId) {
        return this.ready(); // No data for unauthenticated users
    }

    // Admins can see all assets
    if (await Roles.userIsInRoleAsync(this.userId, ['admin'])) {
        return DynamicAssets.collection.find();
    }

    // Teachers and students can only see their own assets and public ones
    return DynamicAssets.collection.find({
        $or: [
            { userId: this.userId },
            { 'meta.public': true }
        ]
    });
});

Meteor.publish('assets', function(ownerId, stimSetId) {
    return DynamicAssets.collection.find({"meta.stimuliSetId": stimSetId});
});

Meteor.publish('ownedFiles', function() {
    return [Tdfs.find({'ownerId': Meteor.userId()})]
});

Meteor.publish('accessableFiles', async function() {
    const accessableFileIds = (await Meteor.users.findOneAsync({_id: this.userId})).accessedTDFs;
    return Tdfs.find({_id: {$in: accessableFileIds}})
});

Meteor.publish('userComponentStates', function(tdfId) {
    return ComponentStates.find({userId: this.userId, TDFId: tdfId});
});

Meteor.publish('userExperimentState', function(tdfId) {
    console.log("publishing userExperimentState", tdfId, typeof tdfId)
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
});

Meteor.publish('allTdfs', async function() {
    // Security: Filter TDFs based on user role and access permissions
    if (!this.userId) {
        return this.ready(); // No data for unauthenticated users
    }

    // Admins can see all TDFs
    if (await Roles.userIsInRoleAsync(this.userId, ['admin'])) {
        return Tdfs.find();
    }

    // Teachers can see their own TDFs, TDFs they have access to, and public TDFs
    if (await Roles.userIsInRoleAsync(this.userId, ['teacher'])) {
        return Tdfs.find({
            $or: [
                { ownerId: this.userId },
                { 'accessors.userId': this.userId },
                { visibility: 'public' }
            ]
        });
    }

    // Students can see:
    // 1. TDFs with userselect='true' (self-selectable)
    // 2. TDFs they have practiced (have history for) - for progress reporting

    // Get TDF IDs the student has history for
    const historicalTdfIds = (await Histories.find(
        { userId: this.userId },
        { fields: { TDFId: 1 } }
    ).fetchAsync()).map(h => h.TDFId);

    // Get unique TDF IDs
    const uniqueHistoricalTdfIds = [...new Set(historicalTdfIds)];

    return Tdfs.find({
        $or: [
            { 'content.tdfs.tutor.setspec.userselect': 'true' },
            { _id: { $in: uniqueHistoricalTdfIds } }
        ]
    });
});

Meteor.publish('ownedTdfs', async function(ownerId) {
    // Security: Only allow users to query their own TDFs or if they're admin
    if (!this.userId) {
        return this.ready();
    }

    // Users can only query their own TDFs unless they're admin
    // METEOR 3 FIX: await the async Roles.userIsInRoleAsync() call
    if (ownerId !== this.userId && !(await Roles.userIsInRoleAsync(this.userId, ['admin']))) {
        return this.ready(); // Return empty result
    }

    return Tdfs.find({'ownerId': ownerId});
});

Meteor.publish('tdfByExperimentTarget', async function(experimentTarget, experimentConditions=undefined) {
    // Security: Require authentication
    if (!this.userId) {
        return this.ready();
    }

    // Security: Sanitize regex input to prevent ReDoS attacks and regex injection
    // Escape regex special characters: . * + ? ^ $ { } ( ) | [ ] \
    const sanitizedTarget = experimentTarget ? experimentTarget.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : '';

    let query = {"content.tdfs.tutor.setspec.experimentTarget": {$regex: sanitizedTarget, $options: 'i'}}
    if(experimentConditions && Array.isArray(experimentConditions)){
        query = {$or: [{"content.fileName": {$in: experimentConditions}}, {"content.tdfs.tutor.setspec.experimentTarget": {$regex: sanitizedTarget, $options: 'i'}}]}
        console.log(JSON.stringify(query))
    }

    // Security: Filter results based on user role and permissions
    if (await Roles.userIsInRoleAsync(this.userId, ['admin'])) {
        return Tdfs.find(query);
    }

    if (await Roles.userIsInRoleAsync(this.userId, ['teacher'])) {
        // Teachers can see their own TDFs, TDFs they have access to, and public TDFs
        query.$or = [
            { $and: [query, { ownerId: this.userId }] },
            { $and: [query, { 'accessors.userId': this.userId }] },
            { $and: [query, { visibility: 'public' }] }
        ];
        return Tdfs.find(query.$or ? { $or: query.$or } : query);
    }

    // Students can only see TDFs they have explicit access to
    const user = await Meteor.users.findOneAsync(this.userId);
    const accessedTDFs = user?.accessedTDFs || [];
    query._id = { $in: accessedTDFs };
    return Tdfs.find(query);
});

Meteor.publish('Assignments', function(courseId) {
    return Assignments.find({courseId: courseId});
});

Meteor.publish('settings', async function() {
    // Security: Only admins should see system settings
    // METEOR 3 FIX: await the async Roles.userIsInRoleAsync() call
    if (!this.userId || !(await Roles.userIsInRoleAsync(this.userId, ['admin']))) {
        return this.ready();
    }
    return DynamicSettings.find();
});

// Publish user's audio settings
Meteor.publish('userAudioSettings', function() {
    if (!this.userId) {
        return this.ready();
    }

    return Meteor.users.find(
        { _id: this.userId },
        {
            fields: {
                audioSettings: 1,
                audioPromptMode: 1,  // Legacy field for backward compatibility
                audioInputMode: 1     // Legacy field for backward compatibility
            }
        }
    );
});