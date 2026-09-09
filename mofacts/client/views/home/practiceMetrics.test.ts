import { expect } from 'chai';
import { formatItemsPracticed } from './practiceMetrics';

describe('practice item count display', function() {
  for (const totalPracticeItems of [null, undefined, NaN]) {
    it(`shows the practiced count alone for unknown total ${totalPracticeItems}`, function() {
      expect(formatItemsPracticed({ isUsed: true, itemsPracticed: 1, totalPracticeItems })).to.equal('1');
    });
  }
  it('shows a supplied total', function() {
    expect(formatItemsPracticed({ isUsed: true, itemsPracticed: 1, totalPracticeItems: 2 })).to.equal('1 / 2');
  });
  it('preserves a genuinely supplied zero', function() {
    expect(formatItemsPracticed({ isUsed: false, totalPracticeItems: 0 })).to.equal('0 / 0');
  });
  it('preserves non-applicable and unused states', function() {
    expect(formatItemsPracticed({ itemsPracticedApplies: false })).to.equal('-');
    expect(formatItemsPracticed({ isUsed: false, itemsPracticed: 1, totalPracticeItems: null })).to.equal('0');
  });
});
