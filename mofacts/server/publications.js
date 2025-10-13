Meteor.publish('files.assets.all', function () {
    // Security: Filter assets based on user role and ownership
    if (!this.userId) {
        return this.ready(); // No data for unauthenticated users
    }

    // Admins can see all assets
    if (Roles.userIsInRole(this.userId, ['admin'])) {
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

Meteor.publish('accessableFiles', function() {
    const accessableFileIds = Meteor.users.findOne({_id: this.userId}).accessedTDFs;
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

Meteor.publish('allTdfs', function() {
    // Security: Filter TDFs based on user role and access permissions
    if (!this.userId) {
        return this.ready(); // No data for unauthenticated users
    }

    // Admins can see all TDFs
    if (Roles.userIsInRole(this.userId, ['admin'])) {
        return Tdfs.find();
    }

    // Teachers can see their own TDFs, TDFs they have access to, and public TDFs
    if (Roles.userIsInRole(this.userId, ['teacher'])) {
        return Tdfs.find({
            $or: [
                { ownerId: this.userId },
                { 'accessors.userId': this.userId },
                { visibility: 'public' }
            ]
        });
    }

    // Students can only see TDFs they've been explicitly granted access to
    const user = Meteor.users.findOne(this.userId);
    const accessedTDFs = user?.accessedTDFs || [];
    return Tdfs.find({ _id: { $in: accessedTDFs } });
});

Meteor.publish('ownedTdfs', function(ownerId) {
    // Security: Only allow users to query their own TDFs or if they're admin
    if (!this.userId) {
        return this.ready();
    }

    // Users can only query their own TDFs unless they're admin
    if (ownerId !== this.userId && !Roles.userIsInRole(this.userId, ['admin'])) {
        return this.ready(); // Return empty result
    }

    return Tdfs.find({'ownerId': ownerId});
});

Meteor.publish('tdfByExperimentTarget', function(experimentTarget, experimentConditions=undefined) {
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
    if (Roles.userIsInRole(this.userId, ['admin'])) {
        return Tdfs.find(query);
    }

    if (Roles.userIsInRole(this.userId, ['teacher'])) {
        // Teachers can see their own TDFs, TDFs they have access to, and public TDFs
        query.$or = [
            { $and: [query, { ownerId: this.userId }] },
            { $and: [query, { 'accessors.userId': this.userId }] },
            { $and: [query, { visibility: 'public' }] }
        ];
        return Tdfs.find(query.$or ? { $or: query.$or } : query);
    }

    // Students can only see TDFs they have explicit access to
    const user = Meteor.users.findOne(this.userId);
    const accessedTDFs = user?.accessedTDFs || [];
    query._id = { $in: accessedTDFs };
    return Tdfs.find(query);
});

Meteor.publish('Assignments', function(courseId) {
    return Assignments.find({courseId: courseId});
});

Meteor.publish('settings', function() {
    // Security: Only admins should see system settings
    if (!this.userId || !Roles.userIsInRole(this.userId, ['admin'])) {
        return this.ready();
    }
    return DynamicSettings.find();
});