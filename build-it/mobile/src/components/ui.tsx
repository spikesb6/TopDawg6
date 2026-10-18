// Small building blocks shared by every screen.
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Switch, Text, TextInput, View, type TextInputProps, type ViewStyle } from 'react-native';

import { Icon } from '@/components/icons';
import { useTheme } from '@/hooks/use-theme';
import { fonts, radius, toneColors, type Tone } from '@/theme/theme';

export function Heading({ eyebrow, title, lede }: { eyebrow?: string; title: string; lede?: string }) {
  const theme = useTheme();
  return (
    <View style={{ gap: 6 }}>
      {eyebrow && <Label>{eyebrow}</Label>}
      <Text accessibilityRole="header" style={[styles.title, { color: theme.text }]}>{title}</Text>
      {lede && <Text style={[styles.body, { color: theme.muted }]}>{lede}</Text>}
    </View>
  );
}

export function Label({ children, color }: { children: ReactNode; color?: string }) {
  const theme = useTheme();
  return <Text style={[styles.label, { color: color ?? theme.muted }]}>{children}</Text>;
}

export function Body({ children, muted, style }: { children: ReactNode; muted?: boolean; style?: object }) {
  const theme = useTheme();
  return <Text style={[styles.body, { color: muted ? theme.muted : theme.text }, style]}>{children}</Text>;
}

export function Strong({ children }: { children: ReactNode }) {
  return <Text style={{ fontFamily: fonts.bodySemi }}>{children}</Text>;
}

export function H3({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return <Text accessibilityRole="header" style={[styles.h3, { color: theme.text }]}>{children}</Text>;
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const theme = useTheme();
  return <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.line }, style]}>{children}</View>;
}

export function Pill({ tone = 'plain', children }: { tone?: Tone; children: ReactNode }) {
  const theme = useTheme();
  const c = toneColors(theme, tone);
  return (
    <View style={[styles.pill, { backgroundColor: c.bg }]}>
      <Text style={[styles.pillText, { color: c.fg }]}>{children}</Text>
    </View>
  );
}

export function Banner({ tone = 'flag', children, actionLabel, onAction }: { tone?: Tone; children: ReactNode; actionLabel?: string; onAction?: () => void }) {
  const theme = useTheme();
  const c = toneColors(theme, tone);
  return (
    <View style={[styles.banner, { backgroundColor: c.bg }]}>
      <Text style={[styles.body, { color: theme.text, flex: 1 }]}>{children}</Text>
      {actionLabel && <Button small label={actionLabel} onPress={onAction} />}
    </View>
  );
}

type ButtonProps = { label: string; onPress?: () => void; kind?: 'primary' | 'default' | 'danger'; small?: boolean; accessibilityLabel?: string };

export function Button({ label, onPress, kind = 'default', small, accessibilityLabel }: ButtonProps) {
  const theme = useTheme();
  const primary = kind === 'primary';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        small && styles.buttonSmall,
        { backgroundColor: primary ? theme.accent : theme.surface, borderColor: primary ? theme.accent : theme.line, opacity: pressed ? 0.75 : 1 },
      ]}>
      <Text style={[styles.buttonText, small && { fontSize: 14 }, { color: primary ? theme.onAccent : kind === 'danger' ? theme.bad : theme.text }]}>{label}</Text>
    </Pressable>
  );
}

export function Stat({ label, value, sub, alert }: { label: string; value: string; sub?: string; alert?: boolean }) {
  const theme = useTheme();
  return (
    <View style={[styles.stat, { backgroundColor: theme.surface, borderColor: alert ? theme.flag : theme.line }]}>
      <Label>{label}</Label>
      <Text style={[styles.statValue, { color: alert ? theme.flag : theme.text }]} adjustsFontSizeToFit numberOfLines={1}>{value}</Text>
      {sub && <Text style={[styles.small, { color: theme.muted }]}>{sub}</Text>}
    </View>
  );
}

export function StatGrid({ children }: { children: ReactNode }) {
  return <View style={styles.statGrid}>{children}</View>;
}

export function Checkbox({ checked, onToggle, label, children }: { checked: boolean; onToggle: () => void; label: string; children?: ReactNode }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      onPress={onToggle}
      hitSlop={8}
      style={styles.checkRow}>
      <View style={[styles.box, { borderColor: checked ? theme.accent : theme.muted, backgroundColor: checked ? theme.accent : 'transparent' }]}>
        {checked && <Icon name="check" color={theme.onAccent} size={16} strokeWidth={3} />}
      </View>
      {children ?? <Text style={[styles.body, { color: theme.text, flex: 1 }]}>{label}</Text>}
    </Pressable>
  );
}

/** A labeled text box. `row` lets it share a wrapping row with other fields. */
export function Field({ label, row, ...input }: { label: string; row?: boolean } & TextInputProps) {
  const theme = useTheme();
  return (
    <View style={[{ gap: 5 }, row && { flexGrow: 1, flexBasis: 140 }]}>
      <Text style={[styles.fieldLabel, { color: theme.muted }]}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={theme.muted}
        {...input}
        style={[styles.input, { backgroundColor: theme.background, borderColor: theme.line, color: theme.text }, input.multiline && { minHeight: 80, textAlignVertical: 'top' }]}
      />
    </View>
  );
}

