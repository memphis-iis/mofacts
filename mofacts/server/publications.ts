import { Roles } from 'meteor/alanning:roles';
import { Meteor } from 'meteor/meteor';
import {
    canViewDashboardTdf,
    hasSharedTdfAccess,
    isTdfOwner,
} from './lib/contentAccessPolicy';
import {
    createTdfPublicationAccessResolver,
    normalizeIdList,
    normalizeOptionalStringId,
} from './lib/tdfPublicationAccess';
import { createLessonFamilyResolver } from './lib/tdfLessonFamilyResolver';
import {
    createExperimentTargetFamilyResolver,
    normalizeExperimentTarget,
} from './lib/experimentTargetFamilyResolver';
import { DynamicSettings } from '../common/Collections';
import { CLIENT_VERBOSITY_SETTING } from '../common/loggingSettings';
import { themeRegistry } from './lib/themeRegistry';
import { ensurePublishedDeploymentBrandProfile } from './lib/deploymentBrandProfileRegistry';
import { DEPLOYMENT_BRAND_PROFILE_KEY } from '../common/deploymentBrandProfile';
import { assignmentMemberTdfIds } from '../common/progressiveAssignments';

// Use Meteor.roleAssignment — set unconditionally by alanning:roles v4 at
// package load time. The named export RoleAssignmentCollection resolves to
// undefined in the webpack bundle due to module loading order.
const getRoleAssignment = () => (Meteor as any).roleAssignment;

function fieldsWithoutId(document: Record<string, any>) {
    const { _id, ...fields } = document;
    return fields;
}

function normalizePageRequest(page: unknown, limit: unknown, maximumLimit = 200) {
    const normalizedPage = Number(page);
    const normalizedLimit = Number(limit);
    if (!Number.isInteger(normalizedPage) || normalizedPage < 0) return undefined;
    if (!Number.isInteger(normalizedLimit) || normalizedLimit < 1 || normalizedLimit > maximumLimit) {
        return undefined;
    }
    return { page: normalizedPage, limit: normalizedLimit };
}

function buildFilteredUsersSelector(filter: unknown) {
    const normalizedFilter = typeof filter === 'string' ? filter.trim() : '';
    if (!normalizedFilter) return {};
    return {
        $or: [
            { username: { $regex: normalizedFilter, $options: 'i' } },
            { email_canonical: { $regex: normalizedFilter, $options: 'i' } },
            { 'emails.address': { $regex: normalizedFilter, $options: 'i' } },
        ],
    };
}

// Auto-publish the current user's role assignments so client-side
// minimongo is populated for synchronous role checks in roleUtils.ts.
Meteor.publish(null, function() {
  if (!this.userId) return this.ready();
  return getRoleAssignment().find({'user._id': this.userId});
});

export const DYNAMIC_ASSET_PUBLICATION_FIELDS = {
    _id: 1,
    name: 1,
    fileName: 1,
    type: 1,
    size: 1,
    uploadedAt: 1,
    userId: 1,
    path: 1,
    meta: 1,
    ext: 1,
    extension: 1,
    extensionWithDot: 1,
    isImage: 1,
    isAudio: 1,
    isVideo: 1,
    versions: 1
};

export const TDF_RUNTIME_SECRET_EXCLUSION_FIELDS = {
    'content.tdfs.tutor.setspec.speechAPIKey': 0,
    'content.tdfs.tutor.setspec.textToSpeechAPIKey': 0,
    'content.tdfs.tutor.setspec.openRouterApiKey': 0
};

