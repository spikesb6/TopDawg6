import { useState } from 'react';
import { View } from 'react-native';

import { Screen } from '@/components/screen';
import { Banner, Body, Button, Card, Field, H3, Heading, Pill, Strong } from '@/components/ui';
import { plural } from '@/lib/format';
import { sendCode, verifyCode } from '@/lib/remote';
import { useAccount, type SyncStatus } from '@/store/account-store';
import { useBuild } from '@/store/build-store';
import { useToast } from '@/store/toast-store';
import type { Tone } from '@/theme/theme';

const STATUS: Record<SyncStatus, [Tone, string]> = {
  off: ['plain', 'Not set up'],
  'signed-out': ['plain', 'Signed out'],
  syncing: ['info', 'Saving'],
  synced: ['ok', 'Up to date'],
  error: ['bad', 'Not saved'],
};

function SignIn() {
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <H3>Sign in or create an account</H3>
      <Body muted>We email you a 6-digit code. No password to remember.</Body>
      <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" placeholder="you@example.com" />
      {sent && (
        <Field label="6-digit code from the email" value={code} onChangeText={setCode} keyboardType="number-pad" autoComplete="one-time-code" maxLength={6} placeholder="123456" />
      )}
      {!!error && <Banner tone="bad">{error}</Banner>}
      {!sent ? (
        <Button
          kind="primary"
          label={busy ? 'Sending…' : 'Email me a code'}
          onPress={() =>
            !busy &&
            run(async () => {
              if (!/^\S+@\S+\.\S+$/.test(email.trim())) throw new Error('Enter your full email address, like you@example.com.');
              await sendCode(email.trim());
              setSent(true);
              toast('Code sent. Check your email.');
            })
          }
        />
      ) : (
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          <Button
            kind="primary"
            label={busy ? 'Checking…' : 'Sign in'}
            onPress={() =>
              !busy &&
              run(async () => {
                if (!/^\d{6}$/.test(code.trim())) throw new Error('Enter the 6 digits from the email.');
                await verifyCode(email.trim(), code.trim());
                toast('Signed in. Your build is backing up.');
              })
            }
          />
          <Button label="Send a new code" onPress={() => !busy && run(() => sendCode(email.trim()))} />
        </View>
      )}
    </Card>
  );
}

export default function AccountScreen() {
  const account = useAccount();
  const { state, meta } = useBuild();
  const toast = useToast();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const notBackedUp = state.photos.filter((p) => !p.uploaded).length;
  const [tone, label] = STATUS[account.status];

  return (
    <Screen back>
      <Heading
        eyebrow="Account"
        title="Your build on every phone"
        lede="Sign in to back up your build and photos, and pick up where you left off on another phone. Without an account, everything stays on this phone."
      />

      {!account.available && (
        <Banner tone="plain">
          Accounts aren’t switched on in this copy of Build It yet. Your build is saved on this phone, and you can move it with a backup code under About your project.
        </Banner>
      )}

      {account.available && !account.userId && <SignIn />}

      {account.userId && (
        <Card>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <H3>Signed in</H3>
            <Pill tone={tone}>{label}</Pill>
          </View>
          <Body><Strong>{account.email}</Strong></Body>
          <Body muted>
            {account.lastSynced ? `Last saved at ${account.lastSynced.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}.` : 'Saving shortly.'}
            {meta.dirty ? ' Some changes are waiting to save.' : ''}
            {notBackedUp ? ` ${plural(notBackedUp, 'photo')} still to back up.` : ''}
          </Body>
          {account.status === 'error' && (
            <Banner tone="bad" actionLabel="Try again" onAction={account.syncNow}>
              Couldn’t reach your account: {account.error} Your changes are safe on this phone.
            </Banner>
          )}
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            <Button label="Save now" onPress={account.syncNow} />
            <Button
              label="Sign out"
              onPress={async () => {
                await account.signOut();
                toast('Signed out. Your build stays on this phone.');
              }}
            />
          </View>
        </Card>
      )}

      {account.userId && (
        <Card>
          <H3>Delete account</H3>
          <Body muted>Deletes your account, the copy of your build in it, and every backed-up photo. Your build stays on this phone.</Body>
          {confirmDelete ? (
            <View style={{ gap: 8 }}>
              <Body><Strong>Delete your account for good?</Strong> This can’t be undone.</Body>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Button
                  kind="danger"
                  label={busy ? 'Deleting…' : 'Yes, delete it'}
                  onPress={async () => {
                    if (busy) return;
                    setBusy(true);
                    try {
                      await account.deleteAccount();
                      toast('Account deleted.');
                      setConfirmDelete(false);
                    } catch {
                      toast('Couldn’t delete the account. Check your connection and try again.');
                    } finally {
                      setBusy(false);
                    }
                  }}
                />
                <Button label="Keep it" onPress={() => setConfirmDelete(false)} />
              </View>
            </View>
          ) : (
            <Button kind="danger" label="Delete account" onPress={() => setConfirmDelete(true)} />
          )}
        </Card>
      )}
    </Screen>
  );
}
