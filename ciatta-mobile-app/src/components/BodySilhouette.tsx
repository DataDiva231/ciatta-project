import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  G,
  Image as SvgImage,
  Line,
  LinearGradient,
  Mask,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';
import { colors, fonts, strengthOpacity } from '../theme/tokens';
import { domainLabel, strengthShort } from '../lib/mockData';
import type { Domain, Strength } from '../lib/types';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// Fractional (0-1) positions over the figure — proportions of its width and
// height, so they hold at any render size. `labelDy` and `lead` place the
// label away from its point, which is what turns the leader line diagonal.
type Position = {
  x: number;
  y: number;
  side: 'left' | 'right';
  /** Vertical offset of the label from the point, as a fraction of height. */
  labelDy?: number;
  /** Horizontal run from the point to the label anchor, in px at base width. */
  lead?: number;
};

type Figure = {
  src: ReturnType<typeof require>;
  w: number;
  h: number;
  baseWidth: number;
  positions: Record<Domain, Position>;
};

// Two renders of the same body: a torso crop that Today frames tightly, and
// the full figure the Core map needs so hip and leg anchors have somewhere to
// sit. They carry separate anchors because the proportions differ — reusing
// one set would drift every point.
const FIGURES: Record<'torso' | 'full', Figure> = {
  torso: {
    src: require('../../assets/images/silhouette.png'),
    w: 426,
    h: 586,
    baseWidth: 264,
    positions: {
      sleep: { x: 0.37, y: 0.32, side: 'left' },
      recovery: { x: 0.6, y: 0.38, side: 'right' },
      cycle: { x: 0.4, y: 0.58, side: 'left' },
      energy: { x: 0.63, y: 0.85, side: 'right' },
      mood: { x: 0.37, y: 0.85, side: 'left' },
    },
  },
  full: {
    src: require('../../assets/images/silhouette-full.png'),
    w: 850,
    h: 1850,
    baseWidth: 232,
    positions: {
      sleep: { x: 0.35, y: 0.22, side: 'left', labelDy: -0.05, lead: 42 },
      recovery: { x: 0.71, y: 0.26, side: 'right', labelDy: -0.042, lead: 38 },
      mood: { x: 0.53, y: 0.4, side: 'right', labelDy: 0.075, lead: 52 },
      cycle: { x: 0.31, y: 0.54, side: 'left', labelDy: 0.06, lead: 48 },
      energy: { x: 0.66, y: 0.66, side: 'right', labelDy: 0.05, lead: 44 },
    },
  },
};

const DOMAIN_ORDER: Domain[] = ['sleep', 'recovery', 'cycle', 'energy', 'mood'];

// Exposed so callers (Core) can solve for a `scale` that fills the space
// they have available without duplicating the full figure's raw dimensions.
export const CORE_FIGURE_BASE_WIDTH = FIGURES.full.baseWidth;
export const CORE_FIGURE_ASPECT = FIGURES.full.h / FIGURES.full.w;

function Glow({
  domain,
  pos,
  strength,
  delay,
  animated,
  w,
  h,
}: {
  domain: Domain;
  pos: Position;
  strength: Strength;
  delay: number;
  animated: boolean;
  w: number;
  h: number;
}) {
  const cx = pos.x * w;
  const cy = pos.y * h;
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!animated) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(progress, {
          toValue: 1,
          duration: 1750,
          useNativeDriver: false,
        }),
        Animated.timing(progress, {
          toValue: 0,
          duration: 1750,
          useNativeDriver: false,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [animated, delay, progress]);

  const baseOpacity =
    strength === 'very-strong'
      ? 0.9
      : strength === 'strong'
      ? 0.75
      : strength === 'moderate'
      ? 0.55
      : 0.4;

  const baseR = w * 0.15;
  const r = animated
    ? progress.interpolate({ inputRange: [0, 1], outputRange: [baseR * 0.92, baseR * 1.12] })
    : baseR;
  const opacity = animated
    ? progress.interpolate({
        inputRange: [0, 1],
        outputRange: [baseOpacity * 0.75, baseOpacity],
      })
    : baseOpacity;

  return (
    <>
      <AnimatedCircle
        cx={cx}
        cy={cy}
        r={r as unknown as number}
        fill={`url(#glow-${domain})`}
        opacity={opacity as unknown as number}
      />
      <Circle cx={cx} cy={cy} r={4} fill={colors.white} stroke={colors.evidence} strokeWidth={2} />
    </>
  );
}