// ===== Admin user-page snapshots =====
// This is intentionally a non-reactive snapshot publication. Meteor Change
// Streams cannot represent a moving skip/limit result window without polling.
Meteor.publish('filteredUsers', async function(filter = '', page = 0, limit = 50) {
    // Security check - must be admin
    if (!this.userId) {
        return this.ready();
    }

    const isAdmin = await Roles.userIsInRoleAsync(this.userId, ['admin']);

    if (!isAdmin) {
        return this.ready();
    }

    const pageRequest = normalizePageRequest(page, limit);
    if (!pageRequest) return this.ready();
    const query = buildFilteredUsersSelector(filter);

    // For admins: also publish all role-assignment docs so the client
    // roleUtils can correctly display and toggle roles for any user.
    // There are only ever a small number of assigned roles so this is cheap.
    const pagedUsers = await (Meteor.users.find(query, {
        fields: { username: 1, email_canonical: 1, emails: 1 },
        sort: { username: 1 },
        skip: pageRequest.page * pageRequest.limit,
        limit: pageRequest.limit,
    }) as any).fetchAsync();

    for (const user of pagedUsers) {
        this.added('users', user._id, fieldsWithoutId(user));
        this.added('filtered_user_page_ids', user._id, { userId: user._id });
    }

    const roleAssignments = await (getRoleAssignment().find({}) as any).fetchAsync();
    const roleAssignmentCollectionName = getRoleAssignment()._name;
    if (typeof roleAssignmentCollectionName !== 'string' || !roleAssignmentCollectionName) {
        throw new Error('Role assignment collection name is unavailable for the admin snapshot publication');
    }
    for (const assignment of roleAssignments) {
        this.added(roleAssignmentCollectionName, assignment._id, fieldsWithoutId(assignment));
    }

    this.ready();
});

// Publish total count for pagination UI
Meteor.publish('filteredUsersCount', async function(filter = '') {
    // Security check - must be admin
    if (!this.userId) {
        return this.ready();
    }

    const isAdmin = await Roles.userIsInRoleAsync(this.userId, ['admin']);

    if (!isAdmin) {
        return this.ready();
    }

    const query = buildFilteredUsersSelector(filter);

    // Use Counts package pattern - publish to a virtual collection
    const count = await (Meteor.users.find(query) as any).countAsync();

    // Publish to a client-side only collection
    const self = this;
    self.added('user_counts', 'filtered', { count });
    self.ready();

    // No reactivity needed - count updates on re-subscribe
});

Meteor.publish('userAdminDashboardUsage', async function(userIds: any[] = []) {
    if (!this.userId) {
        return this.ready();
    }

    const isAdmin = await Roles.userIsInRoleAsync(this.userId, ['admin']);
    if (!isAdmin) {
        return this.ready();
    }

    const normalizedUserIds = normalizeIdList(userIds).slice(0, 100);
    if (normalizedUserIds.length === 0) {
        return this.ready();
    }

    return UserDashboardCache.find(
        { userId: { $in: normalizedUserIds } },
        {
            fields: {
                userId: 1,
                usageSummary: 1,
                lastUpdated: 1,
                version: 1
            }
        }
    );
});

// ===== PHASE 1.5 OPTIMIZATION: Theme Publication =====
// Publish theme settings reactively instead of using method calls
// This allows clients to get automatic updates when theme changes
Meteor.publish('theme', async function() {
    // Theme is public data - available to all users (even unauthenticated)
    // This is safe because theme only contains visual styling, no sensitive data
    await themeRegistry.ensureActiveTheme();
    return DynamicSettings.find({key: 'customTheme'});
});

Meteor.publish('themeLibrary', function() {
    return DynamicSettings.find({key: 'themeLibrary'});
});

Meteor.publish('deploymentBrandProfile', async function() {
    await ensurePublishedDeploymentBrandProfile();
    return DynamicSettings.find({ key: DEPLOYMENT_BRAND_PROFILE_KEY });
});

