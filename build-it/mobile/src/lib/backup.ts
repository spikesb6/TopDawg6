// Backup codes are base64 of the UTF-8 JSON, the same encoding the web app uses, so a code
// copied on one restores on the other. Written by hand because Hermes lacks escape/unescape.
import { mergeState, type BuildState } from '@/lib/state';

const ABC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function utf8Bytes(s: string): number[] {
  const out: number[] = [];
  for (const ch of s) {
    const c = ch.codePointAt(0)!;
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
    else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    else out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
  }
  return out;
}

function fromUtf8(bytes: number[]): string {
  let s = '';
  for (let i = 0; i < bytes.length; ) {
    const b = bytes[i];
    let c: number;
    if (b < 0x80) { c = b; i += 1; }
    else if (b < 0xe0) { c = ((b & 31) << 6) | (bytes[i + 1] & 63); i += 2; }
    else if (b < 0xf0) { c = ((b & 15) << 12) | ((bytes[i + 1] & 63) << 6) | (bytes[i + 2] & 63); i += 3; }
    else { c = ((b & 7) << 18) | ((bytes[i + 1] & 63) << 12) | ((bytes[i + 2] & 63) << 6) | (bytes[i + 3] & 63); i += 4; }
    s += String.fromCodePoint(c);
  }
  return s;
}

export function toBase64(text: string): string {
  const b = utf8Bytes(text);
  let out = '';
  for (let i = 0; i < b.length; i += 3) {
    const n = (b[i] << 16) | ((b[i + 1] ?? 0) << 8) | (b[i + 2] ?? 0);
    out += ABC[(n >> 18) & 63] + ABC[(n >> 12) & 63];
    out += i + 1 < b.length ? ABC[(n >> 6) & 63] : '=';
    out += i + 2 < b.length ? ABC[n & 63] : '=';
  }
  return out;
}

export function fromBase64(code: string): string {
  const clean = code.replace(/[^A-Za-z0-9+/]/g, '');
  const bytes: number[] = [];
  for (let i = 0; i < clean.length; i += 4) {
    const v = [0, 1, 2, 3].map((k) => ABC.indexOf(clean[i + k] ?? 'A'));
    const n = (v[0] << 18) | (v[1] << 12) | (v[2] << 6) | v[3];
    bytes.push((n >> 16) & 255);
    if (i + 2 < clean.length) bytes.push((n >> 8) & 255);
    if (i + 3 < clean.length) bytes.push(n & 255);
  }
  return fromUtf8(bytes);
}

export function makeBackup(state: BuildState): string {
  return toBase64(JSON.stringify(state));
}

/** Returns the restored build, or null when the code is not a Build It backup. */
export function readBackup(code: string): BuildState | null {
  try {
    const d = JSON.parse(fromBase64(code.trim()));
    if (!d || typeof d !== 'object' || !d.profile || !d.done) return null;
    return mergeState(d);
  } catch {
    return null;
  }
}