// The Today figure carries a single mark, not a pulsing field: one domain is
// featured, so a soft glow reads as ambient noise where a drawn glyph reads
// as "this, specifically." It echoes the Today tab icon deliberately — the
// same sun means the same thing in both places.
function DotMarker({
  pos,
  strength,
  w,
  h,
}: {
  pos: Position;
  strength: Strength;
  w: number;
  h: number;
}) {
  return (
    <Circle
      cx={pos.x * w}
      cy={pos.y * h}
      r={Math.max(3.5, w * 0.013)}
      fill={colors.ink}
      opacity={strengthOpacity[strength] ?? 0.6}
    />
  );
}

function SunMarker({ pos, w, h }: { pos: Position; w: number; h: number }) {
  const cx = pos.x * w;
  const cy = pos.y * h;
  const core = Math.max(5, w * 0.019);
  const inner = core * 1.75;
  const outer = core * 2.85;
  return (
    <G>
      <Circle cx={cx} cy={cy} r={core} stroke={colors.accent} strokeWidth={1.5} fill="none" />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
        const rad = (deg * Math.PI) / 180;
        return (
          <Line
            key={deg}
            x1={cx + Math.cos(rad) * inner}
            y1={cy + Math.sin(rad) * inner}
            x2={cx + Math.cos(rad) * outer}
            y2={cy + Math.sin(rad) * outer}
            stroke={colors.accent}
            strokeWidth={1.5}
            strokeLinecap="round"
          />
        );
      })}
    </G>
  );
}

export interface BodySilhouetteProps {
  variant?: 'today' | 'core' | 'mini';
  activeDomain?: Domain;
  strengths?: Partial<Record<Domain, Strength>>;
  labeled?: boolean;
  animated?: boolean;
  onDomainPress?: (domain: Domain) => void;
  stage?: 0 | 1 | 2 | 3;
  scale?: number;
  /** Fraction (0-1) of the full figure height to reveal, cropped from the top. */
  crop?: number;
  /** How a featured domain is marked: a breathing glow, or a drawn sun glyph. */
  marker?: 'glow' | 'sun' | 'dot';
}

