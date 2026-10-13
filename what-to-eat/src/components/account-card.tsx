import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { useDinnerStore } from '@/store/dinner-store';
import { fonts, linkHitSlop, palette, radius } from '@/theme/theme';

/** Sign in to sync, who you're signed in as, sign out and delete account. Hidden until Supabase is set up. */
export function AccountCard() {
  const theme = useTheme();
  const { backendConfigured, user, syncing, openSignIn, signOut, deleteAccount } = useDinnerStore();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!backendConfigured) return null;

  const text = user
    ? syncing
      ? 'Syncing your faves and picks…'
      : `Signed in as ${user.name}. Faves and picks sync to your other phones.`
    : 'Guest mode. Sign in to keep faves and picks on every phone.';

  const remove = async () => {
    setDeleting(true);
    setError(null);
    try {
      await deleteAccount();
      setConfirming(false);
    } catch {
      setError('Could not delete your account. Check your connection and try again.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <View style={[styles.card, { borderColor: theme.hairline }]}>
      <View style={styles.row}>
        <Text style={[styles.text, { color: theme.muted }]}>{text}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={user ? 'Sign out' : 'Sign in'}
          hitSlop={linkHitSlop}
          onPress={user ? signOut : openSignIn}>
          <Text style={[styles.action, { color: theme.text }]}>
            {user ? 'Sign out' : 'Sign in'}
          </Text>
        </Pressable>
      </View>

      {user && !confirming ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Delete account"
          hitSlop={linkHitSlop}
          onPress={() => setConfirming(true)}
          style={styles.deleteLink}>
          <Text style={[styles.small, { color: theme.muted }]}>Delete account</Text>
        </Pressable>
      ) : null}

      {user && confirming ? (
        <View style={styles.confirm}>
          <Text style={[styles.confirmText, { color: theme.text }]}>
            Delete your account? Your faves and past picks are removed from every phone. This
            can&apos;t be undone.
          </Text>
          <View style={styles.confirmRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Keep my account"
              disabled={deleting}
              onPress={() => setConfirming(false)}
              style={[styles.confirmButton, { borderColor: theme.text }]}>
              <Text style={[styles.confirmLabel, { color: theme.text }]}>Keep it</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Yes, delete my account"
              accessibilityState={{ disabled: deleting }}
              disabled={deleting}
              onPress={remove}
              style={[
                styles.confirmButton,
                { backgroundColor: palette.tomato, borderColor: palette.tomato },
              ]}>
              <Text style={[styles.confirmLabel, { color: palette.ink }]}>
                {deleting ? 'Deleting…' : 'Delete'}
              </Text>
            </Pressable>
          </View>
          {error ? <Text style={[styles.small, { color: palette.tomato }]}>{error}</Text> : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 16,
    padding: 14,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: radius.tile,
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  text: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 13,
  },
  action: {
    fontFamily: fonts.heading,
    fontSize: 15,
    textDecorationLine: 'underline',
  },
  deleteLink: {
    alignSelf: 'flex-start',
  },
  small: {
    fontFamily: fonts.body,
    fontSize: 12,
    textDecorationLine: 'underline',
  },
  confirm: {
    gap: 10,
  },
  confirmText: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
  },
  confirmRow: {
    flexDirection: 'row',
    gap: 10,
  },
  confirmButton: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderRadius: radius.tile,
  },
  confirmLabel: {
    fontFamily: fonts.heading,
    fontSize: 16,
  },
});
