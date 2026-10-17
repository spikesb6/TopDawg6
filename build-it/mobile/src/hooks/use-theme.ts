import { useColorScheme } from 'react-native';

import { colors, type ColorScheme } from '@/theme/theme';

export function useScheme(): ColorScheme {
  return useColorScheme() === 'dark' ? 'dark' : 'light';
}

export function useTheme() {
  return colors[useScheme()];
}
