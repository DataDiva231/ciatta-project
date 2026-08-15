import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  Image as SvgImage,
  Line,
  LinearGradient,
  Mask,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';
import { colors, fonts } from '../theme/tokens';
import { domainLabel, strengthShort } from '../lib/mockData';
import type { Domain, Strength } from '../lib/types';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const SILHOUETTE_IMAGE = require('../../assets/images/silhouette.png');
const IMAGE_W = 426;
const IMAGE_H = 586;
const IMAGE_ASPECT = IMAGE_W / IMAGE_H;
const BASE_WIDTH = 264;

// Fractional (0-1) positions over the silhouette photo — proportion of its
// width/height, so they hold regardless of what size the image renders at.
type Position = { x: number; y: number; side: 'left' | 'right' };

const POSITIONS: Record<Domain, Position> = {
  sleep: { x: 0.37, y: 0.32, side: 'left' },
  recovery: { x: 0.6, y: 0.38, side: 'right' },
  cycle: { x: 0.4, y: 0.58, side: 'left' },
  energy: { x: 0.63, y: 0.85, side: 'right' },
  mood: { x: 0.37, y: 0.85, side: 'left' },
};

const DOMAIN_ORDER: Domain[] = ['sleep', 'recovery', 'cycle', 'energy', 'mood'];

function Glow({
  domain,
  strength,
  delay,
  animated,
  w,
  h,
}: {
  domain: Domain;
  strength: Strength;
  delay: number;
  animated: boolean;
  w: number;
  h: number;
}) {
  const pos = POSITIONS[domain];
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

  const gutter = labeled ? 62 : 0;
  const w = BASE_WIDTH * scale;
  const h = w / IMAGE_ASPECT;
  const wrapW = w + gutter * 2;
  const visibleH = h * crop;
  const isCropped = crop < 1;
  const imageOpacity = variant === 'mini' ? 0.7 : 0.5;

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
            href={SILHOUETTE_IMAGE}
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
              const pos = POSITIONS[d];
              const dir = pos.side === 'left' ? -1 : 1;
              const cx = pos.x * w;
              const cy = pos.y * h;
              return (
                <Line
                  key={`line-${d}`}
                  x1={cx}
                  y1={cy}
                  x2={cx + dir * 44}
                  y2={cy}
                  stroke={colors.ink3}
                  strokeWidth={1}
                />
              );
            })}

          {domainsToRender.map((d, i) => (
            <Glow
              key={d}
              domain={d}
              strength={strengths?.[d] ?? 'moderate'}
              delay={i * 500}
              animated={animated && variant !== 'mini'}
              w={w}
              h={h}
            />
          ))}
        </Svg>
      </View>

      {/* Touch targets over the dots themselves. The dots live inside the
          <Svg>, which takes no press events, so without these the only
          tappable things are the text labels off to the side — and the
          figure reads as interactive long before you find them. */}
      {onDomainPress &&
        domainsToRender.map((d) => {
          const pos = POSITIONS[d];
          const cx = gutter + pos.x * w;
          const cy = pos.y * h;
          const size = Math.max(44, w * 0.3);
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
          const pos = POSITIONS[d];
          const isLeft = pos.side === 'left';
          const top = pos.y * h - 16;
          const anchorX = gutter + (pos.x * w + (isLeft ? -44 : 44));
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
    color: colors.ink,
  },
  labelSub: {
    fontFamily: fonts.sans,
    fontSize: 11,
    color: colors.ink2,
    marginTop: 1,
  },
});
