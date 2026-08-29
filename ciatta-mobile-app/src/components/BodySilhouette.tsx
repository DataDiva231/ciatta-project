import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, {
  Circle,
  Defs,
  Line,
  LinearGradient,
  Mask,
  RadialGradient,
  Rect,
  Stop,
  Image as SvgImage,
} from 'react-native-svg';
import { colors, domainColor, fonts } from '../theme/tokens';
import { domainLabel, strengthShort } from '../lib/mockData';
import type { Domain, Strength } from '../lib/types';
import {
  constellationBreath,
  constellationDotRadius,
  constellationGlowRadius,
  constellationHaloOpacity,
  constellationLinkOpacity,
  todayConstellationDomains,
  uniqueConstellationLinks,
  type ConstellationLink,
} from '../lib/constellation';

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

function useReduceMotion() {
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled?.().then((enabled) => {
      if (alive) setReduceMotion(!!enabled);
    });
    const sub = AccessibilityInfo.addEventListener?.('reduceMotionChanged', (enabled) => {
      setReduceMotion(!!enabled);
    });
    return () => {
      alive = false;
      sub?.remove();
    };
  }, []);
  return reduceMotion;
}

function ConstellationStar({
  domain,
  pos,
  strength,
  focal,
  gradientId,
  animated,
  w,
  h,
}: {
  domain: Domain;
  pos: Position;
  strength: Strength;
  focal: boolean;
  gradientId: string;
  animated: boolean;
  w: number;
  h: number;
}) {
  const cx = pos.x * w;
  const cy = pos.y * h;
  const coreR = constellationDotRadius(w, strength, focal);
  const glowR = constellationGlowRadius(coreR);
  const haloOpacity = constellationHaloOpacity(strength) * (focal ? 1.15 : 1);
  const breath = constellationBreath(domain);
  const progress = useRef(new Animated.Value(breath.phase)).current;

  useEffect(() => {
    if (!animated) {
      progress.setValue(0.45);
      return;
    }
    progress.setValue(breath.phase);
    const half = breath.durationMs / 2;
    const ease = Easing.inOut(Easing.sin);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(progress, {
          toValue: 1,
          duration: half,
          easing: ease,
          useNativeDriver: false,
        }),
        Animated.timing(progress, {
          toValue: 0,
          duration: half,
          easing: ease,
          useNativeDriver: false,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [animated, breath.durationMs, breath.phase, progress]);

  const fillOpacity = animated
    ? progress.interpolate({
        inputRange: [0, 1],
        outputRange: [0.72 + haloOpacity * 0.4, 1],
      })
    : 0.9;
  const glowSize = animated
    ? progress.interpolate({
        inputRange: [0, 1],
        outputRange: [glowR, glowR * 1.06],
      })
    : glowR;

  return (
    <AnimatedCircle
      cx={cx}
      cy={cy}
      r={glowSize as unknown as number}
      fill={`url(#${gradientId})`}
      opacity={fillOpacity as unknown as number}
    />
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
  const reduceMotion = useReduceMotion();
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
            {domainsToRender.map((d) => (
              <RadialGradient
                key={`heat-${d}`}
                id={`heat-${variant}-${d}`}
                cx="50%"
                cy="50%"
                r="50%"
                fx="50%"
                fy="50%"
              >
                <Stop offset="0%" stopColor={domainColor[d]} stopOpacity={1} />
                <Stop offset="32%" stopColor={domainColor[d]} stopOpacity={0.62} />
                <Stop offset="70%" stopColor={domainColor[d]} stopOpacity={0.18} />
                <Stop offset="100%" stopColor={domainColor[d]} stopOpacity={0} />
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

          {domainsToRender.map((d) => (
            <ConstellationStar
              key={d}
              domain={d}
              pos={positions[d]}
              strength={strengths?.[d] ?? 'moderate'}
              focal={variant === 'today' && d === activeDomain}
              gradientId={`heat-${variant}-${d}`}
              animated={animated && variant !== 'mini' && !reduceMotion}
              w={w}
              h={h}
            />
          ))}
        </Svg>
      </View>

      {onDomainPress ? (
        <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
          {domainsToRender.map((d) => {
            const pos = positions[d];
            const cx = gutter + pos.x * w;
            const cy = pos.y * h;
            if (cy > visibleH) return null;
            const strength = strengths?.[d] ?? 'moderate';
            const focal = variant === 'today' && d === activeDomain;
            const coreR = constellationDotRadius(w, strength, focal);
            const hit = Math.max(44, coreR * 6.4);
            return (
              <Pressable
                key={`hotspot-${d}`}
                accessibilityRole="button"
                accessibilityLabel={`${domainLabel[d]}, open understanding`}
                onPress={() => onDomainPress(d)}
                style={{
                  position: 'absolute',
                  left: cx - hit / 2,
                  top: cy - hit / 2,
                  width: hit,
                  height: hit,
                  borderRadius: hit / 2,
                }}
              />
            );
          })}
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
