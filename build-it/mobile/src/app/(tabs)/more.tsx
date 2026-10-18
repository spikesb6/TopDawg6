import { router, type Href } from 'expo-router';
import { View } from 'react-native';

import { Screen } from '@/components/screen';
import { Body, Heading, LinkRow } from '@/components/ui';

const LINKS: [string, string, Href][] = [
  ['Account', 'Back up your build and photos, use it on any phone', '/account'],
  ['About your project', 'Size, foundation, utilities, HOA, flood zone', '/project'],
  ['Permits', 'Your permit list and where each one stands', '/permits'],
  ['Paying people', 'Payment log, lien waivers, retainage, golden rules', '/payments'],
  ['Your team', 'GC or owner-builder, vetting, contracts, red flags', '/team'],
  ['Built to last', 'How the best builders make houses last', '/built-to-last'],
];

export default function More() {
  return (
    <Screen>
      <Heading eyebrow="More" title="Everything else" />
      <View style={{ gap: 10 }}>
        {LINKS.map(([title, sub, href]) => (
          <LinkRow key={title} title={title} sub={sub} onPress={() => router.push(href)} />
        ))}
      </View>
      <Body muted style={{ fontSize: 13, lineHeight: 19 }}>
        Build It is a guide, not legal, financial or engineering advice. Building codes, permits and lien laws are set locally and change. Your building department, licensed design professionals and attorney have the final word for your project.
      </Body>
    </Screen>
  );
}
