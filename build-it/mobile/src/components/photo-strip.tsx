import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button, styles as ui } from '@/components/ui';
import { usePhotoActions } from '@/hooks/use-photo-actions';
import { usePhotoUri } from '@/hooks/use-photo-uri';
import { useTheme } from '@/hooks/use-theme';
import { photosSupported } from '@/lib/photo-files';
import { photosFor } from '@/lib/photos';
import type { Photo } from '@/lib/state';
import { useBuild } from '@/store/build-store';
import { fonts, radius } from '@/theme/theme';

function Thumb({ photo, label }: { photo: Photo; label: string }) {
  const theme = useTheme();
  const { uri, missing } = usePhotoUri(photo);
  return (
    <Pressable
      accessibilityRole="imagebutton"
      accessibilityLabel={label}
      onPress={() => router.push({ pathname: '/photo', params: { id: photo.id } })}
      style={[styles.thumb, { backgroundColor: theme.surface2, borderColor: theme.line }]}>
      {uri ? (
        <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
      ) : (
        <Text style={[styles.missing, { color: theme.muted }]}>{missing ? 'On another phone' : 'Loading'}</Text>
      )}
    </Pressable>
  );
}

/** Photos for one step: rebar before the pour, walls before drywall, the inspector’s sign-off. */
export function PhotoStrip({ step, title }: { step: string; title: string }) {
  const theme = useTheme();
  const { state } = useBuild();
  const { add } = usePhotoActions();
  if (!photosSupported) return null;
  const photos = photosFor(state.photos, step);

  return (
    <View style={{ gap: 8 }}>
      <Text style={[ui.fieldLabel, { color: theme.muted }]}>Photos</Text>
      {photos.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {photos.map((p, i) => (
            <Thumb key={p.id} photo={p} label={`Photo ${i + 1} of ${photos.length} for ${title}. Opens it.`} />
          ))}
        </ScrollView>
      )}
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        <Button small label="Take photo" accessibilityLabel={`Take a photo for ${title}`} onPress={() => add(step, 'camera')} />
        <Button small label="Choose photo" accessibilityLabel={`Choose a photo for ${title}`} onPress={() => add(step, 'library')} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  thumb: { width: 92, height: 92, borderRadius: radius.control, borderWidth: 1, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', padding: 6 },
  missing: { fontFamily: fonts.body, fontSize: 11, textAlign: 'center' },
});
