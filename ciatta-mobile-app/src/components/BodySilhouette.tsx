import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  Line,
  LinearGradient,
  Mask,
  Rect,
  Stop,
  Image as SvgImage,
} from 'react-native-svg';
import { colors, domainColor, fonts } from '../theme/tokens';
import { domainLabel, strengthShort } from '../lib/mockData';
import type { Domain, Strength } from '../lib/types';
import {
  constellationDotRadius,
  constellationHaloOpacity,
  constellationLinkOpacity,
  todayConstellationDomains,
  uniqueConstellationLinks,
  type ConstellationLink,
} from '../lib/constellation';
import GlassSurface, { GlassGroup } from './GlassSurface';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type Position = {
  x: number;
  y: number;
  side: 'left' | 'right';
  labelDy?: number;
  lead?: number;
};

type Figure = {
  src: ReturnType<typeof require>;
  w: number;
  h: number;
  baseWidth: number;
  positions: Record<Domain, Position>;
};

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

export const CORE_FIGURE_BASE_WIDTH = FIGURES.full.baseWidth;
export const CORE_FIGURE_ASPECT = FIGURES.full.h / FIGURES.full.w;

function ConstellationStar({
  domain,
  pos,
  strength,
  focal,
  delay,
  animated,
  w,
  h,
}: {
  domain: Domain;
  pos: Position;
  strength: Strength;
  focal: boolean;
  delay: number;
  animated: boolean;
  w: number;
  h: number;
}) {
  const cx = pos.x * w;
  const cy = pos.y * h;
  const color = domainColor[domain];
  const coreR = constellationDotRadius(w, strength, focal);
  const haloOpacity = constellationHaloOpacity(strength) * (focal ? 1.15 : 1);
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!animated) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(progress, {
          toValue: 1,
          duration: 2400,
          useNativeDriver: false,
        }),
        Animated.timing(progress, {
          toValue: 0,
          duration: 2400,
          useNativeDriver: false,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [animated, delay, progress]);

  const outerR = animated
    ? progress.interpolate({
        inputRange: [0, 1],
        outputRange: [coreR * 3.1, coreR * 3.45],
      })
    : coreR * 3.2;
  const midR = animated
    ? progress.interpolate({
        inputRange: [0, 1],
        outputRange: [coreR * 1.85, coreR * 2.05],
      })
    : coreR * 1.95;
  const outerOp = animated
    ? progress.interpolate({
        inputRange: [0, 1],
        outputRange: [haloOpacity * 0.45, haloOpacity * 0.7],
      })
    : haloOpacity * 0.55;
  const midOp = animated
    ? progress.interpolate({
        inputRange: [0, 1],
        outputRange: [haloOpacity * 0.75, haloOpacity],
      })
    : haloOpacity * 0.85;

  return (
    <>
      <AnimatedCircle
        cx={cx}
        cy={cy}
        r={outerR as unknown as number}
        fill={color}
        opacity={outerOp as unknown as number}
      />
      <AnimatedCircle
        cx={cx}
        cy={cy}
        r={midR as unknown as number}
        fill={color}
        opacity={midOp as unknown as number}
      />
      <Circle cx={cx} cy={cy} r={coreR} fill={color} />
    </>
  );
}

