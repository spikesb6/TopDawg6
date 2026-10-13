// Outline icons drawn on a 24x24 grid (shapes adapted from Tabler Icons, MIT).
import Svg, { Circle, Path, Rect } from 'react-native-svg';

export type IconName =
  | 'home'
  | 'heart'
  | 'clock'
  | 'chefHat'
  | 'burger'
  | 'forkKnife'
  | 'bag'
  | 'dice';

type IconProps = {
  name: IconName;
  color: string;
  size?: number;
  strokeWidth?: number;
};

const paths: Record<Exclude<IconName, 'dice' | 'clock'>, string[]> = {
  home: [
    'M5 12H3l9-9 9 9h-2',
    'M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7',
    'M9 21v-6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v6',
  ],
  heart: ['M19.5 12.572 12 20l-7.5-7.428A5 5 0 1 1 12 6.006a5 5 0 1 1 7.5 6.572'],
  chefHat: [
    'M12 3c1.918 0 3.52 1.35 3.91 3.151a4 4 0 0 1 2.09 7.723V21H6v-7.126a4 4 0 1 1 2.092-7.723A4 4 0 0 1 12 3z',
    'M6.161 17.009 18 17',
  ],
  burger: [
    'M4 15h16a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z',
    'M12 4c3.783 0 6.953 2.133 7.786 5H4.214C5.047 6.133 8.217 4 12 4z',
    'M5 12h14',
  ],
  forkKnife: [
    'M19 3v12h-5c-.023-3.681.184-7.406 5-12zm0 12v6h-1v-3',
    'M8 4v17',
    'M5 4v3a3 3 0 1 0 6 0V4',
  ],
  bag: [
    'M6.331 8h11.339a2 2 0 0 1 1.977 2.304l-1.255 8.152A3 3 0 0 1 15.426 21H8.574a3 3 0 0 1-2.965-2.544l-1.255-8.152A2 2 0 0 1 6.331 8z',
    'M9 11V6a3 3 0 0 1 6 0v5',
  ],
};

export function Icon({ name, color, size = 24, strokeWidth = 2 }: IconProps) {
  const stroke = {
    stroke: color,
    strokeWidth,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: 'none',
  };

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {name === 'dice' ? (
        <>
          <Rect x={3} y={3} width={18} height={18} rx={3} {...stroke} />
          {[
            [8.5, 8.5],
            [15.5, 8.5],
            [12, 12],
            [8.5, 15.5],
            [15.5, 15.5],
          ].map(([cx, cy]) => (
            <Circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={1.2} fill={color} />
          ))}
        </>
      ) : name === 'clock' ? (
        <>
          <Circle cx={12} cy={12} r={9} {...stroke} />
          <Path d="M12 7v5l3 3" {...stroke} />
        </>
      ) : (
        paths[name].map((d) => <Path key={d} d={d} {...stroke} />)
      )}
    </Svg>
  );
}
