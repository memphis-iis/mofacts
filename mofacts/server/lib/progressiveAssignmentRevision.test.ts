import { expect } from 'chai';
import { progressiveRevisionId, progressiveRevisionPrefix } from './progressiveAssignmentRevision';

describe('progressive ordering authorization', function() {
  const original = ['a', 'b', 'c'];
  const revision = progressiveRevisionId(original);
  const assignment = (members: string[]) => ({
    memberTdfIds: members, progressiveRevisions: { [revision]: original },
  });

  it('retains the launched prefix after insertion and reordering, including moving the endpoint first', function() {
    expect(progressiveRevisionPrefix(assignment(['b', 'new', 'c', 'a']), revision, 'b')).to.deep.equal(['a', 'b']);
  });

  it('rejects missing, fabricated, or altered revisions', function() {
    expect(() => progressiveRevisionPrefix(assignment(original), undefined, 'b')).to.throw('revision');
    expect(() => progressiveRevisionPrefix(assignment(original), '0'.repeat(64), 'b')).to.throw('not authorized');
    expect(() => progressiveRevisionPrefix({ memberTdfIds: original,
      progressiveRevisions: { [revision]: ['a', 'c', 'b'] } }, revision, 'b')).to.throw('not authorized');
  });

  it('rejects first-member endpoints', function() {
    expect(() => progressiveRevisionPrefix(assignment(original), revision, 'a')).to.throw('second');
  });
});
