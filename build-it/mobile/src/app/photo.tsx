import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/screen';
import { Body, Button, Heading, Strong } from '@/components/ui';
import { ALL_STEPS } from '@/data/content';
import { usePhotoActions } from '@/hooks/use-photo-actions';
import { usePhotoUri } from '@/hooks/use-photo-uri';
import { useTheme } from '@/hooks/use-theme';
import type { Photo } from '@/lib/state';
import { useAccount } from '@/store/account-store';
import { useBuild } from '@/store/build-store';
import { radius } from '@/theme/theme';

function Viewer({ photo }: { photo: Photo }) {
  const theme = useTheme();
  const account = useAccount();
  const { remove } = usePhotoActions();
  const { uri, missing } = usePhotoUri(photo);
  const [confirm, setConfirm] = useState(false);
  const step = ALL_STEPS.find((s) => s.id === photo.step);
  const taken = new Date(photo.takenAt);

  return (
    <>
      <Heading eyebrow="Photo" title={step?.t ?? 'Photo'} lede={`Taken ${taken.toLocaleDateString()} at ${taken.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`} />
      <View style={[styles.frame, { backgroundColor: theme.surface2, borderColor: theme.line }]}>
        {uri ? (
          <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="contain" accessibilityLabel={`Photo for ${step?.t ?? 'this step'}`} />
        ) : (
          <Text style={{ color: theme.muted, padding: 20, textAlign: 'center' }}>
            {missing ? 'This photo was taken on another phone. Sign in on both phones to see it here.' : 'Loading…'}
          </Text>
        )}
      </View>
      <Body muted>
        {photo.uploaded
          ? 'Backed up to your account.'
          : account.userId
            ? 'Backing up to your account.'
            : 'Saved on this phone only. Sign in under More → Account to back it up.'}
      </Body>
      {confirm ? (
        <View style={{ gap: 8 }}>
          <Body><Strong>Delete this photo?</Strong> It’s removed from this phone{account.userId ? ' and your account' : ''}.</Body>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button
              kind="danger"
              label="Yes, delete it"
              onPress={() => {
                remove(photo.id);
                router.back();
              }}
            />
            <Button label="Keep it" onPress={() => setConfirm(false)} />
          </View>
        </View>
      ) : (
        <Button kind="danger" label="Delete photo" onPress={() => setConfirm(true)} />
      )}
    </>
  );
}

export default function PhotoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state } = useBuild();
  const photo = state.photos.find((p) => p.id === id);

  return <Screen back>{photo ? <Viewer photo={photo} /> : <Heading title="That photo was deleted" />}</Screen>;
}

const styles = StyleSheet.create({
  frame: { width: '100%', aspectRatio: 3 / 4, borderRadius: radius.card, borderWidth: 1, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
});
