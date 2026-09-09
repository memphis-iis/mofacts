import { parseBuildIdentity, type BuildIdentityV1 } from './buildIdentity.ts';
import { contentDigest, imageDigest, proofBoolean, proofRecord, proofString, sourceCommit } from './proofFields.ts';

// Draft extension of the existing workstation record, not a new release file.
// Acquisition, transport, storage and runtime enforcement are deliberately absent.
export const RELEASE_PROOF_COMMANDS = ['build', 'smoke', 'push', 'deploy', 'verify'] as const;
type CommandName = typeof RELEASE_PROOF_COMMANDS[number];
export type CommandObservation =
  | { state: 'completed'; exitCode: number }
  | { state: 'unavailable'; reason: 'not-run' | 'spawn-failed' | 'timed-out' };

type ImageObservation = { configDigest: string; platform: string };
type PublishedImage = ImageObservation & (
  | { kind: 'manifest'; digest: string }
  | { kind: 'index'; digest: string; platformManifestDigest: string }
);
type SourceVerification =
  | { state: 'observed'; sourceSnapshotDigestSha256: string; result: 'PASS' | 'FAIL' | 'ERROR' }
  | { state: 'unavailable' };

export type ReleaseQualificationV1 = {
  schema: 'ReleaseQualificationV1';
  buildIdentity: BuildIdentityV1;
  sourceVerification: SourceVerification;
  builtImage: ImageObservation;
  publishedImage: PublishedImage;
  runningImage: ImageObservation & { baseCommit: string };
  commands: Record<CommandName, CommandObservation>;
};

export type WorkstationReleaseRecord = {
  deployedAtUtc: string;
  baseCommit: string;
  includedUncommittedLocalChanges: boolean;
  image: string;
  tag: string;
  // Keep the existing registry digest: it may identify an index or a manifest.
  digest: string;
  qualification?: ReleaseQualificationV1;
};

export type ReleaseIdentityResult =
  | { status: 'PASS' }
  | { status: 'ERROR'; reason:
    'proof-unavailable' | 'malformed-proof' | 'command-unavailable' | 'command-failed'
    | 'source-unverified' | 'source-mismatch' | 'image-mismatch' };

const platform = (value: unknown): string => proofString(value, /^[a-z0-9]+\/[a-z0-9]+(?:\/v[0-9]+)?$/, 40);

function parseCommand(value: unknown): CommandObservation {
  if (value && typeof value === 'object' && 'state' in value && value.state === 'completed') {
    const record = proofRecord(value, ['state', 'exitCode']);
    if (typeof record.exitCode !== 'number' || !Number.isSafeInteger(record.exitCode)
      || record.exitCode < -2147483648 || record.exitCode > 2147483647) {
      throw new Error('Invalid command exit code');
    }
    return { state: 'completed', exitCode: record.exitCode };
  }
  const record = proofRecord(value, ['state', 'reason']);
  if (record.state !== 'unavailable' || typeof record.reason !== 'string'
    || !['not-run', 'spawn-failed', 'timed-out'].includes(record.reason)) {
    throw new Error('Invalid unavailable command observation');
  }
  return { state: 'unavailable', reason: record.reason as 'not-run' | 'spawn-failed' | 'timed-out' };
}

function parseSourceVerification(value: unknown): SourceVerification {
  if (value && typeof value === 'object' && 'state' in value && value.state === 'unavailable') {
    proofRecord(value, ['state']);
    return { state: 'unavailable' };
  }
  const record = proofRecord(value, ['state', 'sourceSnapshotDigestSha256', 'result']);
  if (record.state !== 'observed' || typeof record.result !== 'string' || !['PASS', 'FAIL', 'ERROR'].includes(record.result)) {
    throw new Error('Invalid source verification observation');
  }
  return {
    state: 'observed',
    sourceSnapshotDigestSha256: contentDigest(record.sourceSnapshotDigestSha256),
    result: record.result as 'PASS' | 'FAIL' | 'ERROR',
  };
}

function parseImage(value: unknown): ImageObservation {
  const record = proofRecord(value, ['configDigest', 'platform']);
  return { configDigest: imageDigest(record.configDigest), platform: platform(record.platform) };
}

