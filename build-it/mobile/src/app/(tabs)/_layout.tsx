import { Tabs } from 'expo-router/js-tabs';

import { TabBar } from '@/components/tab-bar';
import { useTheme } from '@/hooks/use-theme';

export default function TabsLayout() {
  const theme = useTheme();

  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: theme.background } }}>
      <Tabs.Screen name="index" options={{ title: 'My build' }} />
      <Tabs.Screen name="roadmap" options={{ title: 'Roadmap' }} />
      <Tabs.Screen name="land" options={{ title: 'Land' }} />
      <Tabs.Screen name="money" options={{ title: 'Money' }} />
      <Tabs.Screen name="more" options={{ title: 'More' }} />
    </Tabs>
  );
}
