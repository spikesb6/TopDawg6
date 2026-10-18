import { describe, expect, it } from '@jest/globals';

import { mergeBuilds, planSync } from '@/lib/sync';
import { freshState, type BuildState } from '@/lib/state';

const build = (change: Partial<BuildState>): BuildState => ({ ...freshState(), ...change });

describe('planSync', () => {
  const local = build({ done: { f1: true } });

  it('creates the account copy the first time', () => {
    expect(planSync(local, false, null, null)).toEqual({ action: 'create', data: local });
  });

  it('does nothing when neither side changed', () => {
    expect(planSync(local, false, 3, { data: local, version: 3 }).action).toBe('none');
  });

  it('pushes local changes when nobody else saved', () => {
    expect(planSync(local, true, 3, { data: freshState(), version: 3 })).toEqual({ action: 'push', data: local, expectVersion: 3 });
  });

  it('takes the account copy on a new phone with nothing changed', () => {
    const remote = { data: { done: { l1: true } }, version: 7 };
    const plan = planSync(freshState(), false, null, remote);
    expect(plan.action).toBe('pull');
    if (plan.action === 'pull') {
      expect(plan.data.done).toEqual({ l1: true });
      expect(plan.data.budget.cpsf).toBe(210);
      expect(plan.version).toBe(7);
    }
  });

  it('merges when both phones changed', () => {
    const remote = { data: build({ done: { l1: true } }), version: 5 };
    const plan = planSync(local, true, 4, remote);
    expect(plan.action).toBe('push');
    if (plan.action === 'push') {
      expect(plan.data.done).toEqual({ f1: true, l1: true });
      expect(plan.expectVersion).toBe(5);
    }
  });
});

describe('mergeBuilds', () => {
  it('keeps everything from both sides, this phone winning on the same key', () => {
    const p = (id: string) => ({ id, date: '2026-01-01', payee: id, phase: 'site', amount: 1, waiver: 'none' as const, inspected: false });
    const mine = build({ notes: { a: 'mine' }, payments: [p('1')], photos: [{ id: 'x', step: 'a', takenAt: '1', uploaded: false }] });
    const theirs = build({ notes: { a: 'theirs', b: 'theirs' }, payments: [p('1'), p('2')], photos: [{ id: 'x', step: 'a', takenAt: '1', uploaded: true }, { id: 'y', step: 'b', takenAt: '2', uploaded: true }] });
    const m = mergeBuilds(mine, theirs);
    expect(m.notes).toEqual({ a: 'mine', b: 'theirs' });
    expect(m.payments.map((x) => x.id)).toEqual(['1', '2']);
    expect(m.photos).toEqual([
      { id: 'x', step: 'a', takenAt: '1', uploaded: true },
      { id: 'y', step: 'b', takenAt: '2', uploaded: true },
    ]);
  });
});
