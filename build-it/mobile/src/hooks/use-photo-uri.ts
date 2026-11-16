import { useEffect, useState } from 'react';

import { downloadPhoto, localPhotoUri } from '@/lib/photo-files';
import { photoDownloadUrl } from '@/lib/remote';
import type { Photo } from '@/lib/state';
import { useAccount } from '@/store/account-store';

/**
 * Where to show a photo from. Photos taken on another phone are downloaded once from the account.
 * Null while loading or when it can't be shown here (not signed in, or never uploaded).
 */
export function usePhotoUri(photo: Photo) {
  const { userId } = useAccount();
  const [uri, setUri] = useState<string | null>(() => localPhotoUri(photo.id));
  const [failed, setFailed] = useState(false);
  const canDownload = !!userId && photo.uploaded;

  useEffect(() => {
    if (uri || !userId || !photo.uploaded) return;
    let live = true;
    photoDownloadUrl(userId, photo.id)
      .then((url) => downloadPhoto(photo.id, url))
      .then((u) => live && setUri(u))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [uri, userId, photo.id, photo.uploaded]);

  return { uri, missing: !uri && (!canDownload || failed) };
}
