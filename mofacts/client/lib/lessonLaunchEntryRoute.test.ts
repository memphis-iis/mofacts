import { expect } from 'chai';
import { CARD_ENTRY_INTENT } from './cardEntryIntent';
import { initializeLessonLaunchEntry, resolveLessonLaunchEntryRoute } from './lessonLaunchEntryRoute';

describe('lessonLaunchEntryRoute', function() {
  it('initializes instruction identity without needing navigation (cold reload)', function() {
    const unit = { unitname: 'Instructions', unitinstructions: 'Read first' };
    const state: Record<string, unknown> = {};
    const entry = initializeLessonLaunchEntry({
      content: { tdfs: { tutor: { unit: [unit] } } },
      intent: CARD_ENTRY_INTENT.INITIAL_TDF_ENTRY,
    }, (key, value) => { state[key] = value; });
    expect(entry.route).to.equal('/instructions');
    expect(state).to.deep.equal({ currentUnitNumber: 0, currentTdfUnit: unit, curUnitInstructionsSeen: false });
  });

  it('leaves persisted unit restoration to the content lifecycle, never resets to zero', function() {
    const writes: string[] = [];
    const entry = initializeLessonLaunchEntry({
      content: { tdfs: { tutor: { unit: [{ unitinstructions: 'Read first' }] } } },
      intent: CARD_ENTRY_INTENT.PERSISTED_PROGRESS_RESUME,
    }, (key) => { writes.push(key); });
    expect(entry.route).to.equal('/content');
    expect(writes).to.deep.equal([]);
  });

  it('routes an initial instruction-only first unit to instructions', function() {
    const firstUnit = { unitname: 'Instructions', unitinstructions: '<p>Read first</p>' };
    const result = resolveLessonLaunchEntryRoute({
      intent: CARD_ENTRY_INTENT.INITIAL_TDF_ENTRY,
      content: {
        tdfs: {
          tutor: {
            unit: [
              firstUnit,
              { unitname: 'Practice', sparcsession: { clusterlist: '0-6' } },
            ],
          },
        },
      },
    });

    expect(result).to.deep.equal({
      route: '/instructions',
      currentUnitNumber: 0,
      currentTdfUnit: firstUnit,
      curUnitInstructionsSeen: false,
    });
  });

  it('keeps initial runnable units on the card route', function() {
    const result = resolveLessonLaunchEntryRoute({
      intent: CARD_ENTRY_INTENT.INITIAL_TDF_ENTRY,
      content: {
        tdfs: {
          tutor: {
            unit: [
              { unitname: 'Practice', sparcsession: { clusterlist: '0-6' } },
            ],
          },
        },
      },
    });

    expect(result).to.deep.equal({ route: '/content' });
  });

  it('routes an initial condition root to content for condition resolution', function() {
    const result = resolveLessonLaunchEntryRoute({
      intent: CARD_ENTRY_INTENT.INITIAL_TDF_ENTRY,
      content: {
        tdfs: {
          tutor: {
            setspec: {
              condition: ['condition-a.json', 'condition-b.json'],
            },
          },
        },
      },
    });

    expect(result).to.deep.equal({ route: '/content' });
  });

  for (const unit of [
    { unitname: 'Model Practice', learningsession: { clusterlist: '0' } },
    { unitname: 'Assessment Practice', assessmentsession: { clusterlist: '0' } },
    { unitname: 'SPARC Practice', sparcsession: { clusterlist: '0-6' } },
    { unitname: 'Video Practice', videosession: { questions: [] } },
    { unitname: 'AutoTutor Practice', autotutorsession: {} },
  ]) {
    it(`routes initial ${unit.unitname} with instructions to instructions`, function() {
      const unitWithInstructions = {
        ...unit,
        unitinstructions: '<p>Read before practicing</p>',
      };
      const result = resolveLessonLaunchEntryRoute({
        intent: CARD_ENTRY_INTENT.INITIAL_TDF_ENTRY,
        content: {
          tdfs: {
            tutor: {
              unit: [unitWithInstructions],
            },
          },
        },
      });

      expect(result).to.deep.equal({
        route: '/instructions',
        currentUnitNumber: 0,
        currentTdfUnit: unitWithInstructions,
        curUnitInstructionsSeen: false,
      });
    });
  }

  it('keeps persisted progress resumes on the card route', function() {
    const result = resolveLessonLaunchEntryRoute({
      intent: CARD_ENTRY_INTENT.PERSISTED_PROGRESS_RESUME,
      content: {
        tdfs: {
          tutor: {
            unit: [
              { unitname: 'Instructions', unitinstructions: '<p>Read first</p>' },
              { unitname: 'Practice', sparcsession: { clusterlist: '0-6' } },
            ],
          },
        },
      },
    });

    expect(result).to.deep.equal({ route: '/content' });
  });

  it('fails clearly when an initial launch has no unit sequence', function() {
    expect(() => resolveLessonLaunchEntryRoute({
      intent: CARD_ENTRY_INTENT.INITIAL_TDF_ENTRY,
      content: {
        tdfs: {
          tutor: {
            unit: [],
          },
        },
      },
    })).to.throw('initial launch requires a populated tutor.unit array');
  });
});