export function parseReleaseQualification(value: unknown): ReleaseQualificationV1 {
  const record = proofRecord(value, [
    'schema', 'buildIdentity', 'sourceVerification', 'builtImage', 'publishedImage', 'runningImage', 'commands',
  ]);
  if (record.schema !== 'ReleaseQualificationV1') throw new Error('Unsupported release qualification schema');
  const published = record.publishedImage;
  const isIndex = Boolean(published && typeof published === 'object' && 'kind' in published && published.kind === 'index');
  const publishedRecord = proofRecord(published, isIndex
    ? ['kind', 'digest', 'platformManifestDigest', 'configDigest', 'platform']
    : ['kind', 'digest', 'configDigest', 'platform']);
  if (publishedRecord.kind !== 'index' && publishedRecord.kind !== 'manifest') {
    throw new Error('Invalid published image kind');
  }
  const publishedBase = {
    digest: imageDigest(publishedRecord.digest),
    configDigest: imageDigest(publishedRecord.configDigest),
    platform: platform(publishedRecord.platform),
  };
  const publishedImage: PublishedImage = isIndex
    ? { ...publishedBase, kind: 'index', platformManifestDigest: imageDigest(publishedRecord.platformManifestDigest) }
    : { ...publishedBase, kind: 'manifest' };
  const running = proofRecord(record.runningImage, ['configDigest', 'platform', 'baseCommit']);
  const commandRecord = proofRecord(record.commands, RELEASE_PROOF_COMMANDS);
  const commands = Object.fromEntries(
    RELEASE_PROOF_COMMANDS.map((name) => [name, parseCommand(commandRecord[name])]),
  ) as Record<CommandName, CommandObservation>;
  return {
    schema: 'ReleaseQualificationV1',
    buildIdentity: parseBuildIdentity(record.buildIdentity),
    sourceVerification: parseSourceVerification(record.sourceVerification),
    builtImage: parseImage(record.builtImage),
    publishedImage,
    runningImage: { configDigest: imageDigest(running.configDigest), platform: platform(running.platform), baseCommit: sourceCommit(running.baseCommit) },
    commands,
  };
}

export function parseWorkstationReleaseRecord(value: unknown): WorkstationReleaseRecord {
  const keys = ['deployedAtUtc', 'baseCommit', 'includedUncommittedLocalChanges', 'image', 'tag', 'digest'];
  const hasQualification = Boolean(value && typeof value === 'object' && Object.hasOwn(value, 'qualification'));
  const record = proofRecord(value, hasQualification ? [...keys, 'qualification'] : keys);
  // PowerShell's existing DateTime.ToString('o') uses seven fractional digits.
  // Accept that exact current representation as well as JS's millisecond ISO.
  const deployedAtUtc = proofString(record.deployedAtUtc, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}(?:\d{4})?Z$/, 32);
  const millisecondTime = deployedAtUtc.replace(/(\.\d{3})\d{4}Z$/, '$1Z');
  if (!Number.isFinite(Date.parse(millisecondTime)) || new Date(millisecondTime).toISOString() !== millisecondTime) {
    throw new Error('Invalid release timestamp');
  }
  const tag = proofString(record.tag, /^[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}$/, 128);
  const image = proofString(record.image, /^[a-z0-9][a-z0-9._:/-]*:[A-Za-z0-9_][A-Za-z0-9_.-]*$/, 300);
  if (image.includes('://') || !image.endsWith(`:${tag}`)) throw new Error('Invalid tagged release image');
  const result: WorkstationReleaseRecord = {
    deployedAtUtc,
    baseCommit: sourceCommit(record.baseCommit),
    includedUncommittedLocalChanges: proofBoolean(record.includedUncommittedLocalChanges),
    image, tag, digest: imageDigest(record.digest),
  };
  if (hasQualification) result.qualification = parseReleaseQualification(record.qualification);
  return result;
}

// Checks consistency of acquired proof, NOT authenticity, complete verification
// coverage, application safety, or authority to deploy. No code calls this from
// startup, /health, authorization, the command sheet, or the active V1 scanner.
export function evaluateReleaseIdentity(value: unknown): ReleaseIdentityResult {
  let record: WorkstationReleaseRecord;
  try { record = parseWorkstationReleaseRecord(value); }
  catch { return { status: 'ERROR', reason: 'malformed-proof' }; }
  const proof = record.qualification;
  if (!proof) return { status: 'ERROR', reason: 'proof-unavailable' };
  if (Object.values(proof.commands).some((result) => result.state === 'unavailable')) {
    return { status: 'ERROR', reason: 'command-unavailable' };
  }
  if (Object.values(proof.commands).some((result) => result.state === 'completed' && result.exitCode !== 0)) {
    return { status: 'ERROR', reason: 'command-failed' };
  }
  if (proof.sourceVerification.state !== 'observed' || proof.sourceVerification.result !== 'PASS') {
    return { status: 'ERROR', reason: 'source-unverified' };
  }
  if (record.baseCommit !== proof.buildIdentity.baseCommit || record.baseCommit !== proof.runningImage.baseCommit
    || record.includedUncommittedLocalChanges !== proof.buildIdentity.includedUncommittedLocalChanges
    || proof.sourceVerification.sourceSnapshotDigestSha256 !== proof.buildIdentity.sourceSnapshotDigestSha256) {
    return { status: 'ERROR', reason: 'source-mismatch' };
  }
  if (record.digest !== proof.publishedImage.digest
    || proof.builtImage.configDigest !== proof.publishedImage.configDigest
    || proof.builtImage.configDigest !== proof.runningImage.configDigest
    || proof.builtImage.platform !== proof.publishedImage.platform
    || proof.builtImage.platform !== proof.runningImage.platform) {
    return { status: 'ERROR', reason: 'image-mismatch' };
  }
  return { status: 'PASS' };
}