// ===== PHASE 1.7: User History Publication =====
// Publish user's practice history for dashboard statistics
// Security: Only publishes user's own history with sparse fields
// This eliminates N+1 query pattern in learning dashboard
Meteor.publish('userHistory', function(tdfId: any) {
    // Security check - must be authenticated
    if (!this.userId) {
        return this.ready();
    }

    // Query parameters - only user's own history
    const query: any = {
        userId: this.userId,
        levelUnitType: 'model'
    };

    // If tdfId provided, filter by specific TDF
    if (tdfId) {
        query.TDFId = tdfId;
    }

    // Sparse fields - only what dashboard needs for stats calculation
    // This reduces data transfer and client memory usage
    const fields = {
        userId: 1,
        TDFId: 1,
        outcome: 1,
        CFEndLatency: 1,
        CFFeedbackLatency: 1,
        stimuliSetId: 1,
        stimulusKC: 1,
        clusterKC: 1,
        CFStimFileIndex: 1,
        problemName: 1,
        recordedServerTime: 1,
        levelUnitType: 1
    };

    return Histories.find(query, { fields });
});

// ===== PHASE 2: Dashboard Cache Publication =====
// Publish user's pre-computed dashboard statistics
// This provides O(1) dashboard loading instead of N queries
Meteor.publish('dashboardCache', function() {
    // Security check - must be authenticated
    if (!this.userId) {
        return this.ready();
    }

    // Only publish user's own cache
    return UserDashboardCache.find(
        { userId: this.userId },
        {
            fields: {
                userId: 1,
                tdfStats: 1,
                learnerTdfConfigs: 1,
                summary: 1,
                usageSummary: 1,
                lastUpdated: 1,
                version: 1
            }
        }
    );
});

Meteor.publish('files.assets.all', async function () {
    // Security: Filter assets based on user role and ownership
    if (!this.userId) {
        return this.ready(); // No data for unauthenticated users
    }

    const accessibleStimSetIds = await tdfPublicationAccess.resolveAssetStimuliSetIds(this.userId);
    const assetQuery = accessibleStimSetIds.length > 0
        ? {
            $or: [
                { userId: this.userId },
                { 'meta.stimuliSetId': { $in: accessibleStimSetIds } }
            ]
        }
        : { userId: this.userId };

    return DynamicAssets.collection.find(assetQuery, { fields: DYNAMIC_ASSET_PUBLICATION_FIELDS });
});

Meteor.publish('assets', async function(ownerId: any, stimSetId: any) {
    // Security: Require authentication to access stimulus assets
    if (!this.userId) {
        return this.ready();
    }
    if (!stimSetId) {
        return this.ready();
    }

    const stimSetCandidates: any[] = [];
    if (typeof stimSetId === 'number' && Number.isFinite(stimSetId)) {
        stimSetCandidates.push(stimSetId, String(stimSetId));
    } else if (typeof stimSetId === 'string') {
        const trimmed = stimSetId.trim();
        if (trimmed.length > 0) {
            stimSetCandidates.push(trimmed);
            const asNumber = Number(trimmed);
            if (Number.isFinite(asNumber)) {
                stimSetCandidates.push(asNumber);
            }
        }
    }
    const uniqueStimSetCandidates = [...new Set(stimSetCandidates)];
    if (uniqueStimSetCandidates.length === 0) {
        return this.ready();
    }

    const tdf = await Tdfs.findOneAsync(
        { stimuliSetId: { $in: uniqueStimSetCandidates } },
        { fields: { ownerId: 1, accessors: 1 } }
    );
    if (!tdf) {
        throw new Meteor.Error('not-found', 'TDF not found for assets');
    }
    const matchingTdfs = await Tdfs.find(
        { stimuliSetId: { $in: uniqueStimSetCandidates } },
        { fields: { ownerId: 1, accessors: 1 } }
    ).fetchAsync();
    const hasContentUploadAccess = matchingTdfs.some((doc: any) =>
        isTdfOwner(this.userId, doc) || hasSharedTdfAccess(this.userId, doc)
    );
    if (!hasContentUploadAccess) {
        throw new Meteor.Error('not-authorized', 'Only owner or shared accessor can access assets from content upload');
    }

    return DynamicAssets.collection.find(
        { "meta.stimuliSetId": { $in: uniqueStimSetCandidates } },
        { fields: DYNAMIC_ASSET_PUBLICATION_FIELDS }
    );
});