export interface BodySilhouetteProps {
  variant?: 'today' | 'core' | 'mini';
  activeDomain?: Domain;
  strengths?: Partial<Record<Domain, Strength>>;
  links?: ConstellationLink[];
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
  links = [],
  labeled = false,
  animated = true,
  onDomainPress,
  stage,
  scale = 1,
  crop = 1,
}: BodySilhouetteProps) {
  const learned = useMemo(
    () => new Set((strengths ? (Object.keys(strengths) as Domain[]) : []) as Domain[]),
    [strengths]
  );

  const domainsToRender = useMemo<Domain[]>(() => {
    if (variant === 'today') {
      return todayConstellationDomains(activeDomain, links, learned.size > 0 ? learned : new Set(activeDomain ? [activeDomain] : []));
    }
    if (variant === 'mini') {
      const count = [1, 2, 4, 5][stage ?? 0];
      return DOMAIN_ORDER.slice(0, count);
    }
    return strengths ? (Object.keys(strengths) as Domain[]) : [];
  }, [variant, activeDomain, stage, strengths, links, learned]);

  const visible = useMemo(() => new Set(domainsToRender), [domainsToRender]);
  const edges = useMemo(
    () => (variant === 'mini' ? [] : uniqueConstellationLinks(links, visible)),
    [variant, links, visible]
  );

  const figure = variant === 'core' ? FIGURES.full : FIGURES.torso;
  const positions = figure.positions;

  const gutter = labeled ? 74 : 0;
  const w = figure.baseWidth * scale;
  const h = w * (figure.h / figure.w);
  const wrapW = w + gutter * 2;
  const visibleH = h * crop;
  const isCropped = crop < 1;
  const imageOpacity = variant === 'mini' ? 0.7 : 1;

  return (
    <View
      style={{ width: wrapW, height: visibleH, alignSelf: 'center', overflow: 'hidden' }}
    >
      <View style={{ position: 'absolute', left: gutter, top: 0 }}>
        <Svg width={w} height={visibleH}>
          <Defs>
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

          <Rect x={0} y={0} width={w} height={visibleH} fill={colors.canvas} />
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

          {edges.map((link) => {
            const a = positions[link.from];
            const b = positions[link.to];
            return (
              <Line
                key={`${link.from}-${link.to}`}
                x1={a.x * w}
                y1={a.y * h}
                x2={b.x * w}
                y2={b.y * h}
                stroke={colors.ink}
                strokeWidth={Math.max(0.6, w * 0.003)}
                strokeLinecap="round"
                opacity={constellationLinkOpacity(link.strength)}
              />
            );
          })}

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
                  stroke={colors.ink}
                  strokeWidth={0.75}
                  opacity={0.18}
                />
              );
            })}

          {domainsToRender.map((d, i) => (
            <ConstellationStar
              key={d}
              domain={d}
              pos={positions[d]}
              strength={strengths?.[d] ?? 'moderate'}
              focal={variant === 'today' && d === activeDomain}
              delay={i * 420}
              animated={animated && variant !== 'mini'}
              w={w}
              h={h}
            />
          ))}
        </Svg>
      </View>

      {onDomainPress ? (
        <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
          <GlassGroup spacing={36} style={StyleSheet.absoluteFill}>
          {domainsToRender.map((d) => {
            const pos = positions[d];
            const cx = gutter + pos.x * w;
            const cy = pos.y * h;
            if (cy > visibleH) return null;
            const strength = strengths?.[d] ?? 'moderate';
            const focal = variant === 'today' && d === activeDomain;
            const coreR = constellationDotRadius(w, strength, focal);
            const lens = Math.max(22, coreR * 6.4);
            const hitPad = Math.max(0, (44 - lens) / 2);
            return (
              <GlassSurface
                key={`hotspot-${d}`}
                kind={focal ? 'regular' : 'clear'}
                interactive
                animateStyle
                tintColor={domainColor[d]}
                colorScheme="auto"
                style={{
                  position: 'absolute',
                  left: cx - lens / 2,
                  top: cy - lens / 2,
                  width: lens,
                  height: lens,
                  borderRadius: lens / 2,
                }}
                fallbackStyle={styles.hotspotFallback}
              >
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${domainLabel[d]}, open understanding`}
                  onPress={() => onDomainPress(d)}
                  hitSlop={hitPad}
                  style={styles.hotspotPress}
                />
              </GlassSurface>
            );
          })}
          </GlassGroup>
        </View>
      ) : null}

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
  hotspotFallback: {
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
  hotspotPress: {
    flex: 1,
  },
  labelWrap: {
    position: 'absolute',
    width: 92,
  },
  labelTitle: {
    ...fonts.sansMedium,
    fontSize: 12.5,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
    color: colors.ink,
  },
  labelSub: {
    ...fonts.sans,
    fontSize: 11.5,
    lineHeight: 15,
    color: colors.ink2,
    marginTop: 4,
  },
});
