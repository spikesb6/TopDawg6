// Cloud sync rules. One saved build per account, guarded by a version number that goes up on
// every save, so a phone can tell when another phone saved since it last looked.
import { mergeState, type BuildState } from '@/lib/state';

export type Remote = { data: Partial<BuildState>; version: number } | null;

export type SyncPlan =
  | { action: 'none' }
  | { action: 'create'; data: BuildState }
  | { action: 'push'; data: BuildState; expectVersion: number }
  | { action: 'pull'; data: BuildState; version: number };

/**
 * dirty: this phone changed something since its last sync.
 * knownVersion: the account version this phone last saw (null before its first sync).
 */
export function planSync(local: BuildState, dirty: boolean, knownVersion: number | null, remote: Remote): SyncPlan {
  if (!remote) return { action: 'create', data: local };
  if (remote.version === knownVersion) {
    return dirty ? { action: 'push', data: local, expectVersion: remote.version } : { action: 'none' };
  }
  // Another phone saved since we last looked.
  const theirs = mergeState(remote.data);
  if (!dirty) return { action: 'pull', data: theirs, version: remote.version };
  return { action: 'push', data: mergeBuilds(local, theirs), expectVersion: remote.version };
}

function unionById<T extends { id: string }>(mine: T[], theirs: T[]): T[] {
  const ids = new Set(mine.map((x) => x.id));
  return [...mine, ...theirs.filter((x) => !ids.has(x.id))];
}

/**
 * Combines two builds that both changed. Nothing is thrown away: checked steps, notes, payments
 * and photos from both are kept, and where both set the same thing this phone's value wins.
 */
export function mergeBuilds(mine: BuildState, theirs: BuildState): BuildState {
  return {
    ...mine,
    done: { ...theirs.done, ...mine.done },
    notes: { ...theirs.notes, ...mine.notes },
    lot: { ...theirs.lot, ...mine.lot },
    permits: { ...theirs.permits, ...mine.permits },
    vet: { ...theirs.vet, ...mine.vet },
    payments: unionById(mine.payments, theirs.payments),
    photos: unionById(mine.photos, theirs.photos).map((p) => ({
      ...p,
      uploaded: p.uploaded || theirs.photos.some((t) => t.id === p.id && t.uploaded),
    })),
  };
}
