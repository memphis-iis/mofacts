import { expect } from 'chai';
import { composeProgressiveLesson } from './progressiveLessonComposer';

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
