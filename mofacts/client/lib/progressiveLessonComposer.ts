import type { ProgressiveAssignmentLaunchPayload } from '../../common/courseAssignments.contracts';
import { parseProgressiveClusterList } from '../../common/progressiveAssignments';
import { createStimulusKey } from '../../../learning-components/runtime/historyStimulusIdentity';
import { normalizeClusterKC } from '../../../learning-components/runtime/sharedModelPracticeIdentity';

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function requireArray(value: unknown, message: string): any[] {
  if (!Array.isArray(value)) throw new Error(message);
  return value;
}

function forceUnlimitedDeliverySettings(source: unknown): unknown {
  if (Array.isArray(source)) {
    return source.map((entry) => ({ ...(entry || {}), practiceseconds: 0 }));
  }
  return { ...((source && typeof source === 'object') ? source : {}), practiceseconds: 0 };
}

export function composeProgressiveLesson(payload: ProgressiveAssignmentLaunchPayload): any {
  if (!payload || payload.tdfs.length !== payload.memberTdfIds.length || payload.tdfs.length < 2) {
    throw new Error('[Progressive Lesson] Launch payload does not contain the authorized progression prefix');
  }
  const endpoint = payload.tdfs[payload.tdfs.length - 1];
  if (String(endpoint?._id || '') !== payload.endpointTdfId) {
    throw new Error('[Progressive Lesson] Endpoint lesson does not match the authorized progression prefix');
  }

  const mergedByCluster = new Map<string, { cluster: any; flatStimuli: any[]; stimulusKeys: Set<string> }>();
  for (const [memberIndex, tdf] of payload.tdfs.entries()) {
    const tdfId = String(tdf?._id || '');
    if (tdfId !== payload.memberTdfIds[memberIndex]) {
      throw new Error('[Progressive Lesson] Member lesson order does not match the authorized progression');
    }
    const units = requireArray(tdf?.content?.tdfs?.tutor?.unit, `[Progressive Lesson] ${tdfId} has no unit array`);
    const practiceUnit = units[1];
    const clusterIndexes = parseProgressiveClusterList(practiceUnit?.learningsession?.clusterlist);
    const rawClusters = requireArray(tdf?.rawStimuliFile?.setspec?.clusters, `[Progressive Lesson] ${tdfId} has no raw stimulus clusters`);
    const flatStimuli = requireArray(tdf?.stimuli, `[Progressive Lesson] ${tdfId} has no stimulus records`);
    const stimuliSetId = tdf?.stimuliSetId;
    let flatOffset = 0;
    const flatByCluster = rawClusters.map((cluster: any) => {
      const count = requireArray(cluster?.stims, `[Progressive Lesson] ${tdfId} contains a cluster without stimuli`).length;
      const slice = flatStimuli.slice(flatOffset, flatOffset + count);
      flatOffset += count;
      if (slice.length !== count) throw new Error(`[Progressive Lesson] ${tdfId} stimulus records do not align with raw clusters`);
      return slice;
    });
    if (flatOffset !== flatStimuli.length) {
      throw new Error(`[Progressive Lesson] ${tdfId} contains unmapped stimulus records`);
    }

    for (const clusterIndex of clusterIndexes) {
      const sourceCluster = rawClusters[clusterIndex];
      const clusterKC = normalizeClusterKC(sourceCluster?.clusterKC);
      let merged = mergedByCluster.get(clusterKC);
      if (!merged) {
        merged = {
          cluster: { ...clone(sourceCluster), clusterKC, stims: [] },
          flatStimuli: [],
          stimulusKeys: new Set<string>(),
        };
        mergedByCluster.set(clusterKC, merged);
      }
      const sourceRawStims = requireArray(sourceCluster?.stims, `[Progressive Lesson] ${tdfId} cluster ${clusterIndex} has no stimuli`);
      const sourceFlatStims = flatByCluster[clusterIndex] || [];
      for (const [stimIndex, rawStimulus] of sourceRawStims.entries()) {
        const flatStimulus = sourceFlatStims[stimIndex];
        const stimulusKC = rawStimulus?.stimulusKC ?? flatStimulus?.stimulusKC;
        const stimulusKey = createStimulusKey({ stimuliSetId, stimulusKC });
        if (merged.stimulusKeys.has(stimulusKey)) continue;
        merged.stimulusKeys.add(stimulusKey);
        merged.cluster.stims.push(clone(rawStimulus));
        merged.flatStimuli.push({
          ...clone(flatStimulus),
          stimuliSetId,
          stimulusKC,
          clusterKC,
          progressiveSourceTdfId: tdfId,
          progressiveSourceUnitName: String(practiceUnit?.unitname || ''),
        });
      }
    }
  }

  const mergedEntries = [...mergedByCluster.values()];
  if (mergedEntries.length === 0) throw new Error('[Progressive Lesson] Progression contains no practice clusters');
  const content = clone(endpoint.content);
  const tutor = content?.tdfs?.tutor;
  // Member-local ranges refer to the original lesson, not the concatenated
  // progression. Keep the composed order without changing individual lessons.
  delete tutor.setspec.shuffleclusters;
  delete tutor.setspec.swapclusters;
  const units = requireArray(tutor?.unit, '[Progressive Lesson] Endpoint has no unit array');
  const practiceUnit = units[1];
  practiceUnit.learningsession = {
    ...practiceUnit.learningsession,
    clusterlist: `0-${mergedEntries.length - 1}`,
    maxTrials: 0,
  };
  tutor.deliverySettings = forceUnlimitedDeliverySettings(tutor.deliverySettings);
  practiceUnit.deliverySettings = forceUnlimitedDeliverySettings(practiceUnit.deliverySettings);
  content.fileName = `progressive:${payload.assignmentId}:${payload.endpointTdfId}`;
  content.stimuliSetId = endpoint.stimuliSetId;
  content.stimuli = mergedEntries.flatMap((entry) => entry.flatStimuli);
  content.rawStimuliFile = {
    setspec: {
      ...(clone(endpoint.rawStimuliFile?.setspec || {})),
      clusters: mergedEntries.map((entry) => entry.cluster),
    },
  };
  return {
    _id: payload.endpointTdfId,
    stimuliSetId: endpoint.stimuliSetId,
    content,
    rawStimuliFile: content.rawStimuliFile,
    progressiveAssignmentId: payload.assignmentId,
    progressiveMemberTdfIds: payload.memberTdfIds,
  };
}
