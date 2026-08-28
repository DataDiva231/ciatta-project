import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import { colors, fonts, glass, type } from '../theme/tokens';
import type { DailyPoint, InsightChartKind, InsightViewModel } from '../lib/insightViz';
import { displayCopy } from '../lib/displayCopy';
import Card from './Card';

const W = 280;
const H = 118;
const PAD_L = 36;
const PAD_R = 8;
const PAD_T = 10;
const PAD_B = 22;

function bounds(points: DailyPoint[]): { min: number; max: number } {
  const values = points.map((p) => p.value);
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const pad = (max - min) * 0.12;
  return { min: min - pad, max: max + pad };
}

function xy(points: DailyPoint[], i: number, value: number, min: number, max: number) {
  const innerW = W - PAD_L - PAD_R;
  const innerH = H - PAD_T - PAD_B;
  const x = PAD_L + (points.length <= 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
  const y = PAD_T + ((max - value) / (max - min)) * innerH;
  return { x, y };
}

function linePath(points: DailyPoint[], min: number, max: number): string {
  return points
    .map((p, i) => {
      const { x, y } = xy(points, i, p.value, min, max);
      return `${i === 0 ? 'M' : 'L'}${x} ${y}`;
    })
    .join(' ');
}

function areaPath(points: DailyPoint[], min: number, max: number): string {
  if (points.length === 0) return '';
  const line = linePath(points, min, max);
  const first = xy(points, 0, points[0].value, min, max);
  const last = xy(points, points.length - 1, points[points.length - 1].value, min, max);
  const base = PAD_T + (H - PAD_T - PAD_B);
  return `${line} L${last.x} ${base} L${first.x} ${base} Z`;
}

function InsightChart({
  kind,
  points,
  color,
  yGuides,
  baseline,
  band,
}: {
  kind: InsightChartKind;
  points: DailyPoint[];
  color: string;
  yGuides?: { value: number; label: string }[];
  baseline?: number;
  band?: { min: number; max: number };
}) {
  const { min, max } =
    kind === 'divergent'
      ? {
          min: Math.min(-1, ...points.map((p) => p.value)),
          max: Math.max(1, ...points.map((p) => p.value)),
        }
      : bounds(points);
  const innerW = W - PAD_L - PAD_R;
  const barW = Math.max(6, (innerW / Math.max(points.length, 1)) * 0.46);

  return (
    <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} accessibilityRole="image">
      {yGuides?.map((g) => {
        const y = xy(points, 0, g.value, min, max).y;
        return (
          <React.Fragment key={g.label}>
            <SvgText x={0} y={y + 3} fill={colors.ink3} fontSize={9}>
              {g.label}
            </SvgText>
            <Line
              x1={PAD_L - 4}
              y1={y}
              x2={W - PAD_R}
              y2={y}
              stroke={colors.ink}
              strokeOpacity={0.06}
            />
          </React.Fragment>
        );
      })}
      {band ? (
        <Rect
          x={PAD_L}
          y={xy(points, 0, band.max, min, max).y}
          width={innerW}
          height={Math.max(
            4,
            xy(points, 0, band.min, min, max).y - xy(points, 0, band.max, min, max).y
          )}
          fill={color}
          opacity={0.12}
        />
      ) : null}
      {baseline != null ? (
        <Line
          x1={PAD_L}
          y1={xy(points, 0, baseline, min, max).y}
          x2={W - PAD_R}
          y2={xy(points, 0, baseline, min, max).y}
          stroke={colors.ink3}
          strokeDasharray="4 4"
          strokeWidth={1}
        />
      ) : null}
      {kind === 'divergent' ? (
        <Line
          x1={PAD_L}
          y1={xy(points, 0, 0, min, max).y}
          x2={W - PAD_R}
          y2={xy(points, 0, 0, min, max).y}
          stroke={colors.ink}
          strokeOpacity={0.12}
        />
      ) : null}

      {kind === 'bars' || kind === 'divergent'
        ? points.map((p, i) => {
            const zeroY = kind === 'divergent' ? xy(points, i, 0, min, max).y : PAD_T + (H - PAD_T - PAD_B);
            const { x, y } = xy(points, i, p.value, min, max);
            const top = Math.min(y, zeroY);
            const height = Math.max(2, Math.abs(zeroY - y));
            const fill = kind === 'divergent' && p.value < 0 ? '#5B4B7A' : color;
            return (
              <Rect
                key={p.day}
                x={x - barW / 2}
                y={top}
                width={barW}
                height={height}
                rx={2}
                fill={fill}
                opacity={0.9}
              />
            );
          })
        : null}

      {kind === 'area' || kind === 'band' ? (
        <Path d={areaPath(points, min, max)} fill={color} opacity={0.18} />
      ) : null}

      {kind === 'line' || kind === 'area' || kind === 'band' || kind === 'still-learning' ? (
        <Path
          d={linePath(points, min, max)}
          fill="none"
          stroke={color}
          strokeWidth={kind === 'still-learning' ? 1.25 : 1.75}
          strokeDasharray={kind === 'still-learning' ? '4 5' : undefined}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={kind === 'still-learning' ? 0.45 : 1}
        />
      ) : null}

      {(kind === 'line' || kind === 'area' || kind === 'band' || kind === 'still-learning') &&
        points.map((p, i) => {
          const { x, y } = xy(points, i, p.value, min, max);
          return (
            <Circle
              key={p.day}
              cx={x}
              cy={y}
              r={kind === 'still-learning' ? 2.5 : 3}
              fill={kind === 'still-learning' ? colors.canvas : color}
              stroke={color}
              strokeWidth={kind === 'still-learning' ? 1 : 0}
              opacity={kind === 'still-learning' ? 0.45 : 1}
            />
          );
        })}

      {points.map((p, i) => {
        if (i !== 0 && i !== points.length - 1 && i !== Math.floor((points.length - 1) / 2)) {
          return null;
        }
        const { x } = xy(points, i, p.value, min, max);
        return (
          <SvgText key={`x-${p.day}`} x={x - 14} y={H - 4} fill={colors.ink3} fontSize={9}>
            {p.label}
          </SvgText>
        );
      })}
    </Svg>
  );
}

