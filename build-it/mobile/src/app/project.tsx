import { useState } from 'react';
import { Share, View } from 'react-native';

import { Screen } from '@/components/screen';
import { Body, Button, Card, Field, H3, Heading, Label, Segmented, Strong, ToggleRow } from '@/components/ui';
import { makeBackup, readBackup } from '@/lib/backup';
import { deleteLocalPhoto } from '@/lib/photo-files';
import { deleteRemotePhoto } from '@/lib/remote';
import { toNumber } from '@/lib/format';
import { freshState, type Profile } from '@/lib/state';
import { useAccount } from '@/store/account-store';
import { useBuild } from '@/store/build-store';
import { useToast } from '@/store/toast-store';

const TOGGLES: [keyof Profile, string][] = [
  ['hoa', 'Lot has an HOA'],
  ['flood', 'In or near a flood zone'],
  ['acre', 'Disturbing 1+ acre'],
  ['trees', 'Removing large trees'],
  ['demo', 'Tearing down a structure'],
  ['gas', 'Using natural gas or propane'],
];

export default function Project() {
  const { state, update, replace } = useBuild();
  const toast = useToast();
  const account = useAccount();
  const P = state.profile;
  const [sqft, setSqft] = useState(String(P.sqft));
  const [code, setCode] = useState('');
  const [restoring, setRestoring] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => update((prev) => ({ ...prev, profile: { ...prev.profile, [k]: v } }));

  return (
    <Screen back>
      <Heading eyebrow="My build" title="About your project" lede="These details shape your permit list and budget." />
      <Card>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          <Field row label="Project name" value={P.name} onChangeText={(t) => set('name', t)} placeholder="The Oak Hill house" />
          <Field row label="City, county and state" value={P.location} onChangeText={(t) => set('location', t)} placeholder="Wake County, NC" />
          <Field
            row
            label="Heated square feet"
            value={sqft}
            keyboardType="number-pad"
            onChangeText={(t) => {
              setSqft(t);
              const n = toNumber(t);
              update((prev) => ({ ...prev, profile: { ...prev.profile, sqft: n }, budget: { ...prev.budget, sqft: n } }));
            }}
          />
        </View>
        <Label>Stories</Label>
        <Segmented label="Stories" options={[['1', '1'], ['1.5', '1.5'], ['2', '2'], ['3', '3']]} value={P.stories} onChange={(v) => set('stories', v)} />
        <Label>Foundation</Label>
        <Segmented label="Foundation" options={[['slab', 'Slab'], ['crawl', 'Crawlspace'], ['basement', 'Basement']]} value={P.foundation} onChange={(v) => set('foundation', v)} />
        <Label>Who runs the build</Label>
        <Segmented label="Who runs the build" options={[['gc', 'General contractor'], ['owner', 'Me (owner-builder)']]} value={P.route} onChange={(v) => set('route', v)} />
        {P.route === 'owner' && (
          <Body muted>Owner-builder: check your state’s owner-builder rules, your lender’s policy and your insurance before you commit.</Body>
        )}
        <Label>Water and sewer</Label>
        <Segmented label="Water and sewer" options={[['public', 'Public water and sewer'], ['private', 'Well and septic']]} value={P.utilities} onChange={(v) => set('utilities', v)} />
        {TOGGLES.map(([k, label]) => (
          <ToggleRow key={k} label={label} value={!!P[k]} onChange={(v) => set(k, v as never)} />
        ))}
      </Card>

      <Card>
        <H3>Back up my build</H3>
        <Body muted>{account.userId ? 'Your build backs up to your account automatically. ' : ''}A backup code holds your whole build except the photo files. Paste one here to carry on from another phone or the Build It web app.</Body>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <Button label="Share backup code" onPress={() => Share.share({ message: makeBackup(state) }).catch(() => {})} />
          <Button label="Restore from a code" onPress={() => setRestoring(!restoring)} />
        </View>
        {restoring && (
          <>
            <Field label="Backup code" value={code} onChangeText={setCode} multiline placeholder="Paste your backup code here" autoCapitalize="none" autoCorrect={false} />
            <Button
              kind="primary"
              label="Restore"
              onPress={() => {
                const restored = readBackup(code);
                if (!restored) return toast('That code didn’t work. Copy the whole code again and paste it here.');
                replace(restored);
                setSqft(String(restored.profile.sqft));
                setRestoring(false);
                setCode('');
                toast('Build restored');
              }}
            />
          </>
        )}
        {confirmReset ? (
          <View style={{ gap: 8 }}>
            <Body><Strong>Erase everything?</Strong> This clears every checked step, note, payment, photo and setting{account.userId ? ' on this phone and in your account' : ' on this phone'}.</Body>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button
                kind="danger"
                label="Yes, start over"
                onPress={() => {
                  state.photos.forEach((p) => {
                    deleteLocalPhoto(p.id);
                    if (account.userId) deleteRemotePhoto(account.userId, p.id).catch(() => {});
                  });
                  replace({ ...freshState(), payments: [] });
                  setSqft(String(freshState().profile.sqft));
                  setConfirmReset(false);
                  toast('Started a fresh build');
                }}
              />
              <Button label="Keep it" onPress={() => setConfirmReset(false)} />
            </View>
          </View>
        ) : (
          <Button kind="danger" label="Start over" onPress={() => setConfirmReset(true)} />
        )}
      </Card>
    </Screen>
  );
}
