// Color tokens and shared look values. Same palette as the Build It web app:
// cured concrete, graphite ink, copper-patina accent, surveyor's flagging-tape pink for hold points.

export type ColorScheme = 'light' | 'dark';

export type ThemeColors = {
  background: string;
  surface: string;
  surface2: string;
  text: string;
  muted: string;
  line: string;
  accent: string;
  accentSoft: string;
  onAccent: string;
  flag: string;
  flagSoft: string;
  ok: string;
  okSoft: string;
  warn: string;
  warnSoft: string;
  bad: string;
  badSoft: string;
};

export const colors: Record<ColorScheme, ThemeColors> = {
  light: {
    background: '#ECEEEA',
    surface: '#FAFBF8',
    surface2: '#E1E5DF',
    text: '#1B2226',
    muted: '#59646A',
    line: '#CBD1CA',
    accent: '#1E5B57',
    accentSoft: '#D2E3DF',
    onAccent: '#FFFFFF',
    flag: '#C8195F',
    flagSoft: '#F8D9E5',
    ok: '#2B7445',
    okSoft: '#D8EDDF',
    warn: '#9A5B00',
    warnSoft: '#F6E6C8',
    bad: '#AF2B21',
    badSoft: '#F6DAD6',
  },
  dark: {
    background: '#111517',
    surface: '#192024',
    surface2: '#222A2F',
    text: '#E7ECE9',
    muted: '#9AA5A8',
    line: '#2F393E',
    accent: '#6CC0B4',
    accentSoft: '#1C3633',
    onAccent: '#0D1A19',
    flag: '#FF6EA5',
    flagSoft: '#3E1A2A',
    ok: '#6CC48D',
    okSoft: '#173123',
    warn: '#E7AE4E',
    warnSoft: '#3A2B12',
    bad: '#F2837A',
    badSoft: '#3D1C19',
  },
};

export type Tone = 'ok' | 'warn' | 'bad' | 'flag' | 'info' | 'plain';

export function toneColors(theme: ThemeColors, tone: Tone) {
  switch (tone) {
    case 'ok': return { bg: theme.okSoft, fg: theme.ok };
    case 'warn': return { bg: theme.warnSoft, fg: theme.warn };
    case 'bad': return { bg: theme.badSoft, fg: theme.bad };
    case 'flag': return { bg: theme.flagSoft, fg: theme.flag };
    case 'info': return { bg: theme.accentSoft, fg: theme.accent };
    default: return { bg: theme.surface2, fg: theme.muted };
  }
}

export const fonts = {
  display: 'Archivo_800ExtraBold',
  black: 'Archivo_900Black',
  body: 'IBMPlexSans_400Regular',
  bodySemi: 'IBMPlexSans_600SemiBold',
  mono: 'IBMPlexMono_500Medium',
} as const;

export const radius = {
  card: 10,
  control: 8,
  pill: 99,
} as const;

export const spacing = {
  screen: 18,
  gap: 12,
} as const;

/** Grows small text links to a 44 pt touch target. */
export const linkHitSlop = { top: 13, bottom: 13, left: 10, right: 10 };
