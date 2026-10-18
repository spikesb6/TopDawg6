import { describe, expect, it } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import vm from 'vm';

import { freshState, mergeState, type BuildState } from '@/lib/state';
import { mergeBuilds, planSync, type Remote } from '@/lib/sync';

// The web app's copy of the sync rules (../sync.js) must behave exactly like src/lib/sync.ts.
const web = vm.runInNewContext(`${fs.readFileSync(path.join(__dirname, '../../../sync.js'), 'utf8')}; BUILDIT_SYNC`, {});
const plain = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
const build = (change: Partial<BuildState>): BuildState => ({ ...freshState(), ...change });
const pay = (id: string) => ({ id, date: '2026-01-01', payee: id, phase: 'site', amount: 1, waiver: 'none' as const, inspected: false });

const cases: [string, BuildState, boolean, number | null, Remote][] = [
  ['first sync', build({ done: { f1: true } }), true, null, null],
  ['nothing changed', build({}), false, 3, { data: build({}), version: 3 }],
  ['local change only', build({ done: { f1: true } }), true, 3, { data: build({}), version: 3 }],
  ['new device', build({}), false, null, { data: { done: { l1: true } }, version: 7 }],
  [
    'both changed',
    build({ done: { f1: true }, notes: { a: 'mine' }, payments: [pay('1')], photos: [{ id: 'x', step: 'a', takenAt: '1', uploaded: false }] }),
    true,
    4,
    { data: build({ done: { l1: true }, notes: { a: 'theirs', b: 'b' }, payments: [pay('1'), pay('2')], photos: [{ id: 'x', step: 'a', takenAt: '1', uploaded: true }] }), version: 5 },
  ],
];

describe('web sync rules match the phone', () => {
  it.each(cases)('%s', (_name, local, dirty, known, remote) => {
    expect(plain(web.planSync(local, dirty, known, remote, mergeState))).toEqual(plain(planSync(local, dirty, known, remote)));
  });

  it('merges a web build that has no photos list', () => {
    const mine = build({ done: { f1: true } });
    const { photos: _drop, ...webBuild } = build({ done: { l1: true } });
    expect(plain(web.mergeBuilds(mine, webBuild))).toEqual(plain(mergeBuilds(mine, mergeState(webBuild))));
  });
});
