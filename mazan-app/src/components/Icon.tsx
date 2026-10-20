/**
 * Mazan's own line icon set, drawn with react-native-svg (bundled with Expo Go).
 * Directional icons (chevrons, back) mirror automatically in right-to-left layouts.
 */
import type { ColorValue } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { useApp } from '@/state/AppProvider';

export type IconName =
  | 'home'
  | 'diary'
  | 'plus'
  | 'chart'
  | 'more'
  | 'search'
  | 'barcode'
  | 'chevron-forward'
  | 'chevron-back'
  | 'close'
  | 'trash'
  | 'copy'
  | 'edit'
  | 'star'
  | 'star-filled'
  | 'dots'
  | 'drop'
  | 'flame'
  | 'clock'
  | 'check'
  | 'bolt'
  | 'scale'
  | 'user'
  | 'globe'
  | 'moon'
  | 'shield'
  | 'minus'
  | 'food';

const MIRRORED: IconName[] = ['chevron-forward', 'chevron-back'];

export function Icon({ name, size = 22, color, strokeWidth = 2 }: { name: IconName; size?: number; color?: ColorValue; strokeWidth?: number }) {
  const { colors, isRTL } = useApp();
  const c = color ?? colors.ink;
  const p = { stroke: c, strokeWidth, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  const flip = isRTL && MIRRORED.includes(name) ? { transform: [{ scaleX: -1 }] } : undefined;

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" style={flip}>
      {(() => {
        switch (name) {
          case 'home':
            return <Path {...p} d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />;
          case 'diary':
            return (
              <>
                <Path {...p} d="M5 3h12a2 2 0 0 1 2 2v16H7a2 2 0 0 1-2-2z" />
                <Path {...p} d="M9 8h6M9 12h6M9 16h3" />
              </>
            );
          case 'plus':
            return <Path {...p} d="M12 5v14M5 12h14" />;
          case 'minus':
            return <Path {...p} d="M5 12h14" />;
          case 'chart':
            return (
              <>
                <Path {...p} d="M3 20h18" />
                <Path {...p} d="M4 16l5-5 4 3 7-8" />
              </>
            );
          case 'more':
            return (
              <>
                <Circle {...p} cx={12} cy={12} r={3} />
                <Path {...p} d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
              </>
            );
          case 'search':
            return (
              <>
                <Circle {...p} cx={11} cy={11} r={7} />
                <Path {...p} d="M20 20l-4-4" />
              </>
            );
          case 'barcode':
            return <Path {...p} d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M7 8v8M10 8v8M13 8v8M17 8v8" />;
          case 'chevron-forward':
            return <Path {...p} d="M9 6l6 6-6 6" />;
          case 'chevron-back':
            return <Path {...p} d="M15 6l-6 6 6 6" />;
          case 'close':
            return <Path {...p} d="M6 6l12 12M18 6L6 18" />;
          case 'trash':
            return <Path {...p} d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6" />;
          case 'copy':
            return (
              <>
                <Rect {...p} x={9} y={9} width={11} height={11} rx={2} />
                <Path {...p} d="M5 15V6a2 2 0 0 1 2-2h8" />
              </>
            );
          case 'edit':
            return <Path {...p} d="M4 20h4L19 9l-4-4L4 16zM14 6l4 4" />;
          case 'star':
            return <Path {...p} d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z" />;
          case 'star-filled':
            return <Path {...p} fill={c} d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z" />;
          case 'dots':
            return (
              <>
                <Circle cx={5} cy={12} r={1.8} fill={c} />
                <Circle cx={12} cy={12} r={1.8} fill={c} />
                <Circle cx={19} cy={12} r={1.8} fill={c} />
              </>
            );
          case 'drop':
            return <Path {...p} d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z" />;
          case 'flame':
            return <Path {...p} d="M12 3c1 4 5 5.5 5 10a5 5 0 0 1-10 0c0-2.5 1.5-4 2.5-5 .3 1.8 1.2 2.6 2 3 0-3-.5-5.5.5-8z" />;
          case 'clock':
            return (
              <>
                <Circle {...p} cx={12} cy={12} r={9} />
                <Path {...p} d="M12 7v5l3 2" />
              </>
            );
          case 'check':
            return <Path {...p} d="M5 12.5l4.5 4.5L19 7" />;
          case 'bolt':
            return <Path {...p} d="M13 3L5 14h6l-1 7 8-11h-6z" />;
          case 'scale':
            return (
              <>
                <Rect {...p} x={3} y={3} width={18} height={18} rx={4} />
                <Path {...p} d="M8 9a5 5 0 0 1 8 0l-3 3" />
              </>
            );
          case 'user':
            return (
              <>
                <Circle {...p} cx={12} cy={8} r={4} />
                <Path {...p} d="M4 21c1-4 4-6 8-6s7 2 8 6" />
              </>
            );
          case 'globe':
            return (
              <>
                <Circle {...p} cx={12} cy={12} r={9} />
                <Path {...p} d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18" />
              </>
            );
          case 'moon':
            return <Path {...p} d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />;
          case 'shield':
            return <Path {...p} d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />;
          case 'food':
            return <Path {...p} d="M7 3v8a2 2 0 0 0 4 0V3M9 11v10M17 21V3c-2 1-3 4-3 7h3" />;
        }
      })()}
    </Svg>
  );
}
