import { describe, expect, it } from '@jest/globals';

import { fromBase64, makeBackup, readBackup, toBase64 } from '@/lib/backup';
import { freshState } from '@/lib/state';

describe('backup codes', () => {
  it('encodes UTF-8 exactly like the web app (btoa of UTF-8)', () => {
    for (const s of ['', 'a', 'ab', 'abc', 'Builder’s risk — 2,200 ft²', 'emoji 🏠 ok']) {
      expect(toBase64(s)).toBe(Buffer.from(s, 'utf8').toString('base64'));
      expect(fromBase64(Buffer.from(s, 'utf8').toString('base64'))).toBe(s);
    }
  });

  it('round-trips a build', () => {
    const s = freshState();
    s.profile.name = 'Oak Hill house';
    s.done = { f1: true };
    s.notes = { fo3: 'Passed 4/12 — J. Ruiz' };
    expect(readBackup(makeBackup(s))).toEqual(s);
  });

  it('restores a code made by the web app, filling in missing fields', () => {
    const web = Buffer.from(JSON.stringify({ profile: { name: 'Web' }, done: { l1: true } }), 'utf8').toString('base64');
    const s = readBackup(web)!;
    expect(s.profile.name).toBe('Web');
    expect(s.profile.sqft).toBe(2200);
    expect(s.done).toEqual({ l1: true });
  });

  it('rejects anything that is not a backup', () => {
    expect(readBackup('hello')).toBeNull();
    expect(readBackup(toBase64('{"a":1}'))).toBeNull();
  });
});
