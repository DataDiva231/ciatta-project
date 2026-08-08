import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../theme/tokens';
import { whySheet } from '../lib/mockData';
import BottomSheet from '../components/BottomSheet';
import Timeline from '../components/Timeline';
import ConfidenceBar from '../components/ConfidenceBar';
import Card from '../components/Card';
import { PlusIcon } from '../components/icons';

export default function WhySheet({
  visible,
  onClose,
  onTeachCiatta,
}: {
  visible: boolean;
  onClose: () => void;
  onTeachCiatta: () => void;
}) {
  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <Text style={styles.title}>Why we think this</Text>

      <Text style={styles.sectionLabel}>SUMMARY</Text>
      <Text style={styles.summary}>{whySheet.summary}</Text>

      <Text style={styles.sectionLabel}>EVIDENCE TIMELINE</Text>
      <View style={{ marginTop: 4 }}>
        <Timeline steps={whySheet.timeline} />
      </View>

      <Text style={styles.sectionLabel}>CONFIDENCE</Text>
      <Text style={styles.confidence}>{whySheet.confidence}</Text>
      <ConfidenceBar value={whySheet.confidencePct} />
      <Text style={styles.confidenceCaption}>
        Built from {whySheet.observations} observations across {whySheet.months}{' '}
        months.
      </Text>

      <Text style={styles.sectionLabel}>STILL LEARNING</Text>
      <Text style={styles.summary}>{whySheet.stillLearning}</Text>
      <Text style={styles.hint}>{whySheet.stillLearningHint}</Text>

      <Text style={styles.sectionLabel}>CONTRIBUTE</Text>
      <Card onPress={onTeachCiatta} style={styles.teachCard}>
        <View style={styles.plusCircle}>
          <PlusIcon size={16} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.teachTitle}>Teach Ciatta</Text>
          <Text style={styles.teachSub}>
            Every observation helps me understand you better.
          </Text>
        </View>
      </Card>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  title: {
    fontFamily: fonts.serif,
    fontSize: 28,
    color: colors.ink,
    marginBottom: 6,
  },
  sectionLabel: {
    fontFamily: fonts.sansMedium,
    fontSize: 11,
    letterSpacing: 1,
    color: colors.ink3,
    marginTop: 24,
    marginBottom: 10,
  },
  summary: {
    fontFamily: fonts.serif,
    fontSize: 18,
    lineHeight: 25,
    color: colors.ink,
  },
  confidence: {
    fontFamily: fonts.serif,
    fontSize: 26,
    color: colors.ink,
    marginBottom: 10,
  },
  confidenceCaption: {
    fontFamily: fonts.sans,
    fontSize: 12.5,
    color: colors.ink3,
    marginTop: 8,
  },
  hint: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.ink3,
    fontStyle: 'italic',
    marginTop: 8,
  },
  teachCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  plusCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.canvas,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  teachTitle: {
    fontFamily: fonts.sansMedium,
    fontSize: 15,
    color: colors.ink,
    marginBottom: 4,
  },
  teachSub: {
    fontFamily: fonts.sans,
    fontSize: 13,
    lineHeight: 18,
    color: colors.ink2,
  },
});
