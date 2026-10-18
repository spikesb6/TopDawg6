// Outline icons drawn on a 24x24 grid (shapes adapted from Tabler Icons, MIT).
import Svg, { Path } from 'react-native-svg';

export type IconName =
  | 'home'
  | 'road'
  | 'land'
  | 'money'
  | 'more'
  | 'check'
  | 'chevronLeft'
  | 'chevronRight'
  | 'plus'
  | 'minus'
  | 'flag';

const paths: Record<IconName, string[]> = {
  home: ['M5 12H3l9-9 9 9h-2', 'M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7', 'M9 21v-6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v6'],
  road: ['M4 19L8 5', 'M16 5l4 14', 'M12 6v2', 'M12 11v2', 'M12 16v3'],
  land: ['M3 7l6-3 6 3 6-3v13l-6 3-6-3-6 3V7', 'M9 4v13', 'M15 7v13'],
  money: ['M16.7 8A3 3 0 0 0 14 6h-4a3 3 0 0 0 0 6h4a3 3 0 0 1 0 6h-4a3 3 0 0 1-2.7-2', 'M12 3v3m0 12v3'],
  more: ['M4 6h16', 'M4 12h16', 'M4 18h16'],
  check: ['M5 12l5 5L20 7'],
  chevronLeft: ['M15 6l-6 6 6 6'],
  chevronRight: ['M9 6l6 6-6 6'],
  plus: ['M12 5v14', 'M5 12h14'],
  minus: ['M5 12h14'],
  flag: ['M5 5a5 5 0 0 1 7 0 5 5 0 0 0 7 0v9a5 5 0 0 1-7 0 5 5 0 0 0-7 0V5z', 'M5 21v-7'],
};

type IconProps = { name: IconName; color: string; size?: number; strokeWidth?: number };

export function Icon({ name, color, size = 24, strokeWidth = 2 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {paths[name].map((d) => (
        <Path key={d} d={d} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      ))}
    </Svg>
  );
}