export default function BodySilhouette({
  variant = 'today',
  activeDomain,
  strengths,
  labeled = false,
  animated = true,
  onDomainPress,
  stage,
  scale = 1,
  crop = 1,
  marker = 'glow',
}: BodySilhouetteProps) {
  const domainsToRender = useMemo<Domain[]>(() => {
    if (variant === 'today') {
      return activeDomain ? [activeDomain] : [];
    }
    if (variant === 'mini') {
      const count = [1, 2, 4, 5][stage ?? 0];
      return DOMAIN_ORDER.slice(0, count);
    }
    // core: only show domains with a real understanding, not the full set —
    // an unlit figure is the honest state when nothing has been learned yet.
    return strengths ? (Object.keys(strengths) as Domain[]) : DOMAIN_ORDER;
  }, [variant, activeDomain, stage, strengths]);

  // Core needs hips and legs, so it renders the full figure; Today and the
  // onboarding mini both frame the torso.
  const figure = variant === 'core' ? FIGURES.full : FIGURES.torso;
  const positions = figure.positions;

  const gutter = labeled ? 74 : 0;
  const w = figure.baseWidth * scale;
  const h = w * (figure.h / figure.w);
  const wrapW = w + gutter * 2;
  const visibleH = h * crop;
  const isCropped = crop < 1;
  // The Today asset is tinted to the canvas color itself, so it needs no
  // opacity to sit back — fading it further would only mute the modelling
  // that makes a tone-on-tone figure readable at all.
  // Both assets are already tinted to the canvas tone, so neither needs
  // opacity to sit back; fading them only mutes the modelling.
  const imageOpacity = variant === 'mini' ? 0.7 : 1;

  return (
    <View
      style={{ width: wrapW, height: visibleH, alignSelf: 'center', overflow: 'hidden' }}
    >
      <View style={{ position: 'absolute', left: gutter, top: 0 }}>
        <Svg width={w} height={visibleH}>
          <Defs>
            {DOMAIN_ORDER.map((d) => (
              <RadialGradient key={d} id={`glow-${d}`} cx="50%" cy="50%" r="50%">
                <Stop offset="0%" stopColor={colors.evidence} stopOpacity={0.85} />
                <Stop offset="60%" stopColor={colors.evidence} stopOpacity={0.28} />
                <Stop offset="100%" stopColor={colors.evidence} stopOpacity={0} />
              </RadialGradient>
            ))}
            {isCropped && (
              <>
                <LinearGradient id="fadeGradient" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0%" stopColor="#fff" stopOpacity={1} />
                  <Stop offset="65%" stopColor="#fff" stopOpacity={1} />
                  <Stop offset="100%" stopColor="#fff" stopOpacity={0} />
                </LinearGradient>
                <Mask id="fadeMask">
                  <Rect x={0} y={0} width={w} height={visibleH} fill="url(#fadeGradient)" />
                </Mask>
              </>
            )}
          </Defs>

          <SvgImage
            href={figure.src}
            x={0}
            y={0}
            width={w}
            height={h}
            opacity={imageOpacity}
            preserveAspectRatio="xMidYMin meet"
            mask={isCropped ? 'url(#fadeMask)' : undefined}
          />

          {labeled &&
            domainsToRender.map((d) => {
              const pos = positions[d];
              const dir = pos.side === 'left' ? -1 : 1;
              const cx = pos.x * w;
              const cy = pos.y * h;
              return (
                <Line
                  key={`line-${d}`}
                  x1={cx}
                  y1={cy}
                  x2={cx + dir * (pos.lead ?? 44)}
                  y2={cy + (pos.labelDy ?? 0) * h}
                  stroke={colors.ink3}
                  strokeWidth={1}
                />
              );
            })}

          {domainsToRender.map((d, i) =>
            marker === 'sun' ? (
              <SunMarker key={d} pos={positions[d]} w={w} h={h} />
            ) : marker === 'dot' ? (
              <DotMarker
                key={d}
                pos={positions[d]}
                strength={strengths?.[d] ?? 'moderate'}
                w={w}
                h={h}
              />
            ) : (
              <Glow
                key={d}
                domain={d}
                pos={positions[d]}
                strength={strengths?.[d] ?? 'moderate'}
                delay={i * 500}
                animated={animated && variant !== 'mini'}
                w={w}
                h={h}
              />
            )
          )}
        </Svg>
      </View>

      {/* Touch targets over the dots themselves. The dots live inside the
          <Svg>, which takes no press events, so without these the only
          tappable things are the text labels off to the side — and the
          figure reads as interactive long before you find them. */}
      {onDomainPress &&
        domainsToRender.map((d) => {
          const pos = positions[d];
          const cx = gutter + pos.x * w;
          const cy = pos.y * h;
          // Anchors sit closer together on the full figure, so the target has
          // to stay near the 44pt minimum rather than scaling with width.
          const size = Math.max(44, w * (variant === 'core' ? 0.2 : 0.3));
          if (cy > visibleH) return null;
          return (
            <Pressable
              key={`hotspot-${d}`}
              accessibilityRole="button"
              accessibilityLabel={`${domainLabel[d]} — open understanding`}
              onPress={() => onDomainPress(d)}
              style={({ pressed }) => [
                {
                  position: 'absolute',
                  left: cx - size / 2,
                  top: cy - size / 2,
                  width: size,
                  height: size,
                  borderRadius: size / 2,
                },
                pressed && { backgroundColor: colors.evidenceSoft },
              ]}
            />
          );
        })}

      {labeled &&
        domainsToRender.map((d) => {
          const pos = positions[d];
          const isLeft = pos.side === 'left';
          const lead = pos.lead ?? 44;
          const top = pos.y * h + (pos.labelDy ?? 0) * h - 10;
          const anchorX = gutter + (pos.x * w + (isLeft ? -lead : lead));
          return (
            <Pressable
              key={`label-${d}`}
              onPress={() => onDomainPress?.(d)}
              style={[
                styles.labelWrap,
                isLeft
                  ? { right: wrapW - anchorX + 6, alignItems: 'flex-end' }
                  : { left: anchorX + 6, alignItems: 'flex-start' },
                { top },
              ]}
              hitSlop={8}
            >
              <Text
                style={[styles.labelTitle, { textAlign: isLeft ? 'right' : 'left' }]}
              >
                {domainLabel[d]}
              </Text>
              <Text style={[styles.labelSub, { textAlign: isLeft ? 'right' : 'left' }]}>
                {strengthShort[strengths?.[d] ?? 'moderate']}
              </Text>
            </Pressable>
          );
        })}
    </View>
  );
}

const styles = StyleSheet.create({
  labelWrap: {
    position: 'absolute',
    width: 92,
  },
  labelTitle: {
    fontFamily: fonts.sansMedium,
    fontSize: 12.5,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
    color: colors.accent,
  },
  labelSub: {
    fontFamily: fonts.sans,
    fontSize: 11.5,
    lineHeight: 15,
    color: colors.ink2,
    marginTop: 4,
  },
});
