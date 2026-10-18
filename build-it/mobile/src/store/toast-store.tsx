import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/hooks/use-theme';
import { fonts, linkHitSlop } from '@/theme/theme';

type Toast = { message: string; actionLabel?: string; action?: () => void };
type Show = (message: string, actionLabel?: string, action?: () => void) => void;

const Ctx = createContext<Show | null>(null);

/** A short message above the tab bar, with an optional action. Hides after 6 seconds. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  useEffect(() => () => clearTimeout(timer.current), []);

  const show: Show = (message, actionLabel, action) => {
    clearTimeout(timer.current);
    setToast({ message, actionLabel, action });
    timer.current = setTimeout(() => setToast(null), 6000);
  };

  return (
    <Ctx.Provider value={show}>
      {children}
      {toast && (
        <View
          accessibilityLiveRegion="polite"
          style={[styles.toast, { backgroundColor: theme.text, bottom: insets.bottom + 84 }]}>
          <Text style={[styles.text, { color: theme.background }]}>{toast.message}</Text>
          {toast.actionLabel && (
            <Pressable
              accessibilityRole="button"
              hitSlop={linkHitSlop}
              onPress={() => {
                setToast(null);
                toast.action?.();
              }}>
              <Text style={[styles.action, { color: theme.background }]}>{toast.actionLabel}</Text>
            </Pressable>
          )}
        </View>
      )}
    </Ctx.Provider>
  );
}

export function useToast() {
  const show = useContext(Ctx);
  if (!show) throw new Error('useToast must be used inside ToastProvider');
  return show;
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    left: 16,
    right: 16,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  text: { flex: 1, fontFamily: fonts.body, fontSize: 15 },
  action: { fontFamily: fonts.bodySemi, fontSize: 15, textDecorationLine: 'underline' },
});
