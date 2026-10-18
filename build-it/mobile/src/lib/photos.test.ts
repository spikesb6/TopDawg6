import { describe, expect, it } from '@jest/globals';

import { addPhoto, markUploaded, newPhotoId, photoCounts, photosFor, photoStoragePath, removePhoto } from '@/lib/photos';
import { freshState, type Photo } from '@/lib/state';

const ph = (id: string, step: string, takenAt: string, uploaded = false): Photo => ({ id, step, takenAt, uploaded });

describe('photos', () => {
  it('adds, lists by step in time order, and removes', () => {
    let s = freshState();
    s = addPhoto(s, ph('b', 'fo3', '2026-04-12T10:00:00Z'));
    s = addPhoto(s, ph('a', 'fo3', '2026-04-12T09:00:00Z'));
    s = addPhoto(s, ph('c', 'fo8', '2026-04-20T09:00:00Z'));
    expect(photosFor(s.photos, 'fo3').map((p) => p.id)).toEqual(['a', 'b']);
    expect(photoCounts(s.photos)).toEqual({ fo3: 2, fo8: 1 });
    expect(removePhoto(s, 'a').photos.map((p) => p.id)).toEqual(['b', 'c']);
  });

  it('marks uploads without touching other photos', () => {
    const s = { ...freshState(), photos: [ph('a', 'x', '1'), ph('b', 'x', '2')] };
    expect(markUploaded(s, ['b']).photos.map((p) => p.uploaded)).toEqual([false, true]);
    expect(markUploaded(s, [])).toBe(s);
  });

  it('keeps each person in their own storage folder', () => {
    expect(photoStoragePath('user-1', 'ph1')).toBe('user-1/ph1.jpg');
  });

  it('makes ids that are safe in file names', () => {
    expect(newPhotoId(1700000000000, () => 0.5)).toMatch(/^ph[a-z0-9]+$/);
  });
});
