import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { useDinnerStore } from '@/store/dinner-store';
import { fonts, radius } from '@/theme/theme';

/** Sign in to sync, or who you're signed in as. Hidden until Supabase is set up. */
export function AccountCard() {
  const theme = useTheme();
  const { backendConfigured, user, syncing, openSignIn, signOut } = useDinnerStore();
  if (!backendConfigured) return null;

  const text = user
    ? syncing
      ? 'Syncing your faves and picks…'
      : `Signed in as ${user.name}. Faves and picks sync to your other phones.`
    : 'Guest mode. Sign in to keep faves and picks on every phone.';

  return (
    <View style={[styles.card, { borderColor: theme.hairline }]}>
      <Text style={[styles.text, { color: theme.muted }]}>{text}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={user ? 'Sign out' : 'Sign in'}
        hitSlop={8}
        onPress={user ? signOut : openSignIn}>
        <Text style={[styles.action, { color: theme.text }]}>{user ? 'Sign out' : 'Sign in'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 16,
    padding: 14,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: radius.tile,
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
});
