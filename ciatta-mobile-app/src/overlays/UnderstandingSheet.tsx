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
import StatRow from '../components/StatRow';
import RelationshipList from '../components/RelationshipList';
import Timeline from '../components/Timeline';
import PrimaryButton from '../components/PrimaryButton';
import { CloseIcon } from '../components/icons';

function formatDate(value: string | null): string {
  if (!value) return 'Not yet';
  return new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
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

  return (
    <BottomSheet visible={!!domain} onClose={onClose}>
      {understanding ? (
        <View>
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.title}>{domainLabel[understanding.domain]}</Text>
              <Text
                style={[
                  styles.strength,
                  { color: strengthColor[understanding.strength] },
                ]}
              >
                {strengthLabel[understanding.strength].toUpperCase()}
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={10}>
              <CloseIcon />
            </Pressable>
          </View>

          <SectionLabel n={1} title="What do you understand?" />
          <Text style={styles.narrative}>{understanding.narrative}</Text>

          <SectionLabel n={2} title="Why do you believe it?" />
          <View style={styles.statBlock}>
            <StatRow
              label="Evidence"
              value={`${understanding.observations_count} observations`}
            />
            <StatRow label="Learning since" value={formatDate(understanding.learning_since)} />
            <StatRow label="First observed" value={formatDate(understanding.first_observed)} />
            <StatRow label="Last updated" value={formatDate(understanding.last_updated)} />
            <StatRow
              label="Confidence"
              value={understanding.confidence_label ?? strengthLabel[understanding.strength]}
              valueColor={colors.accent}
              last
            />
          </View>

          <SectionLabel n={3} title="Relationships" />
          <View style={styles.statBlock}>
            {relatedDomains.length > 0 ? (
              <RelationshipList relationships={relatedDomains} />
            ) : (
              <Text style={styles.emptyText}>
                Nothing connected to another part of your body yet.
              </Text>
            )}
          </View>

          <SectionLabel n={4} title="Understanding history" />
          <View style={{ marginTop: 6 }}>
            {timelineSteps.length > 0 ? (
              <Timeline steps={timelineSteps} />
            ) : (
              <Text style={styles.emptyText}>No history yet.</Text>
            )}
          </View>

          {understanding.still_learning.length > 0 ? (
            <>
              <SectionLabel n={5} title="Still learning" />
              {understanding.still_learning.map((q) => (
                <View key={q} style={styles.bulletRow}>
                  <View style={styles.bullet} />
                  <Text style={styles.bulletText}>{q}</Text>
                </View>
              ))}
            </>
          ) : null}

          <View style={{ marginTop: 24 }}>
            <PrimaryButton label="Help me learn more" onPress={onHelpLearnMore} />
          </View>
        </View>
      ) : null}
    </BottomSheet>
  );
}

function SectionLabel({ n, title }: { n: number; title: string }) {
  return (
    <Text style={styles.sectionLabel}>
      {n}. {title.toUpperCase()}
    </Text>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 22,
  },
  title: {
    fontFamily: fonts.serif,
    fontSize: 30,
    color: colors.ink,
  },
  strength: {
    fontFamily: fonts.sansMedium,
    fontSize: 11,
    letterSpacing: 1,
    marginTop: 4,
  },
  sectionLabel: {
    fontFamily: fonts.sansMedium,
    fontSize: 11,
    letterSpacing: 1,
    color: colors.ink3,
    marginTop: 24,
    marginBottom: 10,
  },
  narrative: {
    fontFamily: fonts.serif,
    fontSize: 20,
    lineHeight: 27,
    color: colors.ink,
  },
  statBlock: {
    backgroundColor: colors.canvas,
    borderRadius: 14,
    paddingHorizontal: 14,
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
  emptyText: {
    fontFamily: fonts.sans,
    fontSize: 13.5,
    lineHeight: 20,
    color: colors.ink3,
    paddingVertical: 12,
  },
});
