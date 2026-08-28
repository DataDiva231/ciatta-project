import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, domainColor, fonts, type } from '../theme/tokens';
import { displayCopy } from '../lib/displayCopy';
import { composeWhyLayer } from '../lib/whyLayer';
import {
  listInsightCandidates,
  selectInsightVisualization,
  toUnderstandingSignals,
} from '../lib/insightViz';
import { fetchInsightSeries } from '../lib/observationSeries';
import type { TodayPriority } from '../lib/priority';
import type {
  CrossDomainUnderstandingRow,
  RelationshipRow,
  UnderstandingHistoryRow,
  UnderstandingRow,
} from '../lib/queries';
import BottomSheet from '../components/BottomSheet';
import GhostButton from '../components/GhostButton';
import InsightVisualization from '../components/InsightVisualization';

export default function WhySheet({
  visible,
  featured,
  todayNarrative,
  todayPriority,
  understandings,
  relationships,
  crossDomain,
  history,
  goals = [],
  userId,
  onClose,
}: {
  visible: boolean;
  featured: UnderstandingRow | null;
  todayNarrative: string;
  todayPriority: TodayPriority | null;
  understandings: UnderstandingRow[];
  relationships: RelationshipRow[];
  crossDomain: CrossDomainUnderstandingRow[];
  history: UnderstandingHistoryRow[];
  goals?: string[];
  userId?: string | null;
  onClose: () => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<ReturnType<typeof listInsightCandidates>>([]);

  useEffect(() => {
    if (!visible) setExpandedId(null);
  }, [visible]);

  useEffect(() => {
    if (!visible || !userId || !featured) return;
    let alive = true;
    fetchInsightSeries(userId)
      .then((series) => {
        if (!alive) return;
        const signals = toUnderstandingSignals(understandings);
        const links = relationships.map((r) => ({
          from: r.from_domain,
          to: r.to_domain,
          strength: r.strength,
        }));
        const listed = listInsightCandidates({
          understandings: signals,
          relationships: links,
          goals,
          series,
          featuredDomain: featured.domain,
          focusDomain: featured.domain,
          excludeIds: ['still_learning'],
        });
        const primary = selectInsightVisualization({
          understandings: signals,
          relationships: links,
          goals,
          series,
          featuredDomain: featured.domain,
          focusDomain: featured.domain,
          excludeIds: ['still_learning'],
          allowStillLearning: false,
        });
        const rest = listed.filter((c) => c.id !== primary?.id && c.kind !== 'still-learning');
        setCandidates(primary && primary.kind !== 'still-learning' ? [primary, ...rest] : rest);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [visible, userId, featured, understandings, relationships, goals]);

  const layer = useMemo(() => {
    if (!featured) return null;
    return composeWhyLayer({
      featured,
      todayNarrative,
      todayPriority,
      understandings,
      relationships,
      crossDomain,
      history,
      candidates,
    });
  }, [
    featured,
    todayNarrative,
    todayPriority,
    understandings,
    relationships,
    crossDomain,
    history,
    candidates,
  ]);

  return (
    <BottomSheet visible={visible} onClose={onClose} maxHeightPct={0.88}>
      {featured && layer ? (
        <>
          {layer.mattering ? <Text style={styles.mattering}>{layer.mattering}</Text> : null}
          {layer.evidence ? <Text style={styles.evidence}>{layer.evidence}</Text> : null}

          {layer.primaryViz ? (
            <View style={styles.viz}>
              <InsightVisualization view={layer.primaryViz} />
            </View>
          ) : null}

          {layer.supporting.map((signal) => {
            const open = expandedId === signal.id;
            return (
              <View key={signal.id} style={styles.support}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={displayCopy(signal.title)}
                  onPress={() => setExpandedId(open ? null : signal.id)}
                  style={({ pressed }) => [styles.supportHit, pressed && { opacity: 0.65 }]}
                >
                  <View style={[styles.dot, { backgroundColor: signal.color }]} />
                  <Text style={styles.supportTitle}>{displayCopy(signal.title)}</Text>
                </Pressable>
                {open ? (
                  <View style={styles.supportViz}>
                    <InsightVisualization view={signal} compact />
                  </View>
                ) : null}
              </View>
            );
          })}

          {layer.related.map((item) => (
            <View key={item.domain} style={styles.related}>
              <View style={[styles.dot, { backgroundColor: domainColor[item.domain] }]} />
              <Text style={styles.relatedText}>{item.text}</Text>
            </View>
          ))}

          {(layer.history ?? [])
            .filter((label) => label !== layer.mattering)
            .map((label) => (
              <Text key={label} style={styles.history}>
                {label}
              </Text>
            ))}

          {layer.watching ? <Text style={styles.watching}>{layer.watching}</Text> : null}

          <GhostButton label="Close" onPress={onClose} />
        </>
      ) : null}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  mattering: {
    ...type.title3,
    color: colors.ink,
    marginBottom: 12,
  },
  evidence: {
    ...fonts.sans,
    fontSize: 14.5,
    lineHeight: 22,
    color: colors.ink2,
  },
  viz: {
    marginTop: 16,
  },
  support: {
    marginTop: 14,
  },
  supportHit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 44,
  },
  supportTitle: {
    ...fonts.sans,
    fontSize: 14,
    color: colors.ink2,
  },
  supportViz: {
    marginTop: 8,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  related: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 16,
  },
  relatedText: {
    ...fonts.sans,
    fontSize: 14.5,
    lineHeight: 21,
    color: colors.ink2,
    flex: 1,
  },
  watching: {
    ...fonts.sans,
    fontSize: 14.5,
    lineHeight: 21,
    color: colors.ink,
    marginTop: 20,
  },
  history: {
    ...fonts.sans,
    fontSize: 14.5,
    lineHeight: 21,
    color: colors.ink2,
    marginTop: 16,
  },
});