export default function InsightVisualization({
  view,
  compact = false,
  onTry,
}: {
  view: InsightViewModel;
  compact?: boolean;
  onTry?: () => void;
}) {
  return (
    <Card style={styles.card}>
      <Text style={styles.kicker}>{displayCopy(`${view.catalog} ${view.title}`)}</Text>
      {!(compact && view.kind !== 'still-learning') ? (
        <Text style={[styles.headline, compact && styles.headlineCompact]}>{view.headline}</Text>
      ) : null}
      <Text style={styles.metric}>{view.metricLine}</Text>
      <View style={styles.chart}>
        <InsightChart
          kind={view.kind}
          points={view.points}
          color={view.color}
          yGuides={view.yGuides}
          baseline={view.baseline}
          band={view.band}
        />
      </View>
      {view.badge ? (
        <View style={[styles.badge, { borderColor: view.color }]}>
          <Text style={[styles.badgeText, { color: view.color }]}>{view.badge}</Text>
        </View>
      ) : null}
      {!compact && view.context && view.context !== view.headline ? (
        <Text style={styles.context}>{view.context}</Text>
      ) : null}
      {onTry && view.tryLabel ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={view.tryLabel}
          onPress={onTry}
          style={({ pressed }) => [styles.tryRow, pressed && { opacity: 0.7 }]}
        >
          <Text style={styles.tryWord}>Try</Text>
          <Text style={styles.tryLabel} numberOfLines={2}>
            {view.tryLabel}
          </Text>
          <Text style={styles.chevron}>{'>'}</Text>
        </Pressable>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: glass.fillCard,
    paddingVertical: 18,
    paddingHorizontal: 16,
  },
  kicker: {
    ...fonts.sans,
    fontSize: 12,
    letterSpacing: 0.2,
    color: colors.ink3,
  },
  headline: {
    ...type.title3,
    color: colors.ink,
    marginTop: 10,
  },
  headlineCompact: {
    fontSize: 18,
    lineHeight: 23,
  },
  metric: {
    ...fonts.sans,
    fontSize: 12,
    lineHeight: 16,
    color: colors.ink3,
    marginTop: 6,
  },
  chart: {
    marginTop: 8,
    marginHorizontal: -4,
  },
  badge: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 4,
  },
  badgeText: {
    ...fonts.sansMedium,
    fontSize: 11,
  },
  context: {
    ...fonts.sans,
    fontSize: 13.5,
    lineHeight: 20,
    color: colors.ink2,
    marginTop: 10,
  },
  tryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
  },
  tryWord: {
    ...fonts.sansSemiBold,
    fontSize: 14,
    color: colors.ink,
  },
  tryLabel: {
    ...fonts.sans,
    fontSize: 14,
    lineHeight: 19,
    color: colors.ink2,
    flex: 1,
  },
  chevron: {
    ...fonts.sans,
    fontSize: 16,
    color: colors.ink3,
  },
});
