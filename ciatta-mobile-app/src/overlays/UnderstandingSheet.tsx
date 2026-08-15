import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, strengthColor } from '../theme/tokens';
import { domainLabel, strengthLabel } from '../lib/mockData';
import type { Domain, RelationshipRef } from '../lib/types';
import type {
  RelationshipRow,
  UnderstandingHistoryRow,
  UnderstandingRow,
} from '../lib/queries';
import BottomSheet from '../components/BottomSheet';
import RelationshipList from '../components/RelationshipList';
import Timeline from '../components/Timeline';
import PrimaryButton from '../components/PrimaryButton';
import { CloseIcon } from '../components/icons';

function formatDate(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/** "3 days" / "6 weeks" / "4 months" — a span someone can feel, not a date. */
function formatSpan(from: string | null): string | null {
  if (!from) return null;
  const days = Math.floor((Date.now() - new Date(from).getTime()) / 86400000);
  if (days < 1) return 'today';
  if (days < 14) return `${days} day${days === 1 ? '' : 's'}`;
  const weeks = Math.round(days / 7);
  if (days < 60) return `${weeks} weeks`;
  return `${Math.round(days / 30)} months`;
}

function formatAgo(value: string | null): string {
  if (!value) return '—';
  const mins = Math.floor((Date.now() - new Date(value).getTime()) / 60000);
  if (mins < 60) return mins <= 1 ? 'just now' : `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? 'yesterday' : `${days} days ago`;
}

export default function UnderstandingSheet({
  domain,
  understandings,
  relationships,
  history,
  onClose,
  onHelpLearnMore,
}: {
  domain: Domain | null;
  understandings: UnderstandingRow[];
  relationships: RelationshipRow[];
  history: UnderstandingHistoryRow[];
  onClose: () => void;
  onHelpLearnMore: () => void;
}) {
  const understanding = domain ? understandings.find((u) => u.domain === domain) ?? null : null;

  const relatedDomains: RelationshipRef[] = understanding
    ? relationships
        .filter((r) => r.from_domain === understanding.domain || r.to_domain === understanding.domain)
        .map((r) => ({
          domain: r.from_domain === understanding.domain ? r.to_domain : r.from_domain,
          strength: r.strength,
        }))
    : [];

  const timelineSteps = understanding
    ? history
        .filter((h) => h.understanding_id === understanding.id)
        .map((h, i, arr) => ({
          label: formatDate(h.event_date),
          detail: h.label,
          active: i === arr.length - 1,
        }))
    : [];

  if (!understanding) {
    return <BottomSheet visible={!!domain} onClose={onClose}>{null}</BottomSheet>;
  }

  const span = formatSpan(understanding.learning_since);
  const confidence = understanding.confidence_label ?? strengthLabel[understanding.strength];

  return (
    <BottomSheet visible={!!domain} onClose={onClose}>
      <View>
        <View style={styles.headerRow}>
          <View style={styles.headerText}>
            <Text style={styles.eyebrow}>WHAT I UNDERSTAND ABOUT YOUR</Text>
            <Text style={styles.title}>{domainLabel[understanding.domain]}</Text>
          </View>
          <Pressable onPress={onClose} hitSlop={10}>
            <CloseIcon />
          </Pressable>
        </View>

        {/* The finding itself, given the weight it deserves. */}
        <Text style={styles.narrative}>{understanding.narrative}</Text>

        {/* Confidence, stated once, where it belongs — next to the claim it
            qualifies rather than buried in a stat table below. */}
        <View style={styles.confidenceRow}>
          <View
            style={[
              styles.confidenceDot,
              { backgroundColor: strengthColor[understanding.strength] },
            ]}
          />
          <Text style={[styles.confidenceText, { color: strengthColor[understanding.strength] }]}>
            {confidence}
          </Text>
          <Text style={styles.confidenceSep}>·</Text>
          <Text style={styles.confidenceMeta}>updated {formatAgo(understanding.last_updated)}</Text>
        </View>

        <Text style={styles.sectionLabel}>WHY I BELIEVE IT</Text>
        <View style={styles.evidenceStrip}>
          <View style={styles.metric}>
            <Text style={styles.metricValue}>{understanding.observations_count}</Text>
            <Text style={styles.metricLabel}>readings{'\n'}behind this</Text>
          </View>
          <View style={styles.metricDivider} />
          <View style={styles.metric}>
            <Text style={styles.metricValue}>{span ?? '—'}</Text>
            <Text style={styles.metricLabel}>of watching{'\n'}your body</Text>
          </View>
          <View style={styles.metricDivider} />
          <View style={styles.metric}>
            <Text style={styles.metricValue}>{timelineSteps.length || '—'}</Text>
            <Text style={styles.metricLabel}>time{timelineSteps.length === 1 ? '' : 's'} this{'\n'}has shifted</Text>
          </View>
        </View>
        <Text style={styles.evidenceFootnote}>
          Learning since {formatDate(understanding.learning_since)}.
        </Text>

        {relatedDomains.length > 0 ? (
          <>
            <Text style={styles.sectionLabel}>CONNECTED TO</Text>
            <RelationshipList relationships={relatedDomains} />
          </>
        ) : null}

        {timelineSteps.length > 0 ? (
          <>
            <Text style={styles.sectionLabel}>HOW THIS CHANGED</Text>
            <Timeline steps={timelineSteps} />
          </>
        ) : null}

        {understanding.still_learning.length > 0 ? (
          <>
            <Text style={styles.sectionLabel}>STILL WORKING OUT</Text>
            {understanding.still_learning.map((q) => (
              <View key={q} style={styles.bulletRow}>
                <View style={styles.bullet} />
                <Text style={styles.bulletText}>{q}</Text>
              </View>
            ))}
          </>
        ) : null}

        <View style={{ marginTop: 28 }}>
          <PrimaryButton label="Help me learn more" onPress={onHelpLearnMore} />
        </View>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 18,
  },
  headerText: {
    flex: 1,
    paddingRight: 12,
  },
  eyebrow: {
    fontFamily: fonts.sansMedium,
    fontSize: 10.5,
    letterSpacing: 1.1,
    color: colors.ink3,
    marginBottom: 4,
  },
  title: {
    fontFamily: fonts.serif,
    fontSize: 32,
    color: colors.ink,
  },
  narrative: {
    fontFamily: fonts.serif,
    fontSize: 21,
    lineHeight: 29,
    color: colors.ink,
  },
  confidenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 14,
    flexWrap: 'wrap',
  },
  confidenceDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  confidenceText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 13,
  },
  confidenceSep: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.ink3,
  },
  confidenceMeta: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.ink3,
  },
  sectionLabel: {
    fontFamily: fonts.sansMedium,
    fontSize: 10.5,
    letterSpacing: 1.1,
    color: colors.ink3,
    marginTop: 30,
    marginBottom: 12,
  },
  evidenceStrip: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: colors.canvas,
    borderRadius: 14,
    paddingVertical: 18,
  },
  metric: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  metricDivider: {
    width: 1,
    backgroundColor: colors.border,
    marginVertical: 2,
  },
  metricValue: {
    fontFamily: fonts.mono,
    fontSize: 20,
    color: colors.evidence,
  },
  metricLabel: {
    fontFamily: fonts.sans,
    fontSize: 11.5,
    lineHeight: 15,
    color: colors.ink2,
    textAlign: 'center',
    marginTop: 6,
  },
  evidenceFootnote: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.ink3,
    marginTop: 10,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
    gap: 8,
  },
  bullet: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.ink3,
    marginTop: 8,
  },
  bulletText: {
    flex: 1,
    fontFamily: fonts.sans,
    fontSize: 13.5,
    lineHeight: 20,
    color: colors.ink2,
  },
});
