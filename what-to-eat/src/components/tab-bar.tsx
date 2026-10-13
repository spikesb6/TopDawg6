import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/components/icons';
import { useTheme } from '@/hooks/use-theme';
import { fonts } from '@/theme/theme';

const tabs: Record<string, { label: string; icon: IconName }> = {
  index: { label: 'Home', icon: 'home' },
  faves: { label: 'Faves', icon: 'heart' },
  past: { label: 'Past picks', icon: 'clock' },
};

export function TabBar({ state, navigation }: BottomTabBarProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      accessibilityRole="tablist"
      style={[
        styles.bar,
        {
          backgroundColor: theme.background,
          borderTopColor: theme.hairline,
          paddingBottom: Math.max(insets.bottom, 12),
        },
      ]}>
      {state.routes.map((route, index) => {
        const tab = tabs[route.name];
        if (!tab) return null;
        const focused = state.index === index;

        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityLabel={tab.label}
            accessibilityState={{ selected: focused }}
            style={styles.tab}
            onPress={() => {
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });
              if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
            }}>
            <Icon name={tab.icon} color={focused ? theme.tabActive : theme.muted} size={24} />
            <Text style={[styles.label, { color: focused ? theme.text : theme.muted }]}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    borderTopWidth: 2,
    borderStyle: 'dashed',
    paddingTop: 10,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  label: {
    fontFamily: fonts.headingSemi,
    fontSize: 12,
  },
});
