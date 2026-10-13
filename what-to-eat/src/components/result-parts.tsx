import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { type AnimatedStyle } from 'react-native-reanimated';

import { BouncyPressable } from '@/components/bouncy-pressable';
import { Icon } from '@/components/icons';
import { modesByKey } from '@/data/modes';
import { useTheme } from '@/hooks/use-theme';
import { borderWidth, fonts, modeColors, palette, radius, type ModeKey } from '@/theme/theme';

type CardProps = {
  modeKey: ModeKey;
  cardStyle: StyleProp<AnimatedStyle<StyleProp<ViewStyle>>>;
  fave: boolean;
  onToggleFave: () => void;
  spinning: boolean;
  children: ReactNode;
};

/** The colored, tilted card with the mode tag and heart. */
export function ResultCard({
  modeKey,
  cardStyle,
  fave,
  onToggleFave,
  spinning,
  children,
}: CardProps) {
  const mode = modesByKey[modeKey];
  return (
    <Animated.View
      accessibilityLiveRegion="polite"
      style={[styles.card, { backgroundColor: modeColors[modeKey] }, cardStyle]}>
      <View style={styles.cardTop}>
        <View style={styles.modeTag}>
          <Icon name={mode.icon} color={palette.ink} size={18} />
          <Text style={styles.modeTagText}>{mode.title}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={fave ? 'Remove from faves' : 'Add to faves'}
          accessibilityState={{ selected: fave, disabled: spinning }}
          disabled={spinning}
          hitSlop={10}
          onPress={onToggleFave}
          style={({ pressed }) => [styles.heart, pressed && { opacity: 0.6 }]}>
          <Icon name="heart" color={fave ? palette.tomato : palette.ink} filled={fave} />
        </Pressable>
      </View>
      {children}
    </Animated.View>
  );
}

export function SpinningName({ name }: { name: string | undefined }) {
  return (
    <Text accessibilityLabel="Spinning" style={styles.name}>
      {name ?? '…'}
    </Text>
  );
}

export function CardTitle({ children }: { children: ReactNode }) {
  return (
    <Text accessibilityRole="header" style={styles.name}>
      {children}
    </Text>
  );
}

export function CardText({ children }: { children: ReactNode }) {
  return <Text style={styles.blurb}>{children}</Text>;
}

export function CardDetails({ children }: { children: ReactNode }) {
  return <Text style={styles.details}>{children}</Text>;
}

export function MetaPills({ items }: { items: string[] }) {
  return (
    <View style={styles.metaRow}>
      {items.map((m) => (
        <View key={m} style={styles.metaPill}>
          <Text style={styles.metaText}>{m}</Text>
        </View>
      ))}
    </View>
  );
}

type ActionsProps = {
  locked: boolean;
  spinning: boolean;
  onLockIn: () => void;
  onSpin: () => void;
  onlyOne: boolean;
  /** What to say when there's nothing else to spin to. */
  onlyOneText?: string;
  /** Extra buttons between Let's eat this and Spin again (Get directions for places). */
  children?: ReactNode;
};

/** Let's eat this, Spin again, and what follows them. */
export function ResultActions({
  locked,
  spinning,
  onLockIn,
  onSpin,
  onlyOne,
  onlyOneText = "That's the only match. Loosen your filters for more.",
  children,
}: ActionsProps) {
  const theme = useTheme();
  return (
    <>
      <BouncyPressable
        accessibilityRole="button"
        accessibilityLabel={locked ? 'Locked in' : "Let's eat this"}
        accessibilityState={{ disabled: spinning || locked }}
        disabled={spinning || locked}
        tilt={-1}
        onPress={onLockIn}
        style={[styles.primary, { borderColor: theme.border, opacity: spinning ? 0.5 : 1 }]}>
        <Text style={styles.primaryLabel}>{locked ? 'Locked in. Enjoy!' : "Let's eat this"}</Text>
      </BouncyPressable>

      {children}

      <BouncyPressable
        accessibilityRole="button"
        accessibilityLabel="Spin again"
        accessibilityState={{ disabled: spinning }}
        disabled={spinning}
        tilt={1}
        onPress={onSpin}
        style={[styles.secondary, { borderColor: theme.text, opacity: spinning ? 0.5 : 1 }]}>
        <Icon name="dice" color={theme.text} size={22} />
        <Text style={[styles.secondaryLabel, { color: theme.text }]}>Spin again</Text>
      </BouncyPressable>

      {onlyOne ? <Text style={[styles.note, { color: theme.muted }]}>{onlyOneText}</Text> : null}

      {locked ? (
        <Pressable
          accessibilityRole="link"
          accessibilityLabel="See past picks"
          onPress={() => router.navigate('/past')}>
          <Text style={[styles.link, { color: theme.text }]}>See past picks</Text>
        </Pressable>
      ) : null}
    </>
  );
}

/** A secondary button in the result actions, like Get directions. */
export function ActionButton({
  label,
  onPress,
  disabled,
  color,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  color: string;
}) {
  const theme = useTheme();
  return (
    <BouncyPressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      tilt={0.5}
      onPress={onPress}
      style={[
        styles.secondary,
        { backgroundColor: color, borderColor: theme.border, opacity: disabled ? 0.5 : 1 },
      ]}>
      <Text style={[styles.secondaryLabel, { color: palette.ink }]}>{label}</Text>
    </BouncyPressable>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 26,
    padding: 22,
    borderWidth,
    borderColor: palette.ink,
    borderRadius: radius.card,
    minHeight: 280,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  modeTagText: {
    fontFamily: fonts.headingSemi,
    fontSize: 14,
    color: palette.ink,
  },
  heart: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  name: {
    fontFamily: fonts.heading,
    fontSize: 32,
    lineHeight: 38,
    color: palette.ink,
    marginTop: 18,
  },
  blurb: {
    fontFamily: fonts.body,
    fontSize: 16,
    color: palette.ink,
    marginTop: 4,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
  metaPill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: palette.ink,
  },
  metaText: {
    fontFamily: fonts.headingSemi,
    fontSize: 14,
    color: palette.ink,
  },
  details: {
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 21,
    color: palette.ink,
    marginTop: 16,
  },
  primary: {
    marginTop: 26,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 64,
    borderWidth,
    borderRadius: radius.button,
    backgroundColor: palette.mint,
  },
  primaryLabel: {
    fontFamily: fonts.heading,
    fontSize: 21,
    color: palette.ink,
  },
  secondary: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    minHeight: 58,
    borderWidth,
    borderRadius: radius.button,
  },
  secondaryLabel: {
    fontFamily: fonts.heading,
    fontSize: 19,
  },
  note: {
    fontFamily: fonts.body,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 14,
  },
  link: {
    fontFamily: fonts.headingSemi,
    fontSize: 16,
    textAlign: 'center',
    textDecorationLine: 'underline',
    marginTop: 18,
  },
});
