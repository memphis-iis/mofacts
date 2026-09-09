import { expect } from 'chai';
import { composeProgressiveLesson } from './progressiveLessonComposer';
import {
  createStimClusterMapping,
  isClusterMappingCompatibleWithSetSpec,
} from '../../../learning-components/content/tdf/clusterMapping';

function member(id: string, setId: string, clusterKC: string, stimulusKC: string, responseKC: string) {
  return {
    _id: id,
    stimuliSetId: setId,
    content: {
      fileName: `${id}.json`,
      tdfs: {
        tutor: {
          setspec: { lessonname: id },
          deliverySettings: { practiceseconds: 99, optimalThreshold: 0.75 },
          unit: [
            { unitname: 'Instructions', unitinstructions: '<p>Instructions</p>' },
            {
              unitname: `${id} practice`,
              learningsession: { clusterlist: '0', maxTrials: 25, unitMode: 'drill' },
              deliverySettings: { practiceseconds: 88 },
            },
          ],
        },
      },
    },
    rawStimuliFile: {
      setspec: {
        clusters: [{
          clusterKC,
          stims: [{ stimulusKC, response: { correctResponse: id }, parameter: '1,2' }],
        }],
      },
    },
    stimuli: [{ stimuliSetId: setId, clusterKC, stimulusKC, responseKC, correctResponse: id, params: '1,2' }],
  };
}

describe('progressive lesson composition', function() {
  it('preserves member and stimulus order without inheriting local shuffles or swaps', function() {
    const first = member('lesson-2', 'set-2', 'cluster-2a', 'stim-2a', 'response-2a');
    const next = member('lesson-1', 'set-1', 'cluster-1a', 'stim-1a', 'response-1a');
    for (const tdf of [first, next]) {
      Object.assign(tdf.content.tdfs.tutor.setspec, {
        shuffleclusters: '0-1', swapclusters: ['0', '1'],
      });
      const extra = member(`${tdf._id}-extra`, tdf.stimuliSetId, `${tdf._id}-extra`, `${tdf._id}-extra`, 'extra');
      tdf.rawStimuliFile.setspec.clusters.push(extra.rawStimuliFile.setspec.clusters[0]!);
      tdf.stimuli.push(extra.stimuli[0]!);
      tdf.content.tdfs.tutor.unit[1]!.learningsession!.clusterlist = '0-1';
    }
    const original = JSON.parse(JSON.stringify([first, next]));
    const payload = {
      progressiveRevisionId: 'revision-1', assignmentId: 'progression-1', courseId: 'course-1',
      title: 'Progression', endpointTdfId: 'lesson-1', memberTdfIds: ['lesson-2', 'lesson-1'], tdfs: [first, next],
    };
    const result = composeProgressiveLesson(payload);
    const setSpec = result.content.tdfs.tutor.setspec;
    expect(setSpec).not.to.have.property('shuffleclusters');
    expect(setSpec).not.to.have.property('swapclusters');
    expect(result.content.stimuli.map((stim: any) => stim.stimulusKC))
      .to.deep.equal(['stim-2a', 'lesson-2-extra', 'stim-1a', 'lesson-1-extra']);
    expect(result.content.stimuli.map((stim: any) => [stim.stimuliSetId, stim.progressiveSourceTdfId, stim.progressiveSourceUnitName]))
      .to.deep.equal([
        ['set-2', 'lesson-2', 'lesson-2 practice'], ['set-2', 'lesson-2', 'lesson-2 practice'],
        ['set-1', 'lesson-1', 'lesson-1 practice'], ['set-1', 'lesson-1', 'lesson-1 practice'],
      ]);
    expect([first, next]).to.deep.equal(original);
    expect(composeProgressiveLesson(payload)).to.deep.equal(result);
    expect(createStimClusterMapping(4, [], [], null)).to.deep.equal([0, 1, 2, 3]);
    expect(isClusterMappingCompatibleWithSetSpec([0, 1, 2, 3], 4, setSpec)).to.equal(true);
    // A previous shuffled resume must be rejected, not reinterpreted against
    // different cards. The existing resume guard leaves recorded history intact.
    expect(isClusterMappingCompatibleWithSetSpec([1, 0, 2, 3], 4, setSpec)).to.equal(false);
  });

  it('merges shared clusters while retaining distinct source-scoped stimuli and endpoint settings', function() {
    const result = composeProgressiveLesson({
      progressiveRevisionId: 'revision-1',
      assignmentId: 'progression-1',
      courseId: 'course-1',
      title: 'Progression',
      endpointTdfId: 'lesson-2',
      memberTdfIds: ['lesson-1', 'lesson-2'],
      tdfs: [
        member('lesson-1', 'set-1', 'shared', 'stim-1', 'response-1'),
        member('lesson-2', 'set-2', 'shared', 'stim-2', 'response-2'),
      ],
    });

    const tutor = result.content.tdfs.tutor;
    expect(tutor.unit[1].learningsession).to.include({ clusterlist: '0-0', maxTrials: 0, unitMode: 'drill' });
    expect(tutor.deliverySettings).to.include({ practiceseconds: 0, optimalThreshold: 0.75 });
    expect(result.content.rawStimuliFile.setspec.clusters).to.have.length(1);
    expect(result.content.rawStimuliFile.setspec.clusters[0].stims).to.have.length(2);
    expect(result.content.stimuli.map((stim: any) => ({
      stimuliSetId: stim.stimuliSetId,
      source: stim.progressiveSourceTdfId,
      unitName: stim.progressiveSourceUnitName,
    }))).to.deep.equal([
      { stimuliSetId: 'set-1', source: 'lesson-1', unitName: 'lesson-1 practice' },
      { stimuliSetId: 'set-2', source: 'lesson-2', unitName: 'lesson-2 practice' },
    ]);
  });
});
