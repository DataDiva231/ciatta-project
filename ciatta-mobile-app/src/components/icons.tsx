import React from 'react';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';
import { colors } from '../theme/tokens';

type IconProps = { size?: number; color?: string; strokeWidth?: number };

export function SunIcon({ size = 20, color = colors.ink }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="4.5" stroke={color} strokeWidth={1.6} />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
        <Line
          key={deg}
          x1={12 + Math.cos((deg * Math.PI) / 180) * 8}
          y1={12 + Math.sin((deg * Math.PI) / 180) * 8}
          x2={12 + Math.cos((deg * Math.PI) / 180) * 10.5}
          y2={12 + Math.sin((deg * Math.PI) / 180) * 10.5}
          stroke={color}
          strokeWidth={1.6}
          strokeLinecap="round"
        />
      ))}
    </Svg>
  );
}

export function CoreIcon({ size = 20, color = colors.ink }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="8.5" stroke={color} strokeWidth={1.6} />
      <Circle cx="12" cy="12" r="2.5" fill={color} />
    </Svg>
  );
}

export function PersonIcon({ size = 20, color = colors.ink }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="8.2" r="3.6" stroke={color} strokeWidth={1.6} />
      <Path
        d="M4.5 20c1.2-3.8 4.3-5.8 7.5-5.8s6.3 2 7.5 5.8"
        stroke={color}
        strokeWidth={1.6}
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}

export function ChevronIcon({ size = 16, color = colors.ink3 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M9 6l6 6-6 6"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function CloseIcon({ size = 18, color = colors.ink }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M6 6l12 12M18 6L6 18" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

export function MicIcon({ size = 18, color = colors.ink2 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="9.5" y="3.5" width="5" height="9.5" rx="2.5" stroke={color} strokeWidth={1.5} />
      <Path
        d="M6.5 11.5a5.5 5.5 0 0011 0M12 17v3.5"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}

export function ArrowUpIcon({ size = 12, color = colors.accent }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 19V5M6 11l6-6 6 6" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function ArrowDownIcon({ size = 12, color = colors.accent }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 5v14M6 13l6 6 6-6" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function DotIcon({ size = 8, color = colors.accent }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="6" fill={color} />
    </Svg>
  );
}

export function PlusIcon({ size = 18, color = colors.ink }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 5v14M5 12h14" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

export function InfoIcon({ size = 18, color = colors.ink2 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 11v6" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      <Circle cx="12" cy="7.4" r="1.15" fill={color} />
    </Svg>
  );
}

export function ArrowRightIcon({ size = 18, color = colors.accent }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 12h15M13 6l6 6-6 6"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
