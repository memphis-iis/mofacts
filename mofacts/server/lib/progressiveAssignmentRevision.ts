import { createHash } from 'node:crypto';
import { Meteor } from 'meteor/meteor';

// Content-addressed ordering snapshots belong to the assignment. They contain
// no learner data and survive edits, but never override current access revocation.
export function progressiveRevisionId(memberTdfIds: string[]): string {
  return createHash('sha256').update(JSON.stringify(memberTdfIds)).digest('hex');
}

export function progressiveRevisionMembers(assignment: any, revisionId: unknown): string[] {
  if (typeof revisionId !== 'string' || !/^[a-f0-9]{64}$/.test(revisionId)) {
    throw new Meteor.Error(400, 'Progressive launch requires a valid ordering revision; launch again from Courses');
  }
  const members = assignment.progressiveRevisions?.[revisionId];
  if (!Array.isArray(members) || members.length < 2
    || members.some((id: unknown) => typeof id !== 'string' || !id.trim())
    || new Set(members).size !== members.length
    || progressiveRevisionId(members) !== revisionId) {
    throw new Meteor.Error(400, 'Progressive ordering revision was not authorized for this assignment');
  }
  return members;
}

export function progressiveRevisionPrefix(assignment: any, revisionId: unknown, endpoint: string): string[] {
  const members = progressiveRevisionMembers(assignment, revisionId);
  const index = members.indexOf(endpoint);
  if (index < 1) throw new Meteor.Error(400, 'Progressive endpoint must be the second or a later revision member');
  return members.slice(0, index + 1);
}
