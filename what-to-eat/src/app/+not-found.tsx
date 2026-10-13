import { EmptyState } from '@/components/empty-state';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';

export default function NotFoundScreen() {
  return (
    <Screen>
      <ScreenHeader />
      <EmptyState
        icon="forkKnife"
        title="This page wandered off"
        body="Let's get you back to deciding dinner."
      />
    </Screen>
  );
}