Meteor.publish('userExperimentState', function(tdfId: any) {
    if (tdfId && typeof tdfId === 'object') {
        const normalizedIds = normalizeIdList(tdfId);
        if (!normalizedIds.length) {
            return this.ready();
        }
        return GlobalExperimentStates.find({userId: this.userId, TDFId: {$in: normalizedIds}});
    } else if (tdfId !== null && tdfId !== undefined) {
        const normalizedTdfId = normalizeOptionalStringId(tdfId);
        if (!normalizedTdfId) {
            return this.ready();
        }
        return GlobalExperimentStates.find({userId: this.userId, TDFId: normalizedTdfId});
    }
    return this.ready();
});

async function publishRuntimeTdfsByIds(publication: any, tdfIdOrIds: any) {
    if (!publication.userId) {
        return publication.ready();
    }

    const assignedRootIds = new Set<string>(await resolveAssignedRootTdfIdsForUser(publication.userId as string));
    const assignedConditionIdsPromise = lessonFamilyResolver
        .resolveConditionChildIdsForRootIds(Array.from(assignedRootIds))
        .then((ids: string[]) => new Set(ids));
    const requestedTdfRequiresCourseContext = async (requestedId: string) => {
        if (assignedRootIds.has(requestedId)) {
            return true;
        }
        const assignedConditionIds = await assignedConditionIdsPromise;
        return assignedConditionIds.has(requestedId);
    };
    const canAccessRequestedTdf = async (requestedId: string) => {
        const tdf = await Tdfs.findOneAsync(
            { _id: requestedId },
            { fields: { _id: 1, ownerId: 1, accessors: 1, tdfAvailability: 1, 'content.tdfs.tutor.setspec.userselect': 1 } }
        );
        if (!tdf) {
            return false;
        }
        if (tdf.tdfAvailability === 'repair-required') {
            return false;
        }
        if (await requestedTdfRequiresCourseContext(requestedId)) {
            return false;
        }
        return canViewDashboardTdf(publication.userId, tdf);
    };

    if (tdfIdOrIds && typeof tdfIdOrIds === 'object') {
        const normalizedIds = normalizeIdList(tdfIdOrIds);
        if (!normalizedIds.length) {
            return publication.ready();
        }
        const allowedIds: string[] = [];
        for (const requestedId of normalizedIds) {
            if (await canAccessRequestedTdf(requestedId)) {
                allowedIds.push(requestedId);
            }
        }
        if (!allowedIds.length) {
            return publication.ready();
        }
        return Tdfs.find({ _id: { $in: allowedIds } }, { fields: TDF_RUNTIME_SECRET_EXCLUSION_FIELDS });
    }

    const normalizedTdfId = normalizeOptionalStringId(tdfIdOrIds);
    if (!normalizedTdfId) {
        return publication.ready();
    }
    if (!await canAccessRequestedTdf(normalizedTdfId)) {
        return publication.ready();
    }
    return Tdfs.find({ _id: normalizedTdfId }, { fields: TDF_RUNTIME_SECRET_EXCLUSION_FIELDS });
}

Meteor.publish('currentTdf', async function(tdfId: any) {
    return publishRuntimeTdfsByIds(this, tdfId);
});

Meteor.publish('tdfByIds', async function(tdfIds: any) {
    if (!Array.isArray(tdfIds)) {
        return this.ready();
    }
    return publishRuntimeTdfsByIds(this, tdfIds);
});

// Publication for content/TDF editor - returns TDF with full content for editing
Meteor.publish('tdfForEdit', async function(tdfId: any) {
    if (!this.userId) return this.ready();
    if (!tdfId) return this.ready();

    // Fields needed for both content editor (stimuli) and TDF editor (full content)
    const editFields = {
        rawStimuliFile: 1,
        stimuli: 1,
        stimuliSetId: 1,
        stimulusFileName: 1,
        ownerId: 1,
        accessors: 1,
        content: 1  // Full TDF content for TDF editor
    };

    const tdf = await Tdfs.findOneAsync({ _id: tdfId }, { fields: { ownerId: 1, accessors: 1 } });
    if (!tdf) {
        throw new Meteor.Error('not-found', 'TDF not found');
    }
    if (!isTdfOwner(this.userId, tdf)) {
        throw new Meteor.Error('not-authorized', 'Only owner can edit this TDF');
    }

    return Tdfs.find({ _id: tdfId }, { fields: editFields });
});

