import { router } from 'expo-router';

import { Screen } from '@/components/screen';
import { Button, Heading } from '@/components/ui';

export default function NotFound() {
  return (
    <Screen>
      <Heading title="That page isn’t here" lede="It may have moved. Your build is safe." />
      <Button kind="primary" label="Go to My build" onPress={() => router.replace('/')} />
    </Screen>
  );
}
