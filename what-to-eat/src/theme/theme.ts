// Color tokens and shared look values from the build brief and reference/prototype.html.

export const palette = {
  cream: '#FFF4DC',
  ink: '#2B1B3D',
  tomato: '#FF4D3D',
  grape: '#7B4DFF',
  mint: '#14B38A',
  sunny: '#FFC93C',
  coral: '#FF8A7A',
  lavender: '#B9A2FF',
  seafoam: '#6FE0BF',
  night: '#1D1230',
  // Deeper wordmark shades the prototype uses on the light background for contrast.
  tomatoDeep: '#AB3429',
  mintDeep: '#0B5F49',
} as const;

export type ColorScheme = 'light' | 'dark';

export type ThemeColors = {
  background: string;
  text: string;
  muted: string;
  hairline: string;
  border: string;
  onAccent: string;
  wordWhat: string;
  wordTo: string;
  wordEat: string;
  tabActive: string;
};

export const colors: Record<ColorScheme, ThemeColors> = {
  light: {
    background: palette.cream,
    text: palette.ink,
    muted: '#6B5A7E',
    hairline: 'rgba(43, 27, 61, 0.2)',
    border: palette.ink,
    onAccent: palette.ink,
    wordWhat: palette.tomatoDeep,
    wordTo: palette.grape,
    wordEat: palette.mintDeep,
    tabActive: palette.tomato,
  },
  dark: {
    background: palette.night,
    text: palette.cream,
    muted: '#B9A9CC',
    hairline: 'rgba(255, 244, 220, 0.2)',
    border: palette.ink,
    onAccent: palette.ink,
    wordWhat: palette.tomato,
    wordTo: palette.grape,
    wordEat: palette.mint,
    tabActive: palette.tomato,
  },
};

export const fonts = {
  heading: 'Fredoka_700Bold',
  headingSemi: 'Fredoka_600SemiBold',
  body: 'Nunito_700Bold',
} as const;

export const radius = {
  tile: 18,
  button: 24,
  card: 28,
} as const;

export const borderWidth = 3;

/** Grows small text links to a 44 pt touch target. */
export const linkHitSlop = { top: 13, bottom: 13, left: 10, right: 10 };

export const spacing = {
  screen: 20,
  gap: 12,
} as const;

export type ModeKey = 'cook' | 'fast' | 'dine' | 'deliv';

export const modeColors: Record<ModeKey, string> = {
  cook: palette.coral,
  fast: palette.sunny,
  dine: palette.lavender,
  deliv: palette.seafoam,
};