// Lightweight publication for editor initial load - excludes full stimuli array
// Use this for faster initial page load, then fetch stimuli separately if needed
Meteor.publish('tdfForEditMetadata', async function(tdfId: any) {
    if (!this.userId) return this.ready();
    if (!tdfId) return this.ready();

    // Metadata fields only - excludes large stimuli array (~90% payload reduction)
    const metadataFields = {
        stimuliSetId: 1,
        stimulusFileName: 1,
        ownerId: 1,
        accessors: 1,
        'content.fileName': 1,
        'content.tdfs.tutor.setspec': 1,
        // Include rawStimuliFile structure info but not full data
        'rawStimuliFile.setspec.clusters': 1,
        'rawStimuliFile.setspec.sparcPages': 1
        // Explicitly EXCLUDES: stimuli (large array)
    };

    const tdf = await Tdfs.findOneAsync({ _id: tdfId }, { fields: { ownerId: 1, accessors: 1 } });
    if (!tdf) {
        throw new Meteor.Error('not-found', 'TDF not found');
    }
    if (!isTdfOwner(this.userId, tdf)) {
        throw new Meteor.Error('not-authorized', 'Only owner can edit this TDF');
    }

    return Tdfs.find({ _id: tdfId }, { fields: metadataFields });
});

// ===== LIGHTWEIGHT TDF LISTING PUBLICATION =====
// For dashboard/listing pages - excludes large 'unit' arrays (50-70% bandwidth savings)
// Use this for pages that only need TDF metadata, not full content
const TDF_LISTING_FIELDS = {
    _id: 1,
    tdfAvailability: 1,
    stimuliSetId: 1,
    ownerId: 1,
    accessors: 1,
    conditionCounts: 1,
    'content.fileName': 1,
    'content.isMultiTdf': 1,
    'content.tdfs.tutor.setspec.lessonname': 1,
    'content.tdfs.tutor.setspec.duedate': 1,
    'content.tdfs.tutor.setspec.tags': 1,
    'content.tdfs.tutor.setspec.contentLanguage': 1,
    'content.tdfs.tutor.setspec.recommendedUiLocales': 1,
    'content.tdfs.tutor.setspec.translationStatus': 1,
    'content.tdfs.tutor.setspec.condition': 1,
    'content.tdfs.tutor.setspec.conditionTdfIds': 1,
    'content.tdfs.tutor.setspec.userselect': 1,
    'content.tdfs.tutor.setspec.experimentTarget': 1,
    'content.tdfs.tutor.setspec.showPageNumbers': 1,
    'content.tdfs.tutor.setspec.speechIgnoreOutOfGrammarResponses': 1,
    'content.tdfs.tutor.setspec.srfilterclose': 1,
    'content.tdfs.tutor.setspec.speechOutOfGrammarFeedback': 1,
    'content.tdfs.tutor.setspec.audioPromptMode': 1,
    'content.tdfs.tutor.setspec.audioInputEnabled': 1,
    'content.tdfs.tutor.setspec.audioInputSensitivity': 1,
    'content.tdfs.tutor.setspec.audioPromptFeedbackSpeakingRate': 1,
    'content.tdfs.tutor.setspec.audioPromptQuestionSpeakingRate': 1,
    'content.tdfs.tutor.setspec.audioPromptVoice': 1,
    'content.tdfs.tutor.setspec.audioPromptQuestionVolume': 1,
    'content.tdfs.tutor.setspec.audioPromptFeedbackVolume': 1,
    'content.tdfs.tutor.setspec.audioPromptFeedbackVoice': 1,
    'content.tdfs.tutor.unit.learningsession': 1,
    'content.tdfs.tutor.unit.autotutorsession': 1
    // Includes only runtime markers from units; still excludes full unit content.
};

