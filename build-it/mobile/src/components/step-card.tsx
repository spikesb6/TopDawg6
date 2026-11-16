import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Icon } from '@/components/icons';
import { PhotoStrip } from '@/components/photo-strip';
import { Pill, styles as ui } from '@/components/ui';
import type { Step } from '@/data/content';
import { useTheme } from '@/hooks/use-theme';
import { fonts, radius } from '@/theme/theme';

type Props = {
  step: Step;
  done: boolean;
  note: string;
  photoCount: number;
  open: boolean;
  onToggleDone: () => void;
  onToggleOpen: () => void;
  onNote: (text: string) => void;
};

export function StepCard({ step, done, note, photoCount, open, onToggleDone, onToggleOpen, onNote }: Props) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.card,
        { borderColor: theme.line, backgroundColor: done ? 'transparent' : theme.surface },
        step.gate && { borderLeftWidth: 4, borderLeftColor: theme.flag },
      ]}>
      <View style={styles.row}>
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: done }}
          accessibilityLabel={`Mark done: ${step.t}`}
          onPress={onToggleDone}
          hitSlop={10}
          style={[ui.box, styles.check, { borderColor: done ? theme.accent : theme.muted, backgroundColor: done ? theme.accent : 'transparent' }]}>
          {done && <Icon name="check" color={theme.onAccent} size={17} strokeWidth={3} />}
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          accessibilityHint={open ? 'Hides the details' : 'Shows what to do and how pros do it'}
          onPress={onToggleOpen}
          style={styles.titleWrap}>
          <Text
            style={[
              styles.title,
              { color: done ? theme.muted : theme.text },
              done && { textDecorationLine: 'line-through' },
            ]}>
            {step.t}
          </Text>
          {(step.gate || step.crit || !!note || photoCount > 0) && (
            <View style={styles.tags}>
              {step.gate && <Pill tone="flag">Hold point · inspection</Pill>}
              {step.crit && <Pill tone="warn">Never skip</Pill>}
              {!!note && <Pill>Has notes</Pill>}
              {photoCount > 0 && <Pill>{photoCount === 1 ? '1 photo' : `${photoCount} photos`}</Pill>}
            </View>
          )}
        </Pressable>
        <Pressable accessibilityElementsHidden importantForAccessibility="no" onPress={onToggleOpen} hitSlop={10} style={styles.chev}>
          <Icon name={open ? 'minus' : 'plus'} color={theme.muted} size={18} />
        </Pressable>
      </View>

      {open && (
        <View style={styles.body}>
          <Text style={[ui.body, { color: theme.text }]}>{step.d}</Text>
          <View style={[styles.box, { backgroundColor: theme.accentSoft }]}>
            <Text style={[ui.label, { color: theme.accent }]}>How the best builders do it</Text>
            <Text style={[ui.body, { color: theme.text }]}>{step.pro}</Text>
          </View>
          {step.gate && (
            <View style={[styles.box, { backgroundColor: theme.flagSoft }]}>
              <Text style={[ui.body, { color: theme.text }]}>
                <Text style={{ fontFamily: fonts.bodySemi, color: theme.flag }}>Hold point. </Text>
                Do not cover, pour, close up or pay for this stage until it passes. Take photos, and write the inspector’s name, date and result below.
              </Text>
            </View>
          )}
          <PhotoStrip step={step.id} title={step.t} />
          <View style={{ gap: 5 }}>
            <Text style={[ui.fieldLabel, { color: theme.muted }]}>Notes, dates, names, inspection results</Text>
            <TextInput
              accessibilityLabel={`Notes for ${step.t}`}
              value={note}
              onChangeText={onNote}
              multiline
              placeholder="Passed 4/12, inspector J. Ruiz. Photos in binder."
              placeholderTextColor={theme.muted}
              style={[ui.input, { minHeight: 80, textAlignVertical: 'top', backgroundColor: theme.background, borderColor: theme.line, color: theme.text }]}
            />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: radius.card },
  row: { flexDirection: 'row', gap: 12, padding: 14, alignItems: 'flex-start' },
  check: { width: 26, height: 26, marginTop: 0 },
  titleWrap: { flex: 1, gap: 6 },
  title: { fontFamily: fonts.bodySemi, fontSize: 16, lineHeight: 22 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  chev: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  body: { paddingHorizontal: 14, paddingBottom: 14, gap: 12 },
  box: { borderRadius: radius.control, padding: 12, gap: 4 },
});
