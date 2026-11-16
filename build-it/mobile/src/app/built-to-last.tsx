import { router } from 'expo-router';
import { Pressable, Text } from 'react-native';

import { Screen } from '@/components/screen';
import { Body, Card, H3, Heading } from '@/components/ui';
import { PHASES, PRINCIPLES } from '@/data/content';
import { useTheme } from '@/hooks/use-theme';
import { fonts, linkHitSlop } from '@/theme/theme';

export default function BuiltToLast() {
  const theme = useTheme();
  return (
    <Screen back>
      <Heading
        eyebrow="Built to last"
        title="How the best builders make houses last"
        lede="These principles come from building science research and from building traditions whose houses have stood for centuries. Code tells you the minimum. These tell you how to build for your grandchildren."
      />
      {PRINCIPLES.map((x) => {
        const ph = PHASES.find((p) => p.id === x.phase)!;
        return (
          <Card key={x.t}>
            <H3>{x.t}</H3>
            <Body muted>{x.d}</Body>
            <Pressable
              accessibilityRole="link"
              hitSlop={linkHitSlop}
              onPress={() => router.push({ pathname: '/phase/[id]', params: { id: ph.id } })}
              style={{ alignSelf: 'flex-start' }}>
              <Text style={{ fontFamily: fonts.bodySemi, color: theme.accent, textDecorationLine: 'underline' }}>See it in {ph.name}</Text>
            </Pressable>
          </Card>
        );
      })}
    </Screen>
  );
}