const TDF_CONTENT_UPLOAD_DETAIL_FIELDS = {
    _id: 1,
    stimuli: 1,
    stimuliSetId: 1,
    conditionCounts: 1,
    packageFile: 1,
    packageAssetId: 1,
    ownerId: 1,
    accessors: 1,
    rawStimuliFile: 1,
    'content.fileName': 1,
    'content.tdfs.tutor.setspec': 1
};

async function resolveAssignedRootTdfIdsForUser(userId: string) {
    const enrollmentRows = await SectionUserMap.find(
        { userId },
        { fields: { sectionId: 1 } }
    ).fetchAsync();
    const sectionIds = enrollmentRows
        .map((row: any) => normalizeOptionalStringId(row?.sectionId))
        .filter((id: string | null): id is string => !!id);
    if (sectionIds.length === 0) {
        return [];
    }

    const sections = await Sections.find(
        { _id: { $in: sectionIds } },
        { fields: { courseId: 1 } }
    ).fetchAsync();
    const courseIds = sections
        .map((section: any) => normalizeOptionalStringId(section?.courseId))
        .filter((id: string | null): id is string => !!id);
    if (courseIds.length === 0) {
        return [];
    }

    const assignmentRows = await Assignments.find(
        { courseId: { $in: [...new Set(courseIds)] } },
        { fields: { assignmentType: 1, TDFId: 1, memberTdfIds: 1, releaseAt: 1 } }
    ).fetchAsync();
    return assignmentRows
        .flatMap((row: any) => {
            const releaseAt = row.assignmentType === 'progressive' && row.releaseAt ? new Date(row.releaseAt) : null;
            if (releaseAt && Number.isFinite(releaseAt.getTime()) && releaseAt.getTime() > Date.now()) return [];
            return assignmentMemberTdfIds(row);
        })
        .map((id: string) => normalizeOptionalStringId(id))
        .filter((id: string | null): id is string => !!id);
}

const tdfPublicationAccess = createTdfPublicationAccessResolver({
    tdfs: Tdfs as any,
    users: Meteor.users as any,
    roles: Roles,
    resolveAssignedRootTdfIdsForUser
});
const lessonFamilyResolver = createLessonFamilyResolver({ tdfs: Tdfs as any });
const resolveExperimentTargetFamily = createExperimentTargetFamilyResolver({ Tdfs: Tdfs as any });

Meteor.publish('allTdfsListing', async function() {
    // Security: Filter TDFs based on user role and access permissions
    if (!this.userId) {
        return this.ready();
    }

    const selector = await tdfPublicationAccess.resolveListingSelector(this.userId);
    return Tdfs.find(selector, { fields: TDF_LISTING_FIELDS });
});

// ===== DASHBOARD TDF LISTING =====
// Like allTdfsListing, but only shows condition TDFs when their parent is accessible.
Meteor.publish('dashboardTdfsListing', async function() {
    if (!this.userId) {
        return this.ready();
    }

    const selector = await tdfPublicationAccess.resolveDashboardSelector(this.userId);
    return Tdfs.find(selector, { fields: TDF_LISTING_FIELDS });
});

Meteor.publish('tdfForContentUploadDetails', async function(tdfId: any) {
    if (!this.userId || !tdfId || typeof tdfId !== 'string') {
        return this.ready();
    }
    const tdf = await Tdfs.findOneAsync(
        { _id: tdfId },
        { fields: { ownerId: 1, accessors: 1 } }
    );
    if (!tdf || !(isTdfOwner(this.userId, tdf) || hasSharedTdfAccess(this.userId, tdf))) {
        return this.ready();
    }
    return Tdfs.find({ _id: tdfId }, { fields: TDF_CONTENT_UPLOAD_DETAIL_FIELDS });
});

