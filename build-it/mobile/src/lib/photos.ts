import type { BuildState, Photo } from '@/lib/state';

/** Photo files live at photos/<id>.jpg on each phone and <user id>/<id>.jpg in the cloud. */
export const photoFileName = (id: string) => `${id}.jpg`;
export const photoStoragePath = (userId: string, id: string) => `${userId}/${photoFileName(id)}`;

export function newPhotoId(now = Date.now(), rand = Math.random) {
  return `ph${now.toString(36)}${Math.floor(rand() * 1e8).toString(36)}`;
}

export function photosFor(photos: Photo[], step: string) {
  return photos.filter((p) => p.step === step).sort((a, b) => a.takenAt.localeCompare(b.takenAt));
}

export function addPhoto(state: BuildState, photo: Photo): BuildState {
  return { ...state, photos: [...state.photos, photo] };
}

export function removePhoto(state: BuildState, id: string): BuildState {
  return { ...state, photos: state.photos.filter((p) => p.id !== id) };
}

export function markUploaded(state: BuildState, ids: string[]): BuildState {
  if (!ids.length) return state;
  return { ...state, photos: state.photos.map((p) => (ids.includes(p.id) ? { ...p, uploaded: true } : p)) };
}

/** Steps that have at least one photo, for the "has photos" tag. */
export function photoCounts(photos: Photo[]): Record<string, number> {
  const out: Record<string, number> = {};
  photos.forEach((p) => (out[p.step] = (out[p.step] ?? 0) + 1));
  return out;
}
