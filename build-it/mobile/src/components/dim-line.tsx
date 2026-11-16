import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { fonts } from '@/theme/theme';

/** Overall progress drawn like a dimension string on a plan sheet: Lot on the left, Keys on the right. */
export function DimLine({ pct, done, total }: { pct: number; done: number; total: number }) {
  const theme = useTheme();
  return (
    <View accessible accessibilityLabel={`${pct}% built, ${done} of ${total} steps`} style={{ gap: 6 }}>
      <View style={styles.labels}>
        <Text style={[styles.text, { color: theme.muted }]}>Lot</Text>
        <Text style={[styles.text, { color: theme.muted }]}>
          <Text style={{ color: theme.text }}>{pct}%</Text> built · {done}/{total}
        </Text>
        <Text style={[styles.text, { color: theme.muted }]}>Keys</Text>
      </View>
      <View style={[styles.line, { borderColor: theme.muted }]}>
        <View style={[styles.rule, { backgroundColor: theme.muted }]} />
        <View style={[styles.fill, { width: `${pct}%`, backgroundColor: theme.accent }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  labels: { flexDirection: 'row', justifyContent: 'space-between' },
  text: { fontFamily: fonts.mono, fontSize: 12 },
  line: { height: 12, borderLeftWidth: 1, borderRightWidth: 1, justifyContent: 'center' },
  rule: { position: 'absolute', left: 0, right: 0, height: 1 },
  fill: { height: 6, borderTopRightRadius: 3, borderBottomRightRadius: 3 },
});