Meteor.publish('contentUploadOwners', async function(ownerIds: any[] = []) {
    if (!this.userId || !Array.isArray(ownerIds) || ownerIds.length === 0) {
        return this.ready();
    }

    const requestedIds = ownerIds.filter((id: any) => typeof id === 'string');
    if (requestedIds.length === 0) {
        return this.ready();
    }

    const allowedOwnerIds = (await Tdfs.find(
        {
            ownerId: this.userId
        },
        { fields: { ownerId: 1 } }
    ).fetchAsync())
        .map((tdf: any) => tdf.ownerId)
        .filter((id: any) => typeof id === 'string' && id.length > 0) as string[];

    const uniqueOwnerIds = [...new Set(allowedOwnerIds)];
    if (uniqueOwnerIds.length === 0) {
        return this.ready();
    }

    return Meteor.users.find(
        { _id: { $in: uniqueOwnerIds } },
        {
            fields: {
                username: 1,
                'profile.displayName': 1,
                'profile.avatarType': 1,
                'profile.avatarIconId': 1,
                'profile.avatarImageData': 1
            }
        }
    );
});

Meteor.publish('ownedTdfs', async function(ownerId: any) {
    // Security: Only allow users to query their own TDFs or if they're admin
    if (!this.userId) {
        return this.ready();
    }

    // Users can only query their own TDFs unless they're admin
    // METEOR 3 FIX: await the async Roles.userIsInRoleAsync() call
    if (ownerId !== this.userId && !(await Roles.userIsInRoleAsync(this.userId, ['admin']))) {
        return this.ready(); // Return empty result
    }

    return Tdfs.find({ ownerId }, { fields: TDF_LISTING_FIELDS });
});

Meteor.publish('pagedTdfsListing', async function(page: any = 0, limit: any = 50) {
    if (!this.userId) {
        return this.ready();
    }

    const pageRequest = normalizePageRequest(page, limit);
    if (!pageRequest) return this.ready();

    const options = {
        fields: TDF_LISTING_FIELDS,
        sort: { 'content.tdfs.tutor.setspec.lessonname': 1, 'content.fileName': 1, _id: 1 },
        skip: pageRequest.page * pageRequest.limit,
        limit: pageRequest.limit
    };

    const selector = await tdfPublicationAccess.resolveListingSelector(this.userId);
    const tdfs = await (Tdfs.find(selector, options) as any).fetchAsync();
    for (const tdf of tdfs) {
        this.added('tdfs', tdf._id, fieldsWithoutId(tdf));
    }
    this.ready();
});

Meteor.publish('tdfByExperimentTarget', async function(experimentTarget: any) {
    // Security: Require authentication
    if (!this.userId) {
        return this.ready();
    }

    const normalizedTarget = normalizeExperimentTarget(experimentTarget);
    if (!normalizedTarget) {
        return this.ready();
    }

    const isAdmin = await Roles.userIsInRoleAsync(this.userId, ['admin']);
    const isTeacher = await Roles.userIsInRoleAsync(this.userId, ['teacher']);
    let rootAccessSelector: any = {};
    if (isTeacher && !isAdmin) {
        rootAccessSelector = {
            $or: [
                { ownerId: this.userId },
                { 'accessors.userId': this.userId },
                { 'content.tdfs.tutor.setspec.userselect': 'true' },
            ],
        };
    } else if (!isAdmin) {
        const user = await (Meteor.users as any).findOneAsync(
            this.userId,
            { fields: { accessedTDFs: 1, profile: 1 } },
        );
        const accessedTDFs = normalizeIdList(user?.accessedTDFs || []);
        const profileTarget = normalizeExperimentTarget(user?.profile?.experimentTarget);
        if (profileTarget !== normalizedTarget && accessedTDFs.length === 0) {
            return this.ready();
        }
        rootAccessSelector = profileTarget === normalizedTarget
            ? {}
            : { _id: { $in: accessedTDFs } };
    }

    const family = await resolveExperimentTargetFamily(normalizedTarget, rootAccessSelector);
    if (!family) return this.ready();
    return Tdfs.find(
        { _id: { $in: family.tdfIds } },
        { fields: TDF_RUNTIME_SECRET_EXCLUSION_FIELDS },
    );
});

