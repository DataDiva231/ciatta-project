import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, strengthColor } from '../theme/tokens';
import { domainLabel, strengthLabel, understandings } from '../lib/mockData';
import type { Domain } from '../lib/types';
import BottomSheet from '../components/BottomSheet';
import StatRow from '../components/StatRow';
import RelationshipList from '../components/RelationshipList';
import Timeline from '../components/Timeline';
import PrimaryButton from '../components/PrimaryButton';
import { CloseIcon } from '../components/icons';

export default function UnderstandingSheet({
  domain,
  onClose,
  onHelpLearnMore,
}: {
  domain: Domain | null;
  onClose: () => void;
  onHelpLearnMore: () => void;
}) {
  const understanding = domain ? understandings[domain] : null;

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
            <StatRow label="Evidence" value={`${understanding.observations} observations`} />
            <StatRow label="Learning since" value={understanding.learningSince} />
            <StatRow label="First observed" value={understanding.firstObserved} />
            <StatRow label="Last updated" value={understanding.lastUpdated} />
            <StatRow
              label="Confidence"
              value={understanding.confidence}
              valueColor={colors.accent}
              last
            />
          </View>

          <SectionLabel n={3} title="Relationships" />
          <View style={styles.statBlock}>
            <RelationshipList relationships={understanding.relationships} />
          </View>

          <SectionLabel n={4} title="Understanding history" />
          <View style={{ marginTop: 6 }}>
            <Timeline
              steps={understanding.history.map((h) => ({
                label: h.date,
                detail: h.label,
                active: h.active,
              }))}
            />
          </View>

          <SectionLabel n={5} title="Still learning" />
          {understanding.stillLearning.map((q) => (
            <View key={q} style={styles.bulletRow}>
              <View style={styles.bullet} />
              <Text style={styles.bulletText}>{q}</Text>
            </View>
          ))}

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
});