export function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  const theme = useTheme();
  return (
    <View style={styles.toggleRow}>
      <Text style={[styles.body, { color: theme.text, flex: 1 }]}>{label}</Text>
      <Switch accessibilityLabel={label} value={value} onValueChange={onChange} trackColor={{ true: theme.accent, false: theme.line }} />
    </View>
  );
}

export function Segmented<T extends string>({ options, value, onChange, label, tones }: { options: [T, string][]; value: T; onChange: (v: T) => void; label: string; tones?: Partial<Record<T, Tone>> }) {
  const theme = useTheme();
  return (
    <View accessibilityLabel={label} style={[styles.seg, { borderColor: theme.line }]}>
      {options.map(([k, l], i) => {
        const on = value === k;
        const c = toneColors(theme, tones?.[k] ?? 'info');
        return (
          <Pressable
            key={k}
            accessibilityRole="button"
            accessibilityLabel={`${label}: ${l}`}
            accessibilityState={{ selected: on }}
            onPress={() => onChange(k)}
            style={[styles.segBtn, { backgroundColor: on ? c.bg : theme.surface, borderLeftWidth: i ? 1 : 0, borderLeftColor: theme.line }]}>
            <Text style={[styles.segText, { color: on ? c.fg : theme.muted }]}>{l}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function LinkRow({ title, sub, onPress, right }: { title: string; sub?: string; onPress: () => void; right?: ReactNode }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => [styles.linkRow, { backgroundColor: theme.surface, borderColor: theme.line, opacity: pressed ? 0.75 : 1 }]}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[styles.rowTitle, { color: theme.text }]}>{title}</Text>
        {sub && <Text style={[styles.small, { color: theme.muted }]}>{sub}</Text>}
      </View>
      {right}
      <Icon name="chevronRight" color={theme.muted} size={20} />
    </Pressable>
  );
}

export function Bullets({ items }: { items: ReactNode[] }) {
  const theme = useTheme();
  return (
    <View style={{ gap: 8 }}>
      {items.map((it, i) => (
        <View key={i} style={{ flexDirection: 'row', gap: 10 }}>
          <Text style={[styles.body, { color: theme.accent }]}>•</Text>
          <Text style={[styles.body, { color: theme.text, flex: 1 }]}>{it}</Text>
        </View>
      ))}
    </View>
  );
}

/** A label and a right-aligned figure, for tables of money. */
export function MoneyRow({ label, value, sub, bold }: { label: ReactNode; value: string; sub?: string; bold?: boolean }) {
  const theme = useTheme();
  return (
    <View style={[styles.moneyRow, { borderTopColor: theme.line }]}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.body, { color: theme.text, fontFamily: bold ? fonts.bodySemi : fonts.body }]}>{label}</Text>
        {sub && <Text style={[styles.small, { color: theme.muted }]}>{sub}</Text>}
      </View>
      <Text style={[styles.mono, { color: theme.text }]}>{value}</Text>
    </View>
  );
}

export const styles = StyleSheet.create({
  title: { fontFamily: fonts.display, fontSize: 30, lineHeight: 33, letterSpacing: -0.3 },
  h3: { fontFamily: fonts.display, fontSize: 18, lineHeight: 22 },
  label: { fontFamily: fonts.bodySemi, fontSize: 11, letterSpacing: 1.3, textTransform: 'uppercase' },
  body: { fontFamily: fonts.body, fontSize: 16, lineHeight: 24 },
  small: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18 },
  mono: { fontFamily: fonts.mono, fontSize: 15, fontVariant: ['tabular-nums'] },
  card: { borderWidth: 1, borderRadius: radius.card, padding: 16, gap: 12 },
  pill: { borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 4, alignSelf: 'flex-start' },
  pillText: { fontFamily: fonts.bodySemi, fontSize: 11, letterSpacing: 0.6, textTransform: 'uppercase' },
  banner: { borderRadius: radius.card, padding: 14, gap: 10, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  button: { minHeight: 46, paddingHorizontal: 16, borderRadius: radius.control, borderWidth: 1, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start' },
  buttonSmall: { minHeight: 38, paddingHorizontal: 12 },
  buttonText: { fontFamily: fonts.bodySemi, fontSize: 16 },
  stat: { flexGrow: 1, flexBasis: '45%', borderWidth: 1, borderRadius: radius.card, padding: 14, gap: 4 },
  statValue: { fontFamily: fonts.display, fontSize: 26 },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  checkRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', minHeight: 32 },
  box: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  fieldLabel: { fontFamily: fonts.bodySemi, fontSize: 13 },
  input: { borderWidth: 1, borderRadius: radius.control, paddingHorizontal: 12, paddingVertical: 10, minHeight: 46, fontFamily: fonts.body, fontSize: 16 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 },
  seg: { flexDirection: 'row', borderWidth: 1, borderRadius: radius.control, overflow: 'hidden', alignSelf: 'flex-start' },
  segBtn: { paddingHorizontal: 11, minHeight: 38, justifyContent: 'center' },
  segText: { fontFamily: fonts.bodySemi, fontSize: 13 },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: radius.card, padding: 14, minHeight: 56 },
  rowTitle: { fontFamily: fonts.bodySemi, fontSize: 16 },
  moneyRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', paddingVertical: 10, borderTopWidth: 1 },
});