Meteor.publish('Assignments', async function(courseId: any) {
    // Security: Require authentication to access course assignments
    if (!this.userId) {
        return this.ready();
    }

    if (typeof courseId !== 'string' || !courseId.trim()) {
        return this.ready();
    }

    // Verify user has access to this course
    const course = await Courses.findOneAsync({ _id: courseId });
    if (!course) {
        return this.ready();
    }

    // Check if user is teacher of this course, enrolled student, or admin
    const isTeacherForCourse = String((course as any).teacherUserId || '') === this.userId;
    const isAdmin = await Roles.userIsInRoleAsync(this.userId, ['admin']);
    let isEnrolledStudent = false;
    if (!isAdmin && !isTeacherForCourse) {
        const sectionIds = (await Sections.find(
            { courseId },
            { fields: { _id: 1 } }
        ).fetchAsync()).map((section: any) => section._id);
        if (sectionIds.length > 0) {
            const enrollment = await SectionUserMap.findOneAsync({
                sectionId: { $in: sectionIds },
                userId: this.userId
            });
            isEnrolledStudent = !!enrollment;
        }
    }

    if (!isTeacherForCourse && !isEnrolledStudent && !isAdmin) {
        return this.ready();
    }

    return Assignments.find({courseId: courseId}, { fields: {
        courseId: 1, assignmentType: 1, TDFId: 1, title: 1, memberTdfIds: 1,
        order: 1, releaseAt: 1, dueAt: 1, required: 1, createdAt: 1, updatedAt: 1,
    } });
});

Meteor.publish('settings', async function() {
    // Security: Only admins should see system settings
    // METEOR 3 FIX: await the async Roles.userIsInRoleAsync() call
    if (!this.userId || !(await Roles.userIsInRoleAsync(this.userId, ['admin']))) {
        return this.ready();
    }
    return DynamicSettings.find();
});

Meteor.publish('clientRuntimeSettings', function() {
    if (!this.userId) {
        return this.ready();
    }

    return DynamicSettings.find(
        { _id: CLIENT_VERBOSITY_SETTING.id },
        { fields: { key: 1, value: 1 } }
    );
});

// Publish user's audio settings
Meteor.publish('userAudioSettings', async function() {
    if (!this.userId) {
        return this.ready();
    }

    const user = await (Meteor.users as any).findOneAsync({ _id: this.userId }, { fields: { audioSettings: 1, audioPromptMode: 1, audioInputMode: 1 } });

    if (!user.audioSettings) {
        const DEFAULT_AUDIO_SETTINGS = {
            audioPromptMode: 'silent',
            audioPromptQuestionVolume: 0,
            audioPromptQuestionSpeakingRate: 1,
            audioPromptVoice: 'en-US-Standard-A',
            audioPromptFeedbackVolume: 0,
            audioPromptFeedbackSpeakingRate: 1,
            audioPromptFeedbackVoice: 'en-US-Standard-A',
            audioInputMode: false,
            audioInputSensitivity: 60,
        };

        const initialSettings = {
            ...DEFAULT_AUDIO_SETTINGS,
            audioPromptMode: user.audioPromptMode || DEFAULT_AUDIO_SETTINGS.audioPromptMode,
            audioInputMode: user.audioInputMode || DEFAULT_AUDIO_SETTINGS.audioInputMode,
        };

        // Save initialized settings
        await (Meteor.users as any).updateAsync(
            { _id: this.userId },
            { $set: { audioSettings: initialSettings } }
        );
    }

    // IMPORTANT: Include roles and preferences fields to prevent flash/issues
    // When this subscription merges with client minimongo, it needs to preserve
    // essential fields like roles and preferences, otherwise helpers will temporarily fail
    return Meteor.users.find(
        { _id: this.userId },
        {
            fields: {
                audioSettings: 1,
                preferences: 1,
                lastSessionId: 1,
                lastSessionIdTimestamp: 1
            }
        }
    );
});
