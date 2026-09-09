import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { canonicalJson } from '../audit-lib.mjs';

// Acquisition policy, not a replacement for Docker's context/ignore semantics.
export const SNAPSHOT_LIMITS = Object.freeze({
  entries: 100000, bytes: 2 * 1024 ** 3, fileBytes: 256 * 1024 ** 2,
  depth: 64, pathBytes: 1024, metadataBytes: 64 * 1024,
});
export function invalidSnapshot() { throw new Error('Source snapshot validation failed'); }
export const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
export const snapshotDigest = (entries) => sha256(canonicalJson([...entries].sort((a, b) => Buffer.compare(Buffer.from(a[0]), Buffer.from(b[0])))));

export function snapshotPath(value, limits = SNAPSHOT_LIMITS) {
  if (typeof value !== 'string' || value !== value.normalize('NFC') || !value
    || Buffer.byteLength(value) > limits.pathBytes || /[\\:]/u.test(value)
    || [...value].some((character) => character.codePointAt(0) < 32 || character.codePointAt(0) === 127)) invalidSnapshot();
  const parts = value.split('/');
  if (parts.length > limits.depth || parts.some((part) => !part || part === '.' || part === '..'
    || /[. ]$/.test(part) || /[<>"|?*]/.test(part) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part))) invalidSnapshot();
  return value;
}

// A strict streaming reader keeps file contents out of the metadata inventory.
class Bytes {
  constructor(stream, maximum) { this.iterator = stream[Symbol.asyncIterator](); this.pending = Buffer.alloc(0); this.total = 0; this.maximum = maximum; }
  async read(size, eof = false) {
    const pieces = [];
    let remaining = size;
    while (remaining) {
      if (!this.pending.length) {
        const next = await this.iterator.next();
        if (next.done) {
          if (eof && remaining === size) return null;
          invalidSnapshot();
        }
        if (!Buffer.isBuffer(next.value) && !(next.value instanceof Uint8Array)) invalidSnapshot();
        this.pending = Buffer.from(next.value);
        this.total += this.pending.length;
        if (this.total > this.maximum) invalidSnapshot();
        if (!this.pending.length) continue;
      }
      const count = Math.min(remaining, this.pending.length);
      pieces.push(this.pending.subarray(0, count));
      this.pending = this.pending.subarray(count);
      remaining -= count;
    }
    return Buffer.concat(pieces, size);
  }
}

function textField(bytes) {
  const end = bytes.indexOf(0);
  try { return new TextDecoder('utf-8', { fatal: true }).decode(end < 0 ? bytes : bytes.subarray(0, end)); }
  catch { invalidSnapshot(); }
}
function octal(bytes) {
  const text = textField(bytes).trim();
  if (!/^[0-7]+$/.test(text)) invalidSnapshot();
  const value = Number.parseInt(text, 8);
  if (!Number.isSafeInteger(value)) invalidSnapshot();
  return value;
}
function pax(bytes) {
  const fields = {};
  let offset = 0;
  while (offset < bytes.length) {
    const space = bytes.indexOf(32, offset);
    if (space < 0 || space - offset > 8) invalidSnapshot();
    const lengthText = bytes.subarray(offset, space).toString('ascii');
    if (!/^[1-9][0-9]*$/.test(lengthText)) invalidSnapshot();
    const length = Number(lengthText);
    if (length <= space - offset + 2 || offset + length > bytes.length || bytes[offset + length - 1] !== 10) invalidSnapshot();
    const record = textField(bytes.subarray(space + 1, offset + length - 1));
    const equal = record.indexOf('=');
    const key = record.slice(0, equal);
    if (equal < 1 || !['path', 'mtime', 'atime', 'ctime', 'uid', 'gid', 'uname', 'gname'].includes(key)
      || Object.hasOwn(fields, key)) invalidSnapshot();
    fields[key] = record.slice(equal + 1);
    offset += length;
  }
  return fields;
}

// Accept Docker's regular-file/directory ustar + bounded per-file PAX records.
// Reject links/devices/sparse/GNU extensions rather than guessing extraction rules.
// destination MUST be a new empty directory owned by the calling helper.
export async function extractSnapshot(stream, destination, limits = SNAPSHOT_LIMITS) {
  const root = await fs.lstat(destination);
  if (!root.isDirectory() || root.isSymbolicLink() || (await fs.readdir(destination)).length) invalidSnapshot();
  const reader = new Bytes(stream, limits.bytes + limits.entries * 1024 + limits.metadataBytes * 2);
  const seen = new Map();
  const entries = [];
  let total = 0;
  let headers = 0;
  let extension = null;
  let rootSeen = false;
  while (true) {
    const header = await reader.read(512);
    if (header.every((byte) => byte === 0)) {
      if (extension || !(await reader.read(512)).every((byte) => byte === 0)) invalidSnapshot();
      let padding;
      while ((padding = await reader.read(512, true))) if (!padding.every((byte) => byte === 0)) invalidSnapshot();
      break;
    }
    if (++headers > limits.entries * 2 + 1) invalidSnapshot();
    const checksum = header.reduce((sum, byte, index) => sum + (index >= 148 && index < 156 ? 32 : byte), 0);
    if (octal(header.subarray(148, 156)) !== checksum || textField(header.subarray(257, 263)) !== 'ustar') invalidSnapshot();
    const size = octal(header.subarray(124, 136));
    const mode = octal(header.subarray(100, 108));
    const type = header[156];
    if (type === 120) {
      if (extension || size > limits.metadataBytes) invalidSnapshot();
      extension = pax(await reader.read(size));
      await reader.read((512 - size % 512) % 512);
      continue;
    }
    if (![0, 48, 53].includes(type) || textField(header.subarray(157, 257)) || mode > 0o777) invalidSnapshot();
    const prefix = textField(header.subarray(345, 500));
    let name = extension?.path ?? `${prefix ? `${prefix}/` : ''}${textField(header.subarray(0, 100))}`;
    extension = null;
    const directory = type === 53;
    if (directory && size !== 0) invalidSnapshot();
    if (name === './' || name === '.') {
      if (!directory || rootSeen) invalidSnapshot();
      rootSeen = true;
      continue;
    }
    if (name.startsWith('./')) name = name.slice(2);
    if (directory && name.endsWith('/')) name = name.slice(0, -1);
    snapshotPath(name, limits);
    if (entries.length >= limits.entries || seen.has(name.toLowerCase()) || size > limits.fileBytes || total + size > limits.bytes) invalidSnapshot();
    const parent = path.posix.dirname(name);
    if (parent !== '.' && seen.get(parent.toLowerCase()) !== `directory:${parent}`) invalidSnapshot();
    const target = path.join(destination, ...name.split('/'));
    seen.set(name.toLowerCase(), `${directory ? 'directory' : 'file'}:${name}`);
    total += size;
    let digest = null;
    if (directory) {
      // Apply original directory modes only after their children are extracted.
      await fs.mkdir(target, { mode: 0o700 });
    } else {
      const file = await fs.open(target, 'wx', 0o600);
      const hash = createHash('sha256');
      let remaining = size;
      try {
        while (remaining) {
          const chunk = await reader.read(Math.min(remaining, 64 * 1024));
          hash.update(chunk);
          let written = 0;
          while (written < chunk.length) {
            const result = await file.write(chunk, written, chunk.length - written);
            if (!result.bytesWritten) invalidSnapshot();
            written += result.bytesWritten;
          }
          remaining -= chunk.length;
        }
      } finally { await file.close(); }
      await fs.chmod(target, mode);
      digest = hash.digest('hex');
      await reader.read((512 - size % 512) % 512);
    }
    entries.push([name, directory ? 'directory' : 'file', mode, digest]);
  }
  for (const [name, type, mode] of [...entries].reverse()) {
    if (type === 'directory') await fs.chmod(path.join(destination, ...name.split('/')), mode);
  }
  return { entries, bytes: total, sourceSnapshotDigestSha256: snapshotDigest(entries) };
}

// Local tamper observation. This is NOT a Docker-context hash and never filters.
// Docker's re-export digest is required for native-mode/ignore round-trip proof.
export async function inspectSnapshotTree(directory, limits = SNAPSHOT_LIMITS) {
  const entries = [];
  const seen = new Set();
  let bytes = 0;
  async function visit(relative) {
    const absolute = path.join(directory, relative);
    const before = await fs.lstat(absolute, { bigint: true });
    if (before.isSymbolicLink() || (!before.isDirectory() && !before.isFile()) || (before.isFile() && before.nlink !== 1n)) invalidSnapshot();
    if (relative) {
      snapshotPath(relative, limits);
      if (entries.length >= limits.entries || seen.has(relative.toLowerCase())) invalidSnapshot();
      seen.add(relative.toLowerCase());
    }
    if (before.isDirectory()) {
      if (relative) entries.push([relative, 'directory', Number(before.mode & 0o777n), null]);
      const children = await fs.opendir(absolute);
      for await (const child of children) await visit(relative ? `${relative}/${child.name}` : child.name);
    } else {
      const size = Number(before.size);
      if (size > limits.fileBytes || bytes + size > limits.bytes) invalidSnapshot();
      bytes += size;
      const hash = createHash('sha256');
      const file = await fs.open(absolute, 'r');
      try {
        const opened = await file.stat({ bigint: true });
        if (opened.ino !== before.ino || opened.dev !== before.dev || opened.size !== before.size) invalidSnapshot();
        const buffer = Buffer.alloc(64 * 1024);
        let read = 0;
        while (true) {
          const { bytesRead } = await file.read(buffer, 0, Math.min(buffer.length, size - read + 1), null);
          if (!bytesRead) break;
          read += bytesRead;
          if (read > size) invalidSnapshot();
          hash.update(buffer.subarray(0, bytesRead));
        }
        if (read !== size) invalidSnapshot();
      } finally { await file.close(); }
      entries.push([relative, 'file', Number(before.mode & 0o777n), hash.digest('hex')]);
    }
    const after = await fs.lstat(absolute, { bigint: true });
    for (const key of ['dev', 'ino', 'mode', 'size', 'mtimeNs', 'ctimeNs']) if (before[key] !== after[key]) invalidSnapshot();
  }
  await visit('');
  return { digestSha256: snapshotDigest(entries), entries: entries.length, bytes };
}
