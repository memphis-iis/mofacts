// Syntactic validation for bounded, JSON-only audit proof envelopes. Error
// messages name contract fields, never values supplied by the operator.
export function proofRecord(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).length !== keys.length
    || keys.some((key) => !Object.hasOwn(value, key))) {
    throw new Error('Audit proof has unexpected or missing fields');
  }
  return value as Record<string, unknown>;
}

export function proofString(value: unknown, pattern: RegExp, maxLength: number): string {
  if (typeof value !== 'string' || value.length > maxLength || !pattern.test(value)) {
    throw new Error('Audit proof contains an invalid string');
  }
  return value;
}

export function proofBoolean(value: unknown): boolean {
  if (typeof value !== 'boolean') throw new Error('Audit proof contains an invalid boolean');
  return value;
}

export const sourceCommit = (value: unknown): string => proofString(value, /^[a-f0-9]{40}$/, 40);
export const contentDigest = (value: unknown): string => proofString(value, /^[a-f0-9]{64}$/, 64);
export const imageDigest = (value: unknown): string => proofString(value, /^sha256:[a-f0-9]{64}$/, 71);
