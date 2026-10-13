import { Linking, StyleSheet, Text, View } from 'react-native';

import { BouncyPressable } from '@/components/bouncy-pressable';
import { useTheme } from '@/hooks/use-theme';
import { deliveryLinks } from '@/lib/delivery';
import { borderWidth, fonts, palette, radius } from '@/theme/theme';

const tilts = [-1.5, 1, -1];

/** Opens DoorDash, Uber Eats or Grubhub searching for the dish. */
export function DeliveryButtons({ dish, disabled }: { dish: string; disabled?: boolean }) {
  const theme = useTheme();
  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: theme.text }]}>Order it on</Text>
      <View style={styles.row}>
        {deliveryLinks(dish).map((app, i) => (
          <BouncyPressable
            key={app.key}
            accessibilityRole="link"
            accessibilityLabel={`Search ${app.label} for ${dish}`}
            accessibilityState={{ disabled }}
            disabled={disabled}
            tilt={tilts[i]}
            onPress={() => Linking.openURL(app.url).catch(() => {})}
            style={[styles.button, { borderColor: theme.border, opacity: disabled ? 0.5 : 1 }]}>
            <Text style={styles.buttonLabel} numberOfLines={1} adjustsFontSizeToFit>
              {app.label}
            </Text>
          </BouncyPressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 18,
  },
  label: {
    fontFamily: fonts.headingSemi,
    fontSize: 15,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  button: {
    flex: 1,
    minHeight: 52,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth,
    borderRadius: radius.tile,
    backgroundColor: palette.seafoam,
  },
  buttonLabel: {
    fontFamily: fonts.heading,
    fontSize: 15,
    color: palette.ink,
  },
});
