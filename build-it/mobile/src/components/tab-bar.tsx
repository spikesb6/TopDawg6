import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/components/icons';
import { useTheme } from '@/hooks/use-theme';
import { fonts } from '@/theme/theme';

const tabs: Record<string, { label: string; icon: IconName }> = {
  index: { label: 'My build', icon: 'home' },
  roadmap: { label: 'Roadmap', icon: 'road' },
  land: { label: 'Land', icon: 'land' },
  money: { label: 'Money', icon: 'money' },
  more: { label: 'More', icon: 'more' },
};

export function TabBar({ state, navigation }: BottomTabBarProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      accessibilityRole="tablist"
      style={[styles.bar, { backgroundColor: theme.surface, borderTopColor: theme.line, paddingBottom: Math.max(insets.bottom, 10) }]}>
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
              const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
            }}>
            <Icon name={tab.icon} color={focused ? theme.accent : theme.muted} size={24} />
            <Text style={[styles.label, { color: focused ? theme.text : theme.muted }]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', borderTopWidth: 1, paddingTop: 8 },
  tab: { flex: 1, minHeight: 48, alignItems: 'center', gap: 3 },
  label: { fontFamily: fonts.bodySemi, fontSize: 11 },
});
