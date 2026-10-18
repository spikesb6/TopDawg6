// Photo files on this phone, in the app's own document folder so they survive restarts.
import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

import { photoFileName } from '@/lib/photos';

/** Photos need a phone. The web preview of the app hides them. */
export const photosSupported = Platform.OS !== 'web';

function folder() {
  const dir = new Directory(Paths.document, 'photos');
  dir.create({ intermediates: true, idempotent: true });
  return dir;
}

const fileFor = (id: string) => new File(folder(), photoFileName(id));

/** The file's address on this phone, or null when the photo was taken on another phone. */
export function localPhotoUri(id: string): string | null {
  if (!photosSupported) return null;
  const f = fileFor(id);
  return f.exists ? f.uri : null;
}

/** Copies a picked or captured image (which may be in a temporary folder) into the photo folder. */
export function savePhoto(id: string, sourceUri: string) {
  new File(sourceUri).copySync(fileFor(id), { overwrite: true });
}

export function deleteLocalPhoto(id: string) {
  const f = fileFor(id);
  if (f.exists) f.delete();
}

export function photoBytes(id: string) {
  return fileFor(id).bytes();
}

export async function downloadPhoto(id: string, url: string) {
  await File.downloadFileAsync(url, fileFor(id), { idempotent: true });
  return fileFor(id).uri;
}
