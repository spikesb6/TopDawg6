import * as ImagePicker from 'expo-image-picker';

import { deleteLocalPhoto, savePhoto } from '@/lib/photo-files';
import { addPhoto, newPhotoId, removePhoto } from '@/lib/photos';
import { deleteRemotePhoto } from '@/lib/remote';
import { useAccount } from '@/store/account-store';
import { useBuild } from '@/store/build-store';
import { useToast } from '@/store/toast-store';

const OPTIONS: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.6, exif: false };

export function usePhotoActions() {
  const { update } = useBuild();
  const account = useAccount();
  const toast = useToast();

  async function add(step: string, source: 'camera' | 'library') {
    const perm =
      source === 'camera' ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      toast(source === 'camera' ? 'Build It needs camera access. Turn it on in Settings.' : 'Build It needs photo access. Turn it on in Settings.');
      return;
    }
    const result = source === 'camera' ? await ImagePicker.launchCameraAsync(OPTIONS) : await ImagePicker.launchImageLibraryAsync(OPTIONS);
    if (result.canceled || !result.assets[0]) return;
    const id = newPhotoId();
    try {
      savePhoto(id, result.assets[0].uri);
    } catch {
      toast('Couldn’t save that photo. Check your phone has free space and try again.');
      return;
    }
    update((prev) => addPhoto(prev, { id, step, takenAt: new Date().toISOString(), uploaded: false }));
    toast(account.userId ? 'Photo saved. It will back up to your account.' : 'Photo saved on this phone.');
  }

  function remove(id: string) {
    update((prev) => removePhoto(prev, id));
    deleteLocalPhoto(id);
    if (account.userId) deleteRemotePhoto(account.userId, id).catch(() => {});
  }

  return { add, remove };
}
